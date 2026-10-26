"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Segmentado } from "./ui";

type Tema = "claro" | "escuro";
/** Automático segue o modo claro/escuro do aparelho; os outros fixam. */
type Escolha = "automatico" | Tema;

/**
 * Onde a escolha fica guardada.
 *
 * A chave mudou de `tema` para `tema-escolhido` quando o Automático virou o
 * padrão: quem tinha tocado no sol/lua uma vez ficava preso ao tema para
 * sempre, e no celular com o modo trocado a barra do topo saía de outra cor.
 * Trocar a chave devolveu todo mundo ao Automático de uma vez.
 */
const CHAVE = "tema-escolhido";

/**
 * Script que roda ANTES da primeira pintura.
 *
 * Sem ele a página nasceria no tema padrão e trocaria depois da hidratação —
 * um flash branco a cada carregamento, que é justamente o que mais incomoda
 * em quem usa tema escuro. Apaga também a chave antiga (ver `CHAVE`).
 */
export const SCRIPT_TEMA = `(function(){try{localStorage.removeItem('tema');var t=localStorage.getItem('${CHAVE}');if(t==='claro'||t==='escuro'){document.documentElement.dataset.tema=t}}catch(e){}})()`;

/*
 * O tema mora fora do React: quem manda é o atributo `data-tema` no <html>,
 * porque é ele que o CSS lê — sem ele, valem as regras de
 * `prefers-color-scheme`, e o tema acompanha o aparelho sozinho. Este pequeno
 * store existe só para os componentes acompanharem essa fonte externa, via
 * `useSyncExternalStore`.
 *
 * O instantâneo é um texto ("automatico:escuro"), e não um objeto: o React
 * compara por referência, e um texto igual é igual.
 */

let ouvintes: (() => void)[] = [];
let cache: string | null = null;

function inscrever(aoMudar: () => void) {
  ouvintes.push(aoMudar);
  return () => {
    ouvintes = ouvintes.filter((o) => o !== aoMudar);
  };
}

function lerEscolha(): Escolha {
  const fixado = document.documentElement.dataset.tema;
  return fixado === "claro" || fixado === "escuro" ? fixado : "automatico";
}

function temaDoAparelho(): Tema {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

/** O tema que está na tela: o fixado, ou o do aparelho. */
function lerVisivel(): Tema {
  const escolha = lerEscolha();
  return escolha === "automatico" ? temaDoAparelho() : escolha;
}

function instantaneoCliente(): string {
  cache ??= `${lerEscolha()}:${lerVisivel()}`;
  return cache;
}

/** No servidor não há tema: os controles renderizam vazios até hidratar. */
function instantaneoServidor(): null {
  return null;
}

function avisar() {
  cache = null;
  for (const aoMudar of ouvintes) aoMudar();
}

function definirEscolha(nova: Escolha) {
  if (nova === "automatico") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = nova;

  try {
    if (nova === "automatico") localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, nova);
  } catch {
    // Navegador com armazenamento bloqueado: a escolha vale só para esta aba.
  }

  avisar();
}

/*
 * No cliente, uma vez: o Automático acompanhando o aparelho quando ele troca
 * de modo (a Central de Controle do iPhone, o modo noturno programado). O CSS
 * já troca sozinho; aqui troca o ícone do sol/lua.
 */
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", avisar);
}

function useTemaAtual(): { escolha: Escolha; visivel: Tema } | null {
  const instantaneo = useSyncExternalStore(inscrever, instantaneoCliente, instantaneoServidor);
  if (instantaneo === null) return null;
  const [escolha, visivel] = instantaneo.split(":") as [Escolha, Tema];
  return { escolha, visivel };
}

/** O sol/lua do topo: fixa o tema oposto ao que está na tela. */
export function AlternadorTema() {
  const tema = useTemaAtual();
  const visivel = tema?.visivel ?? null;

  return (
    <button
      type="button"
      onClick={() => definirEscolha(visivel === "claro" ? "escuro" : "claro")}
      aria-label={visivel === "claro" ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
      className="relative alvo-toque grid place-items-center size-8 text-tinta-3 cursor-pointer shrink-0
        transition-colors duration-150 hover:text-carimbo"
    >
      {visivel === null ? (
        <span className="block size-4" />
      ) : visivel === "claro" ? (
        <Moon size={15} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Sun size={15} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * A mesma escolha, por extenso — para Configurações › Preferências, onde quem
 * procura "tema" não acha o ícone do sol lá no alto. Aqui mora o Automático,
 * que o sol/lua não oferece: é por aqui que se volta a seguir o aparelho.
 */
export function EscolhaTema() {
  const tema = useTemaAtual();

  // No servidor não há tema: um espaço do tamanho do controle, até hidratar.
  if (tema === null) return <span className="block h-8" />;

  return (
    <Segmentado
      nome="Tema"
      atual={tema.escolha}
      aoEscolher={definirEscolha}
      opcoes={[
        { valor: "automatico", rotulo: "Automático" },
        { valor: "claro", rotulo: "Claro" },
        { valor: "escuro", rotulo: "Escuro" },
      ]}
    />
  );
}
