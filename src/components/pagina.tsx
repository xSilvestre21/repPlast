import { ViewTransition } from "react";
import type { ReactNode } from "react";

/**
 * Direção do deslize, decidida pelo tipo que o link da barra carrega.
 *
 * `default: "none"` é o que impede este bloco de animar em transições que não
 * são troca de aba — voltar pelo botão do navegador, `router.refresh()`.
 */
export const DIRECOES = {
  "nav-direita": "nav-direita",
  "nav-esquerda": "nav-esquerda",
  default: "none",
} as const;

/**
 * Na ENTRADA o padrão não é "nada": é subir.
 *
 * Trocar de aba tem tipo, e o tipo manda — o conteúdo entra pelo lado. Mas
 * existe uma segunda entrada, sem tipo nenhum: a hora em que o conteúdo real
 * substitui o esqueleto que `loading.tsx` mostrou. Essa é a única transição do
 * sistema em que o bloco velho e o novo ocupam o MESMO lugar, e é ela que
 * ganha o movimento vertical.
 */
const ENTRADA = {
  ...DIRECOES,
  default: "revezar-entra",
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
    <ViewTransition enter={ENTRADA} exit={DIRECOES} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
