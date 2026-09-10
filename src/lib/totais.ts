/**
 * Totalização do pedido.
 *
 * A ordem de arredondamento aqui não é preferência de estilo: foi extraída dos
 * PDFs reais e precisa ser respeitada, senão o pedido fecha com centavos de
 * diferença do que a indústria espera.
 */

import Decimal from "decimal.js";
import { arredondarDinheiro } from "./precificacao";

export interface ItemCalculavel {
  /** Preço unitário SEM arredondar — milheiro, quilo, unidade ou caixa. */
  precoUnitario: Decimal.Value;
  quantidade: Decimal.Value;
}

export interface TotaisItem {
  /** Total do item sem arredondar — use para somar o subtotal. */
  totalBruto: Decimal;
  /** Total do item em centavos, como sai impresso. */
  total: Decimal;
  /** IPI do item em centavos, como sai impresso. */
  ipi: Decimal;
  /** Total do item já com IPI. */
  totalComIpi: Decimal;
}

export interface TotaisPedido {
  subtotalSemIpi: Decimal;
  ipi: Decimal;
  totalGeral: Decimal;
  itens: TotaisItem[];
}

/**
 * Total de um item, sem arredondar.
 *
 * O arredondamento acontece só depois da multiplicação. Multiplicar o preço
 * já arredondado erra por centavos: no pedido 2253, 1.774,872 × 6 = 10.649,23,
 * enquanto 1.774,87 × 6 daria 10.649,22.
 */
export function totalItemBruto(item: ItemCalculavel): Decimal {
  return new Decimal(item.precoUnitario).times(item.quantidade);
}

function percentualParaFracao(percentual: Decimal.Value): Decimal {
  return new Decimal(percentual).dividedBy(100);
}

/**
 * Fecha os totais do pedido.
 *
 * @param ipiPercentual Percentual do fornecedor, ex.: 9.75. Passe 0 — ou
 *   `comIpi: false` — nos pedidos sem IPI, que o usuário confirmou existirem.
 */
export function calcularTotaisPedido(
  itens: ItemCalculavel[],
  ipiPercentual: Decimal.Value = 0,
  comIpi = true,
): TotaisPedido {
  const fracaoIpi = comIpi ? percentualParaFracao(ipiPercentual) : new Decimal(0);

  const totaisItens: TotaisItem[] = itens.map((item) => {
    const totalBruto = totalItemBruto(item);
    const ipi = arredondarDinheiro(totalBruto.times(fracaoIpi));
    const total = arredondarDinheiro(totalBruto);

    return { totalBruto, total, ipi, totalComIpi: arredondarDinheiro(total.plus(ipi)) };
  });

  const subtotalSemIpi = arredondarDinheiro(
    totaisItens.reduce<Decimal>((acc, i) => acc.plus(i.totalBruto), new Decimal(0)),
  );

  // O IPI do pedido é a soma dos IPIs já arredondados por item — é assim que os
  // pedidos reais fecham, e é o que mantém a coluna IPI coerente com o rodapé.
  const ipi = totaisItens.reduce<Decimal>((acc, i) => acc.plus(i.ipi), new Decimal(0));

  return {
    subtotalSemIpi,
    ipi,
    totalGeral: arredondarDinheiro(subtotalSemIpi.plus(ipi)),
    itens: totaisItens,
  };
}
