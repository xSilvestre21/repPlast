"use client";

/**
 * Uma lista longa que rola DENTRO do cartão — e que cresce quando o cartão é
 * esticado pelo vizinho.
 *
 * Um `max-h` fixo resolvia só a primeira metade: ao lado de um cartão mais
 * alto, a lista parava no teto dela e sobrava um vão vazio embaixo. Aqui a
 * altura natural é "o conteúdo, até o teto", e a partir dela a área cresce
 * com `flex-1` até onde o cartão for. Base zero: o que a área conta para a
 * altura do cartão é só a altura natural, nunca a lista inteira.
 *
 * CSS não sabe fazer `min(conteúdo, teto)`, então o conteúdo vem de um de dois
 * jeitos:
 *  - `conteudo` informado (um gráfico de barras sabe a própria altura): o
 *    gráfico lá dentro pode crescer junto com a área;
 *  - sem ele, a área MEDE o conteúdo: a soma da altura dos filhos. Eles
 *    não esticam (um rodapé desce com `mt-auto`, que é margem, não altura),
 *    então a soma é sempre a altura natural — medir a caixa que estica faria
 *    a medida acompanhar a própria área, e o teto nunca mais baixaria.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function AreaRolavel({
  teto,
  conteudo,
  deLado = false,
  className = "",
  children,
}: {
  /** Altura máxima natural, em px — daí para cima, rola. */
  teto: number;
  /** A altura do conteúdo, em px, quando já se sabe. */
  conteudo?: number;
  /** Rola também na horizontal — tabela larga no celular. Gráfico nunca. */
  deLado?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const externo = useRef<HTMLDivElement>(null);
  const interno = useRef<HTMLDivElement>(null);
  const [medido, setMedido] = useState(teto);
  // A borda (e a barra de rolagem lateral) moram na área, por fora do
  // conteúdo: sem somá-las, a altura mínima cortava a última linha.
  const [moldura, setMoldura] = useState(0);

  // Sem dependências de propósito: os filhos mudam a cada troca de visão ou
  // de período, e cada um precisa ser observado de novo.
  useLayoutEffect(() => {
    const fora = externo.current;
    const dentro = interno.current;
    if (!fora || !dentro) return;
    const filhos = [...dentro.children] as HTMLElement[];
    const medir = () => {
      setMoldura(fora.offsetHeight - fora.clientHeight);
      if (conteudo === undefined) setMedido(filhos.reduce((acc, f) => acc + f.offsetHeight, 0));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(fora);
    for (const filho of filhos) observador.observe(filho);
    return () => observador.disconnect();
  });

  const altura = conteudo ?? medido;
  const natural = Math.min(teto, altura) + moldura;

  /*
   * Só rola o que passa do teto. Com `overflow-y-auto` sempre ligado, um
   * gráfico que cresce até a borda da área ficava a um pixel de transbordar,
   * a barra de rolagem aparecia, estreitava o gráfico, e surgia outra na
   * horizontal — duas barras fantasma num conteúdo que cabia inteiro.
   */
  const rola = altura > teto;

  return (
    <div
      ref={externo}
      className={`flex-1 basis-0 flex flex-col ${deLado ? "overflow-x-auto" : "overflow-x-hidden"} ${
        rola ? "overflow-y-auto" : "overflow-y-hidden"
      } ${className}`}
      style={{ minHeight: natural }}
    >
      {/*
        `min-h-0`: sem ele, o conteúdo esticado uma vez não encolhia mais —
        item flex não fica menor que o próprio conteúdo, e o gráfico guarda a
        altura em px até o próximo resize. O cartão ficava preso alto.
      */}
      <div ref={interno} className="flex-1 min-h-0 flex flex-col">
        {children}
      </div>
    </div>
  );
}
