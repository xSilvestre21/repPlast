/**
 * O ranking em lista com barra de progresso — o padrão dos painéis de produto
 * (Stripe, Vercel Analytics, Linear) para "quem vem primeiro e quanto".
 *
 * Cada linha: a posição e o nome à esquerda, o valor e a fatia à direita, e
 * embaixo uma barra fina, de ponta redonda, sobre um trilho. A maior ocupa o
 * trilho inteiro e as outras são proporcionais a ela. Sem eixo: os números já
 * estão escritos em cada linha, e um eixo só repetiria a escala com ruído.
 *
 * Substituiu as barras com o nome no eixo e o valor colado na ponta, onde o
 * nome comprido era cortado, o valor de uma barra curta ficava longe do nome e
 * o conjunto parecia uma planilha desenhada.
 *
 * Duas séries sobrepostas (`barGap: "-100%"`): o trilho, sempre cheio, que
 * leva o VALOR escrito acima da sua ponta direita; e a barra, que leva o NOME
 * acima da sua ponta esquerda. Assim o valor fica sempre alinhado à direita,
 * por menor que seja a barra.
 */

import type { OpcaoGrafico } from "./echarts";
import type { CoresDoGrafico } from "@/lib/grafico/tema-echarts";
import { escapar } from "@/lib/grafico/formato";

export interface LinhaRanking {
  chave: string;
  rotulo: string;
  valor: number;
  /** A cor da entidade (indústria, preposto); sem ela, o primeiro tom da paleta. */
  cor?: string;
}

/** Altura de uma linha: nome em cima, barra embaixo, respiro até a próxima. */
export const ALTURA_DA_LINHA = 46;

export function opcaoRanking({
  linhas,
  cores,
  valorDe,
  detalheDe,
}: {
  /** Já ordenadas, da maior para a menor. */
  linhas: LinhaRanking[];
  cores: CoresDoGrafico;
  /** O valor por extenso: "R$ 1.283,52". */
  valorDe: (valor: number) => string;
  /** O que vem depois do valor, mais apagado: a fatia, "3 pedidos". */
  detalheDe?: (linha: LinhaRanking) => string;
}): OpcaoGrafico {
  const maior = Math.max(1, ...linhas.map((l) => l.valor));
  const corDe = (l: LinhaRanking) => l.cor ?? cores.categoricas[0];

  // Nome comprido é cortado aqui, com reticências: o rótulo não sabe a
  // largura do trilho, e o nome não pode invadir o valor à direita.
  const nome = (l: LinhaRanking) => (l.rotulo.length > 30 ? `${l.rotulo.slice(0, 29).trimEnd()}…` : l.rotulo);

  return {
    tooltip: {
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const l = linhas[p.dataIndex];
        if (!l) return "";
        const detalhe = detalheDe?.(l);
        return `<b>${escapar(l.rotulo)}</b><br/>${valorDe(l.valor)}${detalhe ? ` · ${escapar(detalhe)}` : ""}`;
      },
    },
    // O espaço de cima é o do nome da primeira linha, que fica acima da barra.
    grid: { left: 0, right: 0, top: 22, bottom: 4 },
    xAxis: { type: "value", show: false, max: maior },
    yAxis: {
      type: "category",
      show: false,
      // A primeira linha é a maior, em cima.
      inverse: true,
      data: linhas.map((l) => l.chave),
    },
    series: [
      {
        // O trilho: cheio em toda linha, com o valor acima da ponta direita.
        type: "bar",
        barWidth: 8,
        barGap: "-100%",
        z: 1,
        itemStyle: { color: cores.folha2, borderRadius: 4 },
        emphasis: { disabled: true },
        label: {
          show: true,
          position: ["100%", -7],
          align: "right",
          verticalAlign: "bottom",
          formatter: (p: { dataIndex: number }) => {
            const l = linhas[p.dataIndex];
            const detalhe = l && detalheDe?.(l);
            return l ? `{v|${valorDe(l.valor)}}${detalhe ? `  {d|${detalhe}}` : ""}` : "";
          },
          rich: {
            v: { color: cores.tinta, fontSize: 12, fontWeight: 600 },
            d: { color: cores.tinta3, fontSize: 11 },
          },
        },
        data: linhas.map((l) => ({ value: maior, id: l.chave })),
      },
      {
        // A barra: proporcional à maior, com a posição e o nome acima dela.
        type: "bar",
        barWidth: 8,
        z: 2,
        itemStyle: { borderRadius: 4 },
        emphasis: { itemStyle: { opacity: 0.85 } },
        label: {
          show: true,
          position: [0, -7],
          align: "left",
          verticalAlign: "bottom",
          formatter: (p: { dataIndex: number }) => {
            const l = linhas[p.dataIndex];
            return l ? `{r|${p.dataIndex + 1}}  {n|${nome(l)}}` : "";
          },
          rich: {
            r: { color: cores.tinta3, fontSize: 11, fontWeight: 600 },
            n: { color: cores.tinta2, fontSize: 12 },
          },
        },
        data: linhas.map((l) => ({ value: l.valor, id: l.chave, itemStyle: { color: corDe(l) } })),
      },
    ],
  };
}
