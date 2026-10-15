"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { chegarPagina } from "./viagem";

/**
 * Envelope de conteúdo de página.
 *
 * Precisa ficar em cada `page.tsx` (e no `loading.tsx`), e não no layout:
 * layout persiste entre navegações, e a entrada só acontece no que MONTA. É o
 * preço de ter a barra do topo parada enquanto o conteúdo troca.
 *
 * Depois de um clique numa aba, a primeira página a montar entra deslizando
 * pelo lado da aba (`chegarPagina`, em `viagem.ts`). Sem clique — a primeira
 * carga, o botão de voltar, um `router.refresh()` — ela só aparece. Nenhuma
 * transição deste sistema ganha movimento vertical.
 */
export function Pagina({ children }: { children: ReactNode }) {
  const pagina = useRef<HTMLDivElement>(null);

  // De layout, antes da pintura: o primeiro quadro da página nova já é o do
  // começo da entrada, e não um piscar dela no lugar final.
  useLayoutEffect(() => {
    if (pagina.current) chegarPagina(pagina.current);
  }, []);

  return <div ref={pagina}>{children}</div>;
}
