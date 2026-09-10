"use client";

import { Moon, Sun } from "lucide-react";
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
      className="grid place-items-center size-8 text-tinta-3 cursor-pointer shrink-0
        transition-colors duration-150 hover:text-carimbo"
    >
      {tema === null ? (
        <span className="block size-4" />
      ) : tema === "claro" ? (
        <Moon size={15} strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Sun size={15} strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}
