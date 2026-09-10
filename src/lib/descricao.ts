/**
 * Geração automática da descrição impressa do produto.
 *
 * O usuário digita as medidas e a descrição se monta sozinha, no formato exato
 * que sai na tabela do PDF. Formatos confirmados em pedidos reais:
 *
 *     99x166x0,08 SF 13,50 PEAD
 *     105x100x0,08 SF 15 PEAD
 *     77x150x0,05 SF 09 PEAD C/ DESLIZANTE
 */

import Decimal from "decimal.js";

/**
 * Número no padrão brasileiro, com vírgula decimal.
 *
 * `minCasas` garante um mínimo de casas sem truncar o que vier além: a espessura
 * 0,08 sai "0,08" e a 0,006 sai "0,006".
 */
export function formatarNumero(valor: Decimal.Value, minCasas = 0): string {
  const texto = new Decimal(valor).toFixed();
  const [inteira, decimal = ""] = texto.split(".");
  const casas = decimal.padEnd(minCasas, "0");
  return casas.length > 0 ? `${inteira},${casas}` : inteira;
}

export interface DescricaoSaco {
  larguraCm: Decimal.Value;
  comprimentoCm: Decimal.Value;
  espessuraMm: Decimal.Value;
  /**
   * Sanfona: TEXTO LIVRE, de propósito.
   *
   * Os pedidos reais trazem "13,50", "15" e "09" — três formatações diferentes
   * do mesmo campo. O "09" com zero à esquerda mostra que o valor é digitado,
   * não formatado a partir de um número. Guardar como texto preserva
   * exatamente o que o usuário escreveu.
   *
   * A sanfona não entra em nenhum cálculo — só na descrição.
   */
  sanfona?: string;
  /** Material, ex.: "PEAD", "PEBD". */
  material: string;
  /** Características extras, ex.: ["C/ DESLIZANTE"]. */
  adicionais?: string[];
}

export function descricaoSaco(saco: DescricaoSaco): string {
  const medidas = [
    formatarNumero(saco.larguraCm),
    formatarNumero(saco.comprimentoCm),
    formatarNumero(saco.espessuraMm, 2),
  ].join("x");

  const sanfona = saco.sanfona?.trim();

  return [
    medidas,
    sanfona ? `SF ${sanfona}` : null,
    saco.material.trim(),
    ...(saco.adicionais ?? []).map((a) => a.trim()).filter(Boolean),
  ]
    .filter(Boolean)
    .join(" ");
}
