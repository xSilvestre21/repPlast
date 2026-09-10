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

  return juntar([
    medidas,
    sanfona ? `SF ${sanfona}` : null,
    saco.material.trim(),
    ...(saco.adicionais ?? []),
  ]);
}

function juntar(partes: (string | null | undefined)[]): string {
  return partes
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Demais famílias                                                            */
/*                                                                            */
/* ⚠️ FORMATO PROVISÓRIO. Diferente do saco, não há pedido real de fita,      */
/* stretch ou bobina para servir de referência — estes formatos são uma       */
/* proposta. Por isso a descrição do produto é EDITÁVEL na tela: o que sai    */
/* daqui é só o ponto de partida, e o usuário corrige quando não bater com o  */
/* que a indústria espera ver impresso.                                       */
/* -------------------------------------------------------------------------- */

export interface DescricaoFita {
  /** Largura em milímetros, ex.: 48. */
  larguraMm?: Decimal.Value | null;
  /** Metragem do rolo, ex.: 100. */
  metragemM?: Decimal.Value | null;
  /** Espessura em micras, ex.: 45. */
  micragem?: Decimal.Value | null;
  material?: string | null;
  adicionais?: string[];
}

export function descricaoFita(fita: DescricaoFita): string {
  const medidas = [
    fita.larguraMm != null ? `${formatarNumero(fita.larguraMm)}mm` : null,
    fita.metragemM != null ? `${formatarNumero(fita.metragemM)}m` : null,
  ].filter(Boolean);

  return juntar([
    medidas.length > 0 ? medidas.join(" x ") : null,
    fita.micragem != null ? `${formatarNumero(fita.micragem)} MIC` : null,
    fita.material,
    ...(fita.adicionais ?? []),
  ]);
}

export interface DescricaoRolo {
  /** STRETCH ou BOBINA. */
  familia: "STRETCH" | "BOBINA";
  larguraMm?: Decimal.Value | null;
  micragem?: Decimal.Value | null;
  material?: string | null;
  adicionais?: string[];
}

export function descricaoRolo(rolo: DescricaoRolo): string {
  return juntar([
    rolo.familia,
    rolo.larguraMm != null ? `${formatarNumero(rolo.larguraMm)}mm` : null,
    rolo.micragem != null ? `${formatarNumero(rolo.micragem)} MIC` : null,
    rolo.material,
    ...(rolo.adicionais ?? []),
  ]);
}
