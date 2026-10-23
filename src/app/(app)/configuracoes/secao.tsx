/**
 * As peças de servidor da página de Configurações: a seção e o item que a busca
 * enxerga. Fora de `secoes.tsx` porque aquele é `'use client'`, e estas só
 * desenham — os cartões dentro delas continuam sendo do servidor.
 *
 * A busca (`secoes.tsx`) lê o texto do item inteiro — título, descrição,
 * rótulos e dicas — e, além dele, `busca`: as palavras que a pessoa procura e
 * que o cartão não escreve ("login" no cartão do e-mail, "ICMS" nas condições).
 */

import type { ReactNode } from "react";

export function SecaoConfiguracao({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    // `scroll-mt`: a âncora do índice para abaixo da barra do topo, que é fixa.
    <section id={id} data-secao={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20 space-y-4">
      <h2 id={`${id}-titulo`} className="rotulo uppercase tracking-[0.06em]">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function ItemConfiguracao({ busca, children }: { busca: string; children: ReactNode }) {
  return <div data-busca={busca}>{children}</div>;
}
