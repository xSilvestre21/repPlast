/**
 * Regras do parcelamento do recebimento de um pedido.
 *
 * Módulo PURO — sem banco, sem `server-only` —, porque as duas pontas fazem a
 * mesma conta: o editor no navegador, enquanto a pessoa digita, e a ação no
 * servidor, que confere antes de gravar. Uma divergência entre as duas faria a
 * tela aceitar o que o servidor recusa.
 *
 * Os valores são da VENDA (sem IPI), em `Decimal`: dividir R$ 100,00 em três
 * com `float` daria 33,333… e um centavo sumiria na soma.
 */

import Decimal from "decimal.js";

/**
 * "28/35/42" → [28, 35, 42]: os dias, a partir da entrega, em que cada parcela
 * vence. É a forma em que o prazo de pagamento já vive no cliente e no pedido.
 *
 * Aceita o que aparece de fato no cadastro importado do SICOV — "28 dias",
 * "28/35/42 cheque", "28/35/42 (Cheques)" — lendo os números e ignorando as
 * palavras. "À vista" é uma parcela no dia. Devolve `null` quando não dá para
 * ler dias ("Antecipado", "50% antecipado e 50% à vista"): aí a pessoa digita.
 */
export function lerPrazoEmDias(texto: string | null | undefined): number[] | null {
  if (!texto) return null;

  const limpo = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  if (/^a\s*vista\b/.test(limpo)) return [0];
  // Percentual é outra forma de prazo ("50% antecipado"), não uma lista de dias.
  if (limpo.includes("%")) return null;

  const numeros = limpo.match(/\d+/g);
  if (!numeros) return null;

  const dias = numeros.map(Number);
  // Fora de ordem não é prazo: "42/28" é quase sempre erro de digitação.
  if (dias.some((d, i) => i > 0 && d <= dias[i - 1])) return null;

  return dias;
}

/** "AAAA-MM-DD" + dias, sem passar por fuso — a coluna é `date`. */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/**
 * A base dividida em `n` partes iguais, em centavos.
 *
 * O que não divide exato vai para a ÚLTIMA: R$ 100,00 em 3 é 33,33 + 33,33 +
 * 33,34. É a mesma regra do "restante para a última" de quando a pessoa mexe
 * num valor, então as duas formas de montar as parcelas fecham do mesmo jeito.
 */
export function dividirIgual(base: Decimal.Value, n: number): string[] {
  if (n < 1) return [];

  const total = new Decimal(base);
  const parte = total.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const ultima = total.minus(parte.times(n - 1));

  return [...Array.from({ length: n - 1 }, () => parte.toFixed(2)), ultima.toFixed(2)];
}

/**
 * O valor da última parcela: o que sobra da base depois das outras.
 *
 * É o "pôr o restante para frente" — diminuir uma parcela empurra a diferença
 * para a última, e a soma fecha sem a pessoa fazer conta. Pode dar negativo,
 * quando as outras já passaram da base; quem chama mostra o erro.
 */
export function restanteDaBase(base: Decimal.Value, anteriores: Decimal.Value[]): Decimal {
  return anteriores.reduce<Decimal>((resto, v) => resto.minus(v), new Decimal(base));
}

export interface ParcelaDigitada {
  vencimento: string;
  base: Decimal.Value;
}

/**
 * O que impede gravar estas parcelas, ou `null` quando estão boas.
 *
 * A soma precisa fechar NO CENTAVO com a venda: parcela que soma menos deixaria
 * comissão sem mês, e que soma mais inventaria comissão que não existe.
 */
export function problemaNasParcelas(
  base: Decimal.Value,
  parcelas: ParcelaDigitada[],
): string | null {
  if (parcelas.length < 2) return "Parcele em pelo menos duas vezes.";

  for (const [i, p] of parcelas.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.vencimento)) return `Informe a data da parcela ${i + 1}.`;
    if (new Decimal(p.base).lessThanOrEqualTo(0)) {
      return `A parcela ${i + 1} precisa ter valor maior que zero.`;
    }
  }

  const soma = parcelas.reduce((total, p) => total.plus(p.base), new Decimal(0));
  if (!soma.equals(new Decimal(base))) {
    const diferenca = new Decimal(base).minus(soma);
    return diferenca.isPositive()
      ? `As parcelas somam menos que a venda — faltam R$ ${diferenca.toFixed(2).replace(".", ",")}.`
      : `As parcelas passam da venda em R$ ${diferenca.abs().toFixed(2).replace(".", ",")}.`;
  }

  return null;
}
