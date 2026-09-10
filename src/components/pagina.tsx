import { ViewTransition } from "react";
import type { ReactNode } from "react";

/**
 * Direção do deslize, decidida pelo tipo que o link da barra carrega.
 *
 * `default: "none"` é o que impede este bloco de animar em transições que não
 * são troca de aba — voltar pelo botão do navegador, `router.refresh()`, um
 * `<Suspense>` resolvendo. Sem isso, qualquer atualização da tela deslizaria.
 */
const DIRECOES = {
  "nav-direita": "nav-direita",
  "nav-esquerda": "nav-esquerda",
  default: "none",
} as const;

/**
 * Envelope de conteúdo de página.
 *
 * Precisa ficar em cada `page.tsx`, e não no layout: layout persiste entre
 * navegações, então entrada e saída nunca disparariam lá. É o preço de ter a
 * barra do topo parada enquanto o conteúdo troca.
 */
export function Pagina({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECOES} exit={DIRECOES} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
