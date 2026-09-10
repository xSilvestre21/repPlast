/**
 * Comissão.
 *
 * Regras confirmadas com o usuário:
 *   - conta a partir do momento em que o pedido é marcado como ENVIADO;
 *   - a base é só o valor dos produtos — sem IPI e sem frete;
 *   - o percentual é o da indústria, ajustável no pedido enquanto ele estiver
 *     aberto, e CONGELADO no pedido a partir daí.
 *
 * Houve uma versão com faixas por volume mensal, removida depois que o usuário
 * verificou que nenhuma indústria que ele representa trabalha assim. Com a
 * faixa fora, a comissão de um pedido não depende do que veio antes no mês —
 * o que torna a apuração derivável dos pedidos a qualquer momento, sem tabela
 * intermediária e sempre historicamente correta.
 *
 * A meta mensal que existe hoje é OUTRA coisa: é pessoal, do representante,
 * e não altera cálculo nenhum — serve para ele acompanhar o próprio objetivo.
 */

import Decimal from "decimal.js";

/** Comissão de um pedido: base × percentual, arredondada em centavos. */
export function comissaoDoPedido(base: Decimal.Value, percentual: Decimal.Value): Decimal {
  return new Decimal(base).times(percentual).dividedBy(100).toDecimalPlaces(2);
}

export interface PedidoComissionavel {
  base: Decimal.Value;
  percentual: Decimal.Value;
}

export interface ResumoComissao {
  base: Decimal;
  valor: Decimal;
  /** Percentual médio sobre a base. Só difere do fixo quando há pedido com percentual próprio. */
  percentualMedio: Decimal;
}

/**
 * Soma a comissão de vários pedidos.
 *
 * Cada pedido rende o SEU percentual — daí somar pedido a pedido em vez de
 * aplicar uma taxa única ao total. O percentual médio existe só para exibição.
 */
export function somarComissao(pedidos: PedidoComissionavel[]): ResumoComissao {
  const base = pedidos.reduce((acc, p) => acc.plus(p.base), new Decimal(0));
  const valor = pedidos.reduce(
    (acc, p) => acc.plus(comissaoDoPedido(p.base, p.percentual)),
    new Decimal(0),
  );

  return {
    base,
    valor,
    percentualMedio: base.isZero() ? new Decimal(0) : valor.dividedBy(base).times(100),
  };
}

/** Competência no formato "AAAA-MM", que é como o mês é identificado nas telas. */
export function competenciaDe(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/** Primeiro e último instante da competência, para filtrar os pedidos do mês. */
export function intervaloDaCompetencia(competencia: string): { de: Date; ate: Date } {
  const [ano, mes] = competencia.split("-").map(Number);

  return {
    de: new Date(ano, mes - 1, 1, 0, 0, 0, 0),
    ate: new Date(ano, mes, 1, 0, 0, 0, 0),
  };
}

/** Anda meses na competência "AAAA-MM" sem depender de fuso. */
export function deslocarCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);

  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export interface ProgressoMeta {
  meta: Decimal;
  alcancado: Decimal;
  /** De 0 a 100, limitado no teto para a barra não estourar. */
  percentual: number;
  batida: boolean;
  /** Quanto falta; zero quando a meta já foi batida. */
  falta: Decimal;
}

/** Progresso da meta pessoal do mês. `null` quando não há meta definida. */
export function progressoDaMeta(
  meta: Decimal.Value | null | undefined,
  alcancado: Decimal.Value,
): ProgressoMeta | null {
  if (meta === null || meta === undefined || meta === "") return null;

  const alvo = new Decimal(meta);
  if (alvo.lessThanOrEqualTo(0)) return null;

  const atual = new Decimal(alcancado);
  const razao = atual.dividedBy(alvo).times(100);

  return {
    meta: alvo,
    alcancado: atual,
    percentual: Math.min(100, Math.max(0, razao.toNumber())),
    batida: atual.greaterThanOrEqualTo(alvo),
    falta: Decimal.max(0, alvo.minus(atual)),
  };
}
