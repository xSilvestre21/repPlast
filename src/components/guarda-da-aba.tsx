"use client";

/**
 * Encerra a sessão quando a guia ou o app foi fechado, e no celular depois de
 * 1 hora fora dele — o porquê e as marcas estão em `lib/aba.ts`.
 *
 * Também avisa o servidor de que o sistema está em uso, para a sessão não
 * vencer (`/api/sessao`): ao abrir e ao voltar para o app, no máximo a cada 15
 * minutos — o servidor só refaz o cookie de hora em hora, de todo modo. Avisar
 * mora aqui, e não num componente à parte, porque só pode ir depois de a guia
 * ser liberada: o aviso chegando depois da saída regravaria o cookie.
 */

import { useEffect } from "react";

import {
  AUSENCIA_CELULAR_MS,
  CANAL,
  CELULAR,
  COOKIE_ENTROU,
  MARCA,
  OCULTA_EM,
  REABERTA_MS,
  SAIU_EM,
} from "@/lib/aba";

const INTERVALO_AVISO_MS = 15 * 60 * 1000;
/** Quanto esperar a resposta de outra guia logada antes de encerrar. */
const ESPERA_RESPOSTA_MS = 400;

let ultimoAviso = 0;
let saindo = false;
let canalDaPagina: BroadcastChannel | null | undefined;

/**
 * Um canal só, por página, que nunca fecha: o React desmonta e remonta o
 * efeito (no desenvolvimento, sempre), e a pergunta feita por um canal
 * fechado no meio do caminho nunca recebe a resposta — a guia sairia.
 */
function canal(): BroadcastChannel | null {
  if (canalDaPagina === undefined) {
    canalDaPagina = "BroadcastChannel" in window ? new BroadcastChannel(CANAL) : null;
  }
  return canalDaPagina;
}

function avisar() {
  if (document.visibilityState !== "visible" || Date.now() - ultimoAviso < INTERVALO_AVISO_MS) return;
  ultimoAviso = Date.now();
  // Sem rede, fica para a próxima vez: é só o prazo, nada se perde.
  fetch("/api/sessao", { method: "POST" }).catch(() => {});
}

/** Lê e apaga o `sessionStorage` sem lançar: há navegador que o bloqueia. */
function armazenamento(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * O login acabou de acontecer nesta guia: o cookie do servidor vira a marca.
 *
 * O `SCRIPT_ABA` faz o mesmo no carregamento completo; aqui é para o login,
 * que chega ao sistema por navegação do React, sem carregar a página.
 */
function consumirLogin(s: Storage) {
  if (!document.cookie.split("; ").includes(`${COOKIE_ENTROU}=1`)) return;
  s.setItem(MARCA, "1");
  s.removeItem(OCULTA_EM);
  s.removeItem(SAIU_EM);
  document.cookie = `${COOKIE_ENTROU}=; Max-Age=0; path=/`;
}

/** Ficou tempo demais fora do app (só no celular)? */
function ausenteDemais(s: Storage): boolean {
  const oculta = Number(s.getItem(OCULTA_EM));
  return oculta > 0 && matchMedia(CELULAR).matches && Date.now() - oculta > AUSENCIA_CELULAR_MS;
}

/** A guia pode continuar logada? Sem `sessionStorage`, sim — trancar ali seria trancar sempre. */
function abaLiberada(): boolean {
  const s = armazenamento();
  if (!s) return true;
  return s.getItem(MARCA) === "1" && !ausenteDemais(s);
}

function encerrar() {
  if (saindo) return;
  saindo = true;
  document.documentElement.dataset.aba = "conferindo";
  armazenamento()?.removeItem(MARCA);
  // Recarrega mesmo sem rede: `/entrar` com o cookie ainda lá volta ao
  // sistema, e esta guia, sem a marca, tenta sair de novo.
  fetch("/api/sessao", { method: "DELETE" })
    .catch(() => {})
    .finally(() => window.location.replace("/entrar?sessao=encerrada"));
}

/** Pergunta às outras guias deste navegador se alguma está logada. */
function outraGuiaLogada(): Promise<boolean> {
  const aberto = canal();
  if (!aberto) return Promise.resolve(false);
  return new Promise((resolver) => {
    const aoResponder = (evento: MessageEvent) => {
      if (evento.data !== "logada") return;
      clearTimeout(espera);
      aberto.removeEventListener("message", aoResponder);
      resolver(true);
    };
    const espera = setTimeout(() => {
      aberto.removeEventListener("message", aoResponder);
      resolver(false);
    }, ESPERA_RESPOSTA_MS);
    aberto.addEventListener("message", aoResponder);
    aberto.postMessage("alguma-logada?");
  });
}

/**
 * Carregamento completo: a guia fechada e reaberta traz o `sessionStorage` de
 * volta, mas o `SAIU_EM` denuncia — recarregar a página não conta.
 */
function reaberta(s: Storage): boolean {
  const saiu = Number(s.getItem(SAIU_EM));
  const navegacao = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return saiu > 0 && navegacao?.type !== "reload" && Date.now() - saiu > REABERTA_MS;
}

async function conferir(carregou = false) {
  const s = armazenamento();
  if (s) {
    consumirLogin(s);
    if (carregou && reaberta(s)) s.removeItem(MARCA);
    s.removeItem(SAIU_EM);
  }

  if (abaLiberada()) {
    s?.removeItem(OCULTA_EM);
    delete document.documentElement.dataset.aba;
    avisar();
    return;
  }

  // Sem a marca, mas com outra guia logada: é a mesma pessoa abrindo mais uma.
  // Ficou tempo demais fora do app, não — essa tranca, mesmo com outra aberta.
  if (s && !s.getItem(MARCA) && (await outraGuiaLogada())) {
    s.setItem(MARCA, "1");
    delete document.documentElement.dataset.aba;
    avisar();
    return;
  }

  encerrar();
}

export function GuardaDaAba() {
  useEffect(() => {
    const canalAberto = canal();

    function responder(evento: MessageEvent) {
      if (evento.data === "alguma-logada?" && !saindo && armazenamento()?.getItem(MARCA) === "1" && abaLiberada()) {
        canalAberto?.postMessage("logada");
      }
    }

    function aoMudarVisibilidade() {
      if (document.visibilityState === "hidden") {
        const s = armazenamento();
        if (s && !s.getItem(OCULTA_EM)) s.setItem(OCULTA_EM, String(Date.now()));
      } else {
        void conferir();
      }
    }

    // Só o descarregamento de verdade: a página guardada no cache de voltar
    // (`persisted`) volta inteira, e é o `pageshow` abaixo que a confere.
    function aoDescarregar(evento: PageTransitionEvent) {
      if (!evento.persisted) armazenamento()?.setItem(SAIU_EM, String(Date.now()));
    }

    function aoMostrar(evento: PageTransitionEvent) {
      if (evento.persisted) void conferir();
    }

    canalAberto?.addEventListener("message", responder);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    window.addEventListener("pagehide", aoDescarregar);
    window.addEventListener("pageshow", aoMostrar);
    void conferir(true);

    return () => {
      canalAberto?.removeEventListener("message", responder);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("pagehide", aoDescarregar);
      window.removeEventListener("pageshow", aoMostrar);
    };
  }, []);

  return null;
}
