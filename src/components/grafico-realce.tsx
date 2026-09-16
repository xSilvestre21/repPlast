"use client";

import { useState, type ReactNode } from "react";

/**
 * Realce de linha sobre uma lista que o SERVIDOR renderizou.
 *
 * A lista entra por `children` já pronta — é isso que mantém as barras no HTML
 * inicial. Se esta ilha as renderizasse, o conteúdo principal da aba passaria a
 * depender de JavaScript para existir, e a página pararia de servir para quem
 * abre com a rede ruim dentro do carro.
 *
 * **O detalhe aparece no RODAPÉ, não num balão flutuante.** A primeira versão
 * usava balão, e ele cobria a linha seguinte: apontar para um cliente escondia
 * o nome do próximo, que é o oposto do que este gráfico existe para fazer. O
 * rodapé já está na tela, tem altura fixa e é sempre o mesmo lugar — o olho
 * aprende onde olhar em vez de perseguir uma caixa.
 *
 * A comunicação é por atributo: cada linha carrega `data-balao` com o que
 * mostrar. A ilha não sabe o que é uma barra, um cliente ou uma comissão —
 * sabe ler `data-balao` do que estiver sob o ponteiro.
 */
export function GraficoRealce({
  children,
  rodapePadrao,
}: {
  children: ReactNode;
  /**
   * O que o rodapé mostra quando nada está sob o ponteiro.
   *
   * Vem pronto do servidor como nó, e não como função: função não atravessa a
   * fronteira servidor→cliente.
   */
  rodapePadrao: ReactNode;
}) {
  const [detalhe, definirDetalhe] = useState<string | null>(null);

  function aoMover(evento: React.PointerEvent<HTMLDivElement>) {
    const linha = (evento.target as HTMLElement).closest<HTMLElement>("[data-balao]");
    const texto = linha?.dataset.balao ?? null;

    // Só re-renderiza ao TROCAR de linha, não a cada pixel percorrido.
    if (texto !== detalhe) definirDetalhe(texto);
  }

  return (
    <div onPointerMove={aoMover} onPointerLeave={() => definirDetalhe(null)}>
      {children}

      <p className="text-mini text-tinta-3 mt-3 pt-3 regra flex justify-between gap-3 min-h-[1.75rem]">
        {detalhe ? <span className="text-tinta-2">{detalhe}</span> : rodapePadrao}
      </p>
    </div>
  );
}
