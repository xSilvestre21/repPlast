/**
 * A frase embaixo das caixas do topo: de onde vem a Diferença.
 *
 * A Diferença é recebido − previsto do mês inteiro (`somarComissao`), e mistura
 * duas coisas que a pessoa precisa ver separadas: o que ainda não foi pago (o
 * "A acertar", ao lado) e o que a indústria pagou a mais ou a menos nos pedidos
 * que já pagou. Sem a frase, "A acertar" e "Diferença" pareciam o mesmo número
 * contado duas vezes. A conta fecha no centavo:
 * `diferenca = nosAcertados − aAcertar`.
 *
 * Módulo puro, sem `components/ui`: roda no servidor e no teste em `node`.
 */

import Decimal from "decimal.js";

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** O valor sem sinal — o "a mais" ou "a menos" da frase já diz o lado. */
function reais(valor: Decimal): string {
  return MOEDA.format(valor.abs().toNumber());
}

/** "1 pedido ainda não pago", "10 pedidos ainda não pagos". */
export function pedidosNaoPagos(n: number): string {
  return n === 1 ? "1 pedido ainda não pago" : `${n} pedidos ainda não pagos`;
}

export function explicarDiferenca({
  diferenca,
  aAcertar,
  nosAcertados,
  pendentes,
  quem = "as indústrias",
}: {
  /** Recebido − previsto, do mês inteiro. */
  diferenca: Decimal.Value;
  /** O previsto do que ainda não foi pago. */
  aAcertar: Decimal.Value;
  /** Recebido − previsto, só nos pedidos já pagos. */
  nosAcertados: Decimal.Value;
  /** Quantos pedidos ainda não foram pagos. */
  pendentes: number;
  /** Quem pagou: "as indústrias", ou "a indústria" no mês de uma só. */
  quem?: "as indústrias" | "a indústria";
}): string {
  const total = new Decimal(diferenca);
  const falta = new Decimal(aAcertar);
  const extra = new Decimal(nosAcertados);
  const lado = extra.isPositive() ? "a mais" : "a menos";

  if (falta.isZero()) {
    return extra.isZero()
      ? "Tudo pago, exatamente o previsto."
      : `Tudo pago. ${maiuscula(quem)} ${pagou(quem)} ${reais(extra)} ${lado} do que o previsto.`;
  }

  const naoPagos = `${reais(falta)} de ${pedidosNaoPagos(pendentes)}`;

  if (extra.isZero()) return `Faltam ${reais(total)}: são ${naoPagos}.`;

  if (extra.isNegative()) {
    return `Faltam ${reais(total)}: ${naoPagos}, mais ${reais(extra)} que ${quem} ${pagou(quem)} a menos.`;
  }

  // Veio a mais nos pagos — o bastante, às vezes, para passar do previsto
  // mesmo com pedido ainda sem pagar.
  if (total.isNegative()) {
    return `Faltam ${reais(total)}: ${naoPagos}, menos ${reais(extra)} que ${quem} ${pagou(quem)} a mais.`;
  }
  const inicio = total.isZero()
    ? "O recebido já empata com o previsto"
    : `Já entrou ${reais(total)} a mais que o previsto`;
  return `${inicio}: ${quem} ${pagou(quem)} ${reais(extra)} a mais, e ainda faltam ${naoPagos}.`;
}

function pagou(quem: string): string {
  return quem === "a indústria" ? "pagou" : "pagaram";
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
