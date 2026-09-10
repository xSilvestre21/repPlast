/**
 * Leitura de números digitados no padrão brasileiro.
 *
 * Os campos numéricos do sistema são `text` com `inputMode="decimal"`, e não
 * `number`, justamente para aceitar vírgula: quem digita "13,50" o dia inteiro
 * não deveria ter que lembrar de trocar por ponto.
 */

/**
 * Agrupamento de milhar puro: "50.000", "1.234.567", "9.999".
 *
 * Serve para desfazer a ambiguidade do ponto quando não há vírgula. Sem isto,
 * "50.000" (cinquenta mil) seria lido como 50 — erro que já aconteceu ao
 * cadastrar uma faixa de comissão.
 */
const AGRUPAMENTO_MILHAR = /^\d{1,3}(\.\d{3})+$/;

/**
 * Converte "13,50", "1.234,56", "50.000" ou "13.50" em número.
 * Devolve `null` quando o texto não representa um número válido.
 *
 * Regras, nesta ordem:
 *   1. Havendo vírgula, ela é o decimal e os pontos são milhar — "1.234,56".
 *   2. Sem vírgula, se o texto for agrupamento de milhar puro, os pontos são
 *      separadores — "50.000" vira 50000.
 *   3. Caso contrário o ponto é decimal — "0.08" e "13.5" continuam valendo,
 *      o que mantém compatibilidade com quem digita no padrão inglês.
 */
export function lerNumeroBr(entrada: unknown): number | null {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : null;
  if (typeof entrada !== "string") return null;

  const texto = entrada.trim().replace(/\s/g, "");
  if (texto === "") return null;

  const sinal = texto.startsWith("-") ? -1 : 1;
  const absoluto = texto.replace(/^[+-]/, "");

  let normalizado: string;

  if (absoluto.includes(",")) {
    normalizado = absoluto.replace(/\./g, "").replace(",", ".");
  } else if (AGRUPAMENTO_MILHAR.test(absoluto)) {
    normalizado = absoluto.replace(/\./g, "");
  } else {
    normalizado = absoluto;
  }

  if (!/^\d*\.?\d+$/.test(normalizado) && !/^\d+\.?\d*$/.test(normalizado)) return null;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? sinal * numero : null;
}

/**
 * Formata para exibição em campo de formulário, com vírgula decimal.
 *
 * `minCasas` garante um mínimo; `maxCasas` NUNCA deve cortar precisão de um
 * valor que vai ser reenviado ao servidor. Foi por isso que o padrão do máximo
 * não é igual ao mínimo: preencher um campo de preço com "1.774,87" quando o
 * valor guardado é 1.774,872 faria o total do item errar um centavo ao salvar
 * — o mesmo erro que a regra de arredondamento do pedido evita.
 */
export function escreverNumeroBr(
  valor: unknown,
  minCasas = 0,
  maxCasas = Math.max(minCasas, 4),
): string {
  if (valor === null || valor === undefined || valor === "") return "";

  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: minCasas,
    maximumFractionDigits: Math.max(minCasas, maxCasas),
  });
}
