import Link from "next/link";
import type { CSSProperties } from "react";

import { barrasRanqueadas, type ItemBarra } from "@/lib/grafico/geometria";
import { FORMATO, type Unidade } from "@/lib/grafico/formato";

import { GraficoRealce } from "./grafico-realce";

/**
 * Barras ranqueadas — o gráfico que não corta.
 *
 * É a correção de um defeito concreto do sistema anterior: com trinta clientes
 * no eixo, tudo ficava cortado. A causa era o gráfico ter altura fixa e as
 * barras se espremerem para caber nela. Aqui a lógica é a inversa.
 *
 *  1. A linha tem altura fixa e o GRÁFICO cresce. Nunca se espreme nada.
 *  2. No tamanho padrão não há corte nenhum: as treze linhas cabem inteiras.
 *     O contêiner só ganha teto quando a lista completa é aberta — e aí quem
 *     rola é ele, nunca a página.
 *  3. O número sai impresso no fim de toda linha. Ninguém mede barra contra
 *     eixo para saber quanto foi; a barra é só a comparação.
 *  4. O padrão é o topo mais uma linha juntando o resto. Cinquenta e cinco
 *     barras de tamanho parecido não são informação.
 *  5. Barra tem largura mínima, para valor pequeno continuar sendo uma marca
 *     visível em vez de nada.
 *  6. Abaixo de 640px o rótulo sobe para cima da barra, em vez de disputar
 *     largura com ela.
 *
 * A cor é uma só. As barras medem todas a mesma coisa, e pintar cada uma de um
 * tom diria que as categorias diferem em natureza — "a cor nunca decora".
 *
 * A lista continua sendo montada no SERVIDOR e entra em `GraficoRealce` por
 * `children`: o conteúdo principal da aba não pode depender de JavaScript para
 * aparecer. A ilha só acrescenta o realce da linha e troca o rodapé pelo
 * detalhe dela.
 */

/** Mesmo o menor valor da série continua sendo uma marca visível. */
const LARGURA_MINIMA = "2px";

export function GraficoBarras({
  itens,
  teto = 12,
  rotuloResiduo = "Outros",
  unidade = "moeda",
  alturaMaxima,
  mostrarTotal = true,
}: {
  itens: ItemBarra[];
  /** Quantas linhas antes de juntar o resto. `Infinity` mostra todas. */
  teto?: number;
  rotuloResiduo?: string;
  /** O NOME da unidade, não a função: função não atravessa para a ilha. */
  unidade?: Unidade;
  /**
   * Teto do contêiner, para a lista longa não empurrar a página inteira.
   *
   * Sem valor a lista se desenha por completo, que é o certo no tamanho
   * padrão: cortar treze linhas num contêiner de doze esconderia justamente a
   * linha "Outros", e a esconderia SEM AVISO.
   */
  alturaMaxima?: string;
  /** Somar não faz sentido em toda unidade: "3.456 dias" não é um número. */
  mostrarTotal?: boolean;
}) {
  const ranking = barrasRanqueadas(itens, { teto, rotuloResiduo });
  const formatar = FORMATO[unidade];

  if (ranking.linhas.length === 0) return null;

  return (
    <div>
      <GraficoRealce
        rodapePadrao={
          <>
            <span>
              {ranking.agrupados > 0
                ? `${teto} de ${ranking.itens}`
                : `${ranking.itens} ${ranking.itens === 1 ? "item" : "itens"}`}
            </span>
            {mostrarTotal && (
              <span className="numerico">Total {formatar(ranking.total)}</span>
            )}
          </>
        }
      >
        <ul
          /*
           * A barra de rolagem fica VISÍVEL de propósito. `rolagem-limpa` serve
           * para a fila de abas, onde é óbvio que há mais de lado; aqui ela é o
           * único sinal de que a lista continua — escondê-la recriaria o defeito
           * que este componente existe para corrigir.
           */
          className={`space-y-1 ${alturaMaxima ? `${alturaMaxima} overflow-y-auto pr-2` : ""}`}
          aria-label="Valores por item, do maior para o menor"
        >
          {ranking.linhas.map((linha) => {
            /*
             * O que o rodapé acrescenta é o que NÃO está impresso na linha:
             * quantos pedidos e quanto por cento do total. O valor em reais
             * continua visível o tempo todo — o detalhe nunca o substitui.
             */
            const detalhe = [linha.detalhe, `${linha.participacao.toFixed(1)}% do total`]
              .filter(Boolean)
              .join(" · ");

            const conteudo = (
              <>
                {/*
                  `min-w-0` é o que deixa o `truncate` funcionar dentro da grade:
                  sem ele a coluna cresce até caber o nome inteiro e empurra a
                  barra para fora — que é, literalmente, o corte antigo.
                */}
                <span
                  title={linha.rotulo}
                  className={`min-w-0 truncate text-corpo ${
                    linha.residuo ? "text-tinta-3 italic" : "text-tinta-2"
                  }`}
                >
                  {linha.rotulo}
                </span>

                <span
                  className="numerico text-corpo text-tinta font-medium whitespace-nowrap text-right
                    col-start-2 row-start-1 sm:col-start-3 sm:row-start-1"
                >
                  {formatar(linha.valor)}
                </span>

                {/* No celular a barra ocupa a linha inteira, abaixo do rótulo. */}
                <div
                  className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1
                    h-2.5 rounded-full bg-folha-2 overflow-hidden"
                >
                  <div
                    className="h-full rounded-full barra-preenche"
                    style={
                      {
                        "--alvo": `${linha.proporcao}%`,
                        minWidth: LARGURA_MINIMA,
                        // O resto é resíduo, não um par das barras de cima: some
                        // de tom em vez de competir com elas por atenção.
                        background: linha.residuo
                          ? "var(--tinta-3)"
                          : "var(--placa-lilas-traco)",
                      } as CSSProperties
                    }
                  />
                </div>
              </>
            );

            const grade =
              "grid items-center gap-x-3 gap-y-1 py-1 sm:py-0 sm:h-7 " +
              "grid-cols-[1fr_auto] sm:grid-cols-[minmax(6rem,11rem)_1fr_auto]";

            return (
              <li
                key={linha.chave}
                data-balao={detalhe || undefined}
                className="relative rounded-suave transition-colors
                  hover:bg-folha-2 has-[a:focus-visible]:bg-folha-2"
              >
                {linha.href ? (
                  /*
                   * O link cobre a linha inteira em vez de envolver o conteúdo:
                   * envolver quebraria a grade de três colunas, e é ela que
                   * mantém rótulo, barra e valor alinhados entre as linhas.
                   */
                  <div className={grade}>
                    {conteudo}
                    <Link
                      href={linha.href}
                      className="absolute inset-0 rounded-suave outline-none
                        focus-visible:ring-4 focus-visible:ring-carimbo-fraco"
                    >
                      <span className="sr-only">Abrir {linha.rotulo}</span>
                    </Link>
                  </div>
                ) : (
                  <div className={grade}>{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      </GraficoRealce>
    </div>
  );
}
