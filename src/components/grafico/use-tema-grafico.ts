"use client";

import { useMemo, useSyncExternalStore } from "react";

import { CORES_NEUTRAS, lerCores, type CoresDoGrafico } from "@/lib/grafico/tema-echarts";

/**
 * As cores dos gráficos, acompanhando o tema da página.
 *
 * O tema muda por dois caminhos: o atributo `data-tema` no <html> (o
 * alternador) e a preferência do sistema, quando ninguém escolheu. Os dois são
 * fontes externas ao React, daí `useSyncExternalStore` — a mesma escolha do
 * `alternador-tema.tsx`, que resolve a hidratação sem efeito com `setState`.
 */
function inscrever(aoMudar: () => void) {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });

  const sistema = window.matchMedia("(prefers-color-scheme: dark)");
  sistema.addEventListener("change", aoMudar);

  return () => {
    observador.disconnect();
    sistema.removeEventListener("change", aoMudar);
  };
}

/** Uma chave estável: muda só quando o tema efetivo pode ter mudado. */
function chave() {
  const escolhido = document.documentElement.dataset.tema ?? "";
  const escuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return `${escolhido}|${escuro}`;
}

export function useTemaGrafico(): CoresDoGrafico {
  const atual = useSyncExternalStore(inscrever, chave, () => "servidor");

  // As cores são relidas do CSS só quando a chave muda — ler o estilo
  // computado a cada render custaria um recálculo de estilo por gráfico.
  return useMemo(() => (atual === "servidor" ? CORES_NEUTRAS : lerCores()), [atual]);
}
