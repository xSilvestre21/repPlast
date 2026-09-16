import Link from "next/link";

import { curvaAbc, type Banda, type ItemBarra } from "@/lib/grafico/geometria";
import { FORMATO } from "@/lib/grafico/formato";
import { BANDAS } from "@/lib/grafico/paleta";

import { GraficoCursor, type PontoInterativo } from "./grafico-cursor";
import { GraficoRealce } from "./grafico-realce";

const NOME_DA_BANDA: Record<Banda, string> = {
  A: "Não pode perder",
  B: "Sustentam o mês",
  C: "Cauda longa",
};

/**
 * Curva ABC — quem sustenta a carteira, pelo nome.
 *
 * A primeira versão deste cartão mostrava a manchete, a curva e as três faixas
 * com contagem e total — e **não dizia quem era quem**. Saber que existem 17
 * clientes na faixa A não ajuda ninguém: a pergunta é *quais*, porque é para
 * esses que se liga antes do fim do mês.
 *
 * Então a lista é o conteúdo principal, e a curva virou uma faixa de contexto:
 * ela mostra o FORMATO da concentração — sobe rápido, o escritório depende de
 * poucos; sobe devagar, a carteira é pulverizada — e passar o mouse por ela diz
 * qual cliente está naquele ponto.
 *
 * O mesmo contrato das barras: nada é cortado, o número sai impresso, o
 * contêiner rola.
 */
export function GraficoAbc({
  itens,
  substantivo = "clientes",
  substantivoSingular = "cliente",
}: {
  itens: ItemBarra[];
  substantivo?: string;
  substantivoSingular?: string;
}) {
  const { itens: classificados, total, curva, contagem, vitais } = curvaAbc(itens);

  if (classificados.length === 0) return null;

  const moeda = FORMATO.moeda;
  const unidade = classificados.length === 1 ? substantivoSingular : substantivo;

  const participacaoDosVitais = classificados
    .filter((item) => item.banda === "A")
    .reduce((soma, item) => soma + item.participacao, 0);

  /*
   * As coordenadas vêm de `curvaAbc` — a função já as calculava para desenhar o
   * caminho e as jogava fora. Sem elas a curva é uma linha que não se liga a
   * cliente nenhum, que era metade do problema deste cartão.
   */
  const interativos: PontoInterativo[] = classificados.map((item) => ({
    x: item.x,
    titulo: item.rotulo,
    href: item.href,
    marcas: [
      {
        y: 100 - item.acumulado,
        texto: moeda(item.valor),
        rotulo: "Comissão",
        cor: BANDAS[item.banda],
      },
    ],
    extras: [
      { rotulo: "Acumulado", texto: `${item.acumulado.toFixed(0)}%` },
      { rotulo: "Faixa", texto: `${item.banda} · ${NOME_DA_BANDA[item.banda]}` },
    ],
  }));

  return (
    <div>
      <p className="text-realce text-tinta mb-4">
        <strong className="cifra text-forte">{vitais}</strong>
        {` de ${classificados.length} ${unidade} fazem `}
        <strong className="numerico">{participacaoDosVitais.toFixed(0)}%</strong>
        {" da comissão."}
      </p>

      <div className="relative">
        <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
          <div className="regra" />
          <div className="regra" />
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="relative w-full h-20 overflow-visible"
          role="img"
          aria-label={`Curva de concentração: ${vitais} de ${classificados.length} ${substantivo} fazem ${participacaoDosVitais.toFixed(0)}% do total`}
        >
          <path d={`${curva} L100,100 Z`} fill={BANDAS.A} opacity={0.1} />
          <path
            d={curva}
            fill="none"
            stroke={BANDAS.A}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <GraficoCursor
          pontos={interativos}
          rotuloDaArea={`Curva de concentração — use as setas para percorrer os ${classificados.length} ${substantivo}`}
        />
      </div>

      <div className="flex justify-between text-micro text-tinta-3 mt-2 mb-4">
        <span>1º</span>
        <span>{classificados.length}º</span>
      </div>

      {/* A lista é o conteúdo: é ela que responde "quais". */}
      <GraficoRealce
        rodapePadrao={
          <>
            <span className="flex flex-wrap gap-x-3">
              {(["A", "B", "C"] as const)
                .filter((banda) => contagem[banda] > 0)
                .map((banda) => (
                  <span key={banda} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: BANDAS[banda] }}
                    />
                    {banda} {contagem[banda]} · {NOME_DA_BANDA[banda]}
                  </span>
                ))}
            </span>
            <span className="numerico">Total {moeda(total)}</span>
          </>
        }
      >
        {/*
          Sem este cabeçalho a última coluna é um "18%" solto, que se lê como
          fatia do cliente quando é o ACUMULADO até ele — o número que diz onde
          os 80% fecham.
        */}
        <div className="flex items-center gap-2.5 px-1 pt-3 regra text-micro text-tinta-3">
          {/* As duas primeiras colunas ficam sem rótulo: a letra com a cor já se
              explica, e a legenda das faixas está no rodapé. "Faixa" escrito
              aqui não cabe em três caracteres e encosta em "Cliente". */}
          <span className="size-2.5 shrink-0" aria-hidden="true" />
          <span className="w-3" aria-hidden="true" />
          <span className="flex-1">Cliente</span>
          <span>Comissão</span>
          <span className="w-11 text-right">Acum.</span>
        </div>

        <ul className="max-h-80 overflow-y-auto pr-2 space-y-0.5 mt-1">
          {classificados.map((item) => {
            const linha = (
              <>
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full shrink-0"
                  style={{ background: BANDAS[item.banda] }}
                />
                <span className="text-tinta font-medium w-3">{item.banda}</span>
                <span
                  title={item.rotulo}
                  className="flex-1 min-w-0 truncate text-corpo text-tinta-2"
                >
                  {item.rotulo}
                </span>
                <span className="numerico text-corpo text-tinta font-medium whitespace-nowrap">
                  {moeda(item.valor)}
                </span>
                {/* O acumulado é o que transforma a lista em curva ABC: diz
                    onde os 80% fecham sem ninguém ter que somar. */}
                <span className="numerico text-mini text-tinta-3 w-11 text-right">
                  {item.acumulado.toFixed(0)}%
                </span>
              </>
            );

            return (
              <li
                key={item.chave}
                data-balao={item.detalhe}
                className="relative rounded-suave transition-colors
                  hover:bg-folha-2 has-[a:focus-visible]:bg-folha-2"
              >
                <div className="flex items-center gap-2.5 py-1.5 px-1">
                  {linha}
                  {item.href && (
                    <Link
                      href={item.href}
                      className="absolute inset-0 rounded-suave outline-none
                        focus-visible:ring-4 focus-visible:ring-carimbo-fraco"
                    >
                      <span className="sr-only">Abrir {item.rotulo}</span>
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </GraficoRealce>
    </div>
  );
}
