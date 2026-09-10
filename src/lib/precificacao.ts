/**
 * Motor de precificação — embalagens plásticas.
 *
 * Módulo puro: sem I/O, sem banco, sem framework. É a peça mais crítica do
 * sistema, porque erro aqui vira dinheiro errado no pedido e na comissão.
 *
 * A fórmula do saco foi extraída por engenharia reversa de pedidos reais
 * (2253/MARIOL e 2256/LEMEPACK, indústria QUALYPLAST) e confirmada pelo usuário.
 * Os testes em `precificacao.test.ts` usam esses pedidos como fixtures.
 */

import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 40 });

export type Familia = "SACO" | "FITA" | "STRETCH" | "BOBINA";

/** Onde o valor do aditivo é somado — antes ou depois da fórmula. */
export type TipoAditivo = "POR_KG" | "POR_MILHEIRO";

export interface Aditivo {
  nome: string;
  /** Sufixo que entra na descrição impressa, ex.: "C/ DESLIZANTE". */
  sufixoDescricao: string;
  tipo: TipoAditivo;
  /** Valor absoluto somado — nunca percentual. */
  valor: Decimal.Value;
}

export interface MedidasSaco {
  larguraCm: Decimal.Value;
  comprimentoCm: Decimal.Value;
  espessuraMm: Decimal.Value;
}

export interface SacoPrecificavel extends MedidasSaco {
  /** Fator kg do produto. Aditivos POR_KG são somados em cima dele. */
  fatorKg: Decimal.Value;
  aditivos?: Aditivo[];
}

/** Divisor da fórmula do milheiro. Constante do ramo, validada em pedidos reais. */
const DIVISOR_MILHEIRO = new Decimal(10);

const CASAS_DINHEIRO = 2;

/**
 * Arredonda para centavos. Só deve ser usado na exibição e nas linhas de
 * totalização — nunca no meio de uma cadeia de cálculo.
 *
 * Regra descoberta nos PDFs reais: 1.774,872 × 6 = 10.649,23 (correto),
 * enquanto 1.774,87 × 6 = 10.649,22 (erra por um centavo).
 */
export function arredondarDinheiro(valor: Decimal.Value): Decimal {
  return new Decimal(valor).toDecimalPlaces(CASAS_DINHEIRO);
}

/** Fator kg do produto acrescido dos aditivos cobrados por quilo. */
export function fatorEfetivo(
  fatorKg: Decimal.Value,
  aditivos: Aditivo[] = [],
): Decimal {
  return aditivos
    .filter((a) => a.tipo === "POR_KG")
    .reduce<Decimal>((acc, a) => acc.plus(a.valor), new Decimal(fatorKg));
}

/**
 * Peso do milheiro, na convenção do ramo.
 *
 * ⚠️ HIPÓTESE AINDA NÃO CONFIRMADA PELO USUÁRIO. Decorre de decompor a fórmula
 * confirmada do preço: se `fatorKg` é R$/kg, então `L × C × E ÷ 10` é o peso em
 * quilos do milheiro. O preço calculado por `precoMilheiroSaco` não depende
 * desta função — ela existe para as metas de comissão medidas em kg (fase 6),
 * e precisa ser validada com o usuário antes de valer dinheiro.
 *
 * Note que este valor NÃO é o peso físico real do plástico: é a convenção
 * comercial usada na formação do preço.
 */
export function pesoMilheiroKg(medidas: MedidasSaco): Decimal {
  return new Decimal(medidas.larguraCm)
    .times(medidas.comprimentoCm)
    .times(medidas.espessuraMm)
    .dividedBy(DIVISOR_MILHEIRO);
}

/**
 * Preço de um milheiro (1.000 unidades) de saco plástico.
 *
 *     preço = largura(cm) × comprimento(cm) × espessura(mm) × fator efetivo ÷ 10
 *             + aditivos cobrados por milheiro
 *
 * Retorna o valor SEM arredondar, de propósito: quem multiplica pela quantidade
 * precisa da precisão cheia.
 */
export function precoMilheiroSaco(saco: SacoPrecificavel): Decimal {
  const aditivos = saco.aditivos ?? [];

  const base = new Decimal(saco.larguraCm)
    .times(saco.comprimentoCm)
    .times(saco.espessuraMm)
    .times(fatorEfetivo(saco.fatorKg, aditivos))
    .dividedBy(DIVISOR_MILHEIRO);

  return aditivos
    .filter((a) => a.tipo === "POR_MILHEIRO")
    .reduce<Decimal>((acc, a) => acc.plus(a.valor), base);
}
