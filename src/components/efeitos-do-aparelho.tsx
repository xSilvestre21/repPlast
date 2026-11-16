"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import {
  CHAVE_EFEITOS,
  CHAVE_MEDIDO,
  VALIDADE_DA_MEDICAO,
  type EscolhaDeEfeitos,
  janelaLenta,
  vereditoDaMedicao,
} from "./efeitos";
import { Segmentado } from "./ui";

/*
 * Como o tema: quem manda é o atributo `data-efeitos` no <html>, que o CSS lê
 * e que o script do layout raiz já deixou pronto antes da primeira pintura
 * (`SCRIPT_EFEITOS`, em `efeitos.ts`). Este store só deixa os componentes
 * acompanharem essa fonte externa.
 */

let ouvintes: (() => void)[] = [];
let cache: string | null = null;

function inscrever(aoMudar: () => void) {
  ouvintes.push(aoMudar);
  return () => {
    ouvintes = ouvintes.filter((o) => o !== aoMudar);
  };
}

function avisar() {
  cache = null;
  for (const aoMudar of ouvintes) aoMudar();
}

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    // Armazenamento bloqueado: vale o que o aparelho declara, sem lembrança.
    return null;
  }
}

function lerEscolha(): EscolhaDeEfeitos {
  const escolha = ler(CHAVE_EFEITOS);
  return escolha === "leves" || escolha === "completos" ? escolha : "automatico";
}

/** A medição já concluiu, neste navegador, que o aparelho pede os efeitos leves? */
function medidoComoLeve(): boolean {
  const [veredito, quando] = (ler(CHAVE_MEDIDO) ?? "").split(":");
  return veredito === "leves" && Date.now() - Number(quando) < VALIDADE_DA_MEDICAO;
}

/** O aparelho que se declara pequeno: nem vale esperar a medição. */
function aparelhoPequeno(): boolean {
  const { hardwareConcurrency: nucleos } = navigator;
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (nucleos > 0 && nucleos <= 2) || (memoria !== undefined && memoria > 0 && memoria <= 2);
}

/** Põe no <html> o que vale agora — a mesma conta do `SCRIPT_EFEITOS`. */
function aplicar() {
  const escolha = lerEscolha();
  const leves = escolha === "leves" || (escolha === "automatico" && (medidoComoLeve() || aparelhoPequeno()));

  if (leves) document.documentElement.dataset.efeitos = "leves";
  else delete document.documentElement.dataset.efeitos;

  avisar();
}

function definirEscolha(nova: EscolhaDeEfeitos) {
  try {
    if (nova === "automatico") localStorage.removeItem(CHAVE_EFEITOS);
    else localStorage.setItem(CHAVE_EFEITOS, nova);
  } catch {
    // Armazenamento bloqueado: a escolha não tem onde ficar.
  }
  aplicar();
}

function instantaneoCliente(): string {
  cache ??= `${lerEscolha()}:${document.documentElement.dataset.efeitos === "leves" ? "leves" : "completos"}`;
  return cache;
}

/** No servidor não há aparelho: o controle renderiza vazio até hidratar. */
function instantaneoServidor(): null {
  return null;
}

/**
 * A escolha por extenso, em Configurações › Preferências.
 *
 * Automático é o padrão e mede sozinho; Leves e Completos fixam, para quem
 * discorda da medição — e para comparar os dois no mesmo aparelho.
 */
export function EscolhaEfeitos() {
  const instantaneo = useSyncExternalStore(inscrever, instantaneoCliente, instantaneoServidor);

  // Mesma altura do controle pronto, para a seção não pular ao hidratar.
  if (instantaneo === null) return <div className="h-14" />;

  const [escolha, valendo] = instantaneo.split(":") as [EscolhaDeEfeitos, "leves" | "completos"];

  return (
    <div>
      <Segmentado
        nome="Efeitos visuais neste aparelho"
        atual={escolha}
        aoEscolher={definirEscolha}
        opcoes={[
          { valor: "automatico", rotulo: "Automático" },
          { valor: "completos", rotulo: "Completos" },
          { valor: "leves", rotulo: "Leves" },
        ]}
      />
      <p className="text-mini text-tinta-3 mt-3" aria-live="polite">
        {escolha === "automatico"
          ? valendo === "leves"
            ? "Neste aparelho o Automático está usando os efeitos leves."
            : "Neste aparelho o Automático está usando os efeitos completos."
          : valendo === "leves"
            ? "Efeitos leves fixados neste navegador."
            : "Efeitos completos fixados neste navegador."}
      </p>
    </div>
  );
}

/** Quanto dura cada janela de medição: a entrada de uma página, com folga. */
const DURACAO_DA_JANELA = 2000;

/** As janelas desta carga da página. Recomeça a cada recarga — é barato. */
let janelas: boolean[] = [];
let encerrada = false;

/** Só o Automático mede, e só enquanto ainda não concluiu nada. */
function deveMedir(): boolean {
  return !encerrada && lerEscolha() === "automatico" && document.documentElement.dataset.efeitos !== "leves";
}

/**
 * Mede os quadros de uma janela e devolve como cancelar.
 *
 * Aba escondida não desenha quadro nenhum — o intervalo enorme que sairia daí
 * não é lentidão, então a janela é descartada inteira.
 */
function medirJanela(aoTerminar: (lenta: boolean | null) => void): () => void {
  if (document.visibilityState !== "visible") return () => {};

  const intervalos: number[] = [];
  let ultimo = performance.now();
  const inicio = ultimo;
  let quadro = 0;
  let descartada = false;

  const escondeu = () => {
    descartada = true;
  };
  document.addEventListener("visibilitychange", escondeu);

  const passo = (agora: number) => {
    intervalos.push(agora - ultimo);
    ultimo = agora;
    if (agora - inicio < DURACAO_DA_JANELA) {
      quadro = requestAnimationFrame(passo);
      return;
    }
    document.removeEventListener("visibilitychange", escondeu);
    aoTerminar(descartada ? null : janelaLenta(intervalos));
  };
  quadro = requestAnimationFrame(passo);

  return () => {
    cancelAnimationFrame(quadro);
    document.removeEventListener("visibilitychange", escondeu);
  };
}

/**
 * Mede o aparelho em uso, sem aparecer na tela.
 *
 * A cada página que abre, conta os quadros dos dois primeiros segundos — é
 * quando a entrada da página anima por cima dos desfoques. Três janelas lentas
 * e o aparelho passa aos efeitos leves, lembrado neste navegador por um mês;
 * seis boas antes disso e a medição se encerra até a próxima carga.
 *
 * Fica no layout raiz, que não remonta: o `usePathname` é o que avisa de cada
 * troca de página.
 */
export function MedidorDeEfeitos() {
  const caminho = usePathname();

  useEffect(() => {
    if (!deveMedir()) return;

    return medirJanela((lenta) => {
      if (lenta === null || !deveMedir()) return;
      janelas = [...janelas, lenta];

      const veredito = vereditoDaMedicao(janelas);
      if (veredito === null) return;

      encerrada = true;
      if (veredito !== "leves") return;
      try {
        localStorage.setItem(CHAVE_MEDIDO, `leves:${Date.now()}`);
      } catch {
        // Sem armazenamento, vale só para esta carga.
      }
      aplicar();
    });
  }, [caminho]);

  return null;
}
