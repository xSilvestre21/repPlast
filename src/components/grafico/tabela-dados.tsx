"use client";

/**
 * A visão em tabela de um cartão — a skill de dataviz exige que todo valor de
 * um gráfico seja alcançável sem passar o mouse, e esta é a forma.
 *
 * Cada linha traz a participação no total como uma barrinha embaixo do nome:
 * a tabela continua sendo lida como ranking, e não como planilha.
 */

import Link from "next/link";

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
  alturaMaxima = "max-h-[26rem]",
}: {
  linhas: LinhaTabela[];
  rotuloColuna?: string;
  alturaMaxima?: string;
}) {
  const total = linhas.reduce((acc, l) => acc + l.valor, 0);
  const maior = Math.max(1, ...linhas.map((l) => l.valor));

  return (
    <div className={`overflow-auto rounded-suave border border-filete ${alturaMaxima}`}>
      <table className="w-full text-corpo border-collapse">
        <thead className="sticky top-0 bg-folha-2 text-mini text-tinta-3">
          <tr>
            <th className="text-left font-medium px-3 py-2 w-8">#</th>
            <th className="text-left font-medium px-3 py-2">{rotuloColuna}</th>
            {linhas.some((l) => l.pedidos !== undefined) && (
              <th className="text-right font-medium px-3 py-2">Pedidos</th>
            )}
            <th className="text-right font-medium px-3 py-2">Comissão</th>
            <th className="text-right font-medium px-3 py-2 w-16">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-filete">
          {linhas.map((linha, i) => (
            <tr key={linha.chave} className="hover:bg-folha-2 transition-colors">
              <td className="px-3 py-2 text-mini text-tinta-3 numerico">{i + 1}</td>
              <td className="px-3 py-2 min-w-0">
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
              {linhas.some((l) => l.pedidos !== undefined) && (
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
        <tfoot className="sticky bottom-0 bg-folha-2 font-semibold">
          <tr>
            <td className="px-3 py-2" />
            <td className="px-3 py-2">Total · {linhas.length}</td>
            {linhas.some((l) => l.pedidos !== undefined) && <td />}
            <td className="px-3 py-2 text-right numerico whitespace-nowrap">{moedaDe(total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
