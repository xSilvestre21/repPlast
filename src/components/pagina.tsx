import { ViewTransition } from "react";
import type { ReactNode } from "react";

/**
 * Direção do deslize, decidida pelo tipo que o link da barra carrega.
 *
 * `default: "none"` é o que impede este bloco de animar em transições que não
 * são troca de aba — voltar pelo botão do navegador, `router.refresh()`.
 */
export const DIRECOES = {
  "nav-direita-perto": "nav-direita-perto",
  "nav-direita-media": "nav-direita-media",
  "nav-direita-longe": "nav-direita-longe",
  "nav-esquerda-perto": "nav-esquerda-perto",
  "nav-esquerda-media": "nav-esquerda-media",
  "nav-esquerda-longe": "nav-esquerda-longe",
  default: "none",
} as const;

/**
 * Envelope de conteúdo de página.
 *
 * Precisa ficar em cada `page.tsx`, e não no layout: layout persiste entre
 * navegações, então entrada e saída nunca disparariam lá. É o preço de ter a
 * barra do topo parada enquanto o conteúdo troca.
 *
 * Entrada usa o mesmo `DIRECOES` da saída — de propósito. O conteúdo real
 * substituindo o esqueleto de `loading.tsx` já não carrega tipo nenhum (é uma
 * revelação do Suspense, não uma navegação), então cai no `default: "none"` e
 * só troca sem animar. O deslize horizontal fica reservado para quando a aba
 * muda de verdade; nenhuma transição deste sistema ganha movimento vertical.
 */
export function Pagina({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECOES} exit={DIRECOES} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
