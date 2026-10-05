"use client";

/**
 * A visão em tabela de um cartão — a skill de dataviz exige que todo valor de
 * um gráfico seja alcançável sem passar o mouse, e esta é a forma.
 *
 * Cada linha traz a participação no total como uma barrinha embaixo do nome:
 * a tabela continua sendo lida como ranking, e não como planilha.
 */

import Link from "next/link";

import { AreaRolavel } from "@/components/grafico/area-rolavel";

import { moedaDe, porcento } from "@/lib/grafico/formato";

export interface LinhaTabela {
  chave: string;
  rotulo: string;
  /** Centavos. */
  valor: number;
  pedidos?: number;
  href?: string;
  /** A cor da entidade, quando ela tem uma (preposto, indústria). */
  cor?: string;
}

export function TabelaDados({
  linhas,
  rotuloColuna = "Nome",
  teto = 416,
}: {
  linhas: LinhaTabela[];
  rotuloColuna?: string;
  /** Até quantos px a tabela cresce sozinha; daí para cima, rola. */
  teto?: number;
}) {
  const total = linhas.reduce((acc, l) => acc + l.valor, 0);
  const maior = Math.max(1, ...linhas.map((l) => l.valor));
  const comPedidos = linhas.some((l) => l.pedidos !== undefined);

  /*
   * Larguras fixas, iguais na tabela e no rodapé: o nome fica com o que sobra
   * e é cortado com reticências. Em largura automática, um nome comprido
   * alargava a tabela além do cartão e o "%" saía pela borda.
   */
  const colunas = (
    <colgroup>
      <col className="w-9" />
      <col />
      {comPedidos && <col className="w-[4.5rem]" />}
      <col className="w-[7.5rem]" />
      <col className="w-14" />
    </colgroup>
  );

  return (
    <AreaRolavel teto={teto} deLado className="rounded-suave border border-filete">
      {/* Abaixo disto, rola de lado em vez de espremer o nome a nada. */}
      <table className="w-full min-w-[24rem] table-fixed text-corpo border-collapse">
        {colunas}
        <thead className="sticky top-0 z-10 bg-folha-2 text-mini text-tinta-3">
          <tr>
            <th className="text-left font-medium px-3 py-2">#</th>
            <th className="text-left font-medium px-3 py-2">{rotuloColuna}</th>
            {comPedidos && <th className="text-right font-medium px-3 py-2">Pedidos</th>}
            <th className="text-right font-medium px-3 py-2">Comissão</th>
            <th className="text-right font-medium px-3 py-2">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-filete">
          {linhas.map((linha, i) => (
            <tr key={linha.chave} className="hover:bg-folha-2 transition-colors">
              <td className="px-3 py-2 text-mini text-tinta-3 numerico">{i + 1}</td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2 min-w-0">
                  {linha.cor && (
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: linha.cor }}
                    />
                  )}
                  {linha.href ? (
                    <Link href={linha.href} className="truncate hover:text-carimbo transition-colors">
                      {linha.rotulo}
                    </Link>
                  ) : (
                    <span className="truncate">{linha.rotulo}</span>
                  )}
                </span>
                <span className="block h-1 mt-1.5 rounded-full bg-folha-2 overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(linha.valor / maior) * 100}%`,
                      background: linha.cor ?? "var(--grafico-1)",
                    }}
                  />
                </span>
              </td>
              {comPedidos && (
                <td className="px-3 py-2 text-right numerico text-tinta-2">{linha.pedidos ?? "—"}</td>
              )}
              <td className="px-3 py-2 text-right numerico font-medium whitespace-nowrap">
                {moedaDe(linha.valor)}
              </td>
              <td className="px-3 py-2 text-right numerico text-mini text-tinta-3">
                {total > 0 ? porcento(linha.valor / total) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        O total fora da tabela, empurrado para o pé da moldura (`mt-auto`):
        com o cartão esticado ao lado de um vizinho mais alto, ele fecha a
        moldura embaixo em vez de ficar no meio, com um vão vazio depois.
      */}
      <table className="w-full min-w-[24rem] table-fixed text-corpo border-collapse mt-auto sticky bottom-0">
        {colunas}
        <tbody>
          <tr className="bg-folha-2 font-semibold">
            <td className="px-3 py-2" />
            <td className="px-3 py-2 truncate">Total · {linhas.length}</td>
            {comPedidos && <td />}
            <td className="px-3 py-2 text-right numerico whitespace-nowrap">{moedaDe(total)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </AreaRolavel>
  );
}
