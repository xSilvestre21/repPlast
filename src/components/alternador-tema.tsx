"use client";

import { useSyncExternalStore } from "react";

type Tema = "claro" | "escuro";

/**
 * Script que roda ANTES da primeira pintura.
 *
 * Sem ele a página nasceria no tema padrão e trocaria depois da hidratação —
 * um flash branco a cada carregamento, que é justamente o que mais incomoda
 * em quem usa tema escuro.
 */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('tema');if(t==='claro'||t==='escuro'){document.documentElement.dataset.tema=t}}catch(e){}})()`;

/*
 * O tema mora fora do React: quem manda é o atributo `data-tema` no <html>,
 * porque é ele que o CSS lê. Este pequeno store existe só para os componentes
 * acompanharem essa fonte externa, via `useSyncExternalStore` — que é feito
 * exatamente para isto e resolve a hidratação sem `setState` dentro de efeito.
 */

let ouvintes: (() => void)[] = [];
let cache: Tema | null = null;

function inscrever(aoMudar: () => void) {
  ouvintes.push(aoMudar);
  return () => {
    ouvintes = ouvintes.filter((o) => o !== aoMudar);
  };
}

function lerDoDocumento(): Tema {
  const escolhido = document.documentElement.dataset.tema;
  if (escolhido === "claro" || escolhido === "escuro") return escolhido;

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

/** O valor precisa ser estável entre notificações, daí o cache. */
function instantaneoCliente(): Tema {
  if (cache === null) cache = lerDoDocumento();
  return cache;
}

/** No servidor não há tema: o botão renderiza vazio até hidratar. */
function instantaneoServidor(): null {
  return null;
}

function definirTema(novo: Tema) {
  cache = novo;
  document.documentElement.dataset.tema = novo;

  try {
    localStorage.setItem("tema", novo);
  } catch {
    // Navegador com armazenamento bloqueado: o tema vale só para esta aba.
  }

  for (const aoMudar of ouvintes) aoMudar();
}

export function AlternadorTema() {
  const tema = useSyncExternalStore(inscrever, instantaneoCliente, instantaneoServidor);

  return (
    <button
      type="button"
      onClick={() => definirTema(tema === "claro" ? "escuro" : "claro")}
      aria-label={tema === "claro" ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
      className="grid place-items-center size-9 rounded-full border border-borda vidro text-texto-suave
        hover:text-texto hover:border-borda-forte transition-all duration-200 shrink-0"
    >
      {tema === null ? <span className="size-4" /> : tema === "claro" ? <IconeLua /> : <IconeSol />}
    </button>
  );
}

function IconeSol() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      />
    </svg>
  );
}

function IconeLua() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
      />
    </svg>
  );
}
