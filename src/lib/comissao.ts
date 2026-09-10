/**
 * Apuração de comissão.
 *
 * É a receita real de quem usa o sistema, então merece ser um módulo puro,
 * sem I/O, testável isoladamente.
 *
 * Regras confirmadas com o usuário:
 *   - conta a partir do momento em que o pedido é marcado como ENVIADO;
 *   - a base é só o valor dos produtos — sem IPI e sem frete;
 *   - a meta é MENSAL e POR FORNECEDOR, medida em reais ou em quilos;
 *   - ao cruzar uma faixa, o percentual maior pode valer só para o excedente
 *     (progressiva) ou para o mês inteiro (retroativa), conforme a indústria.
 */

import Decimal from "decimal.js";

export type ModoFaixa = "PROGRESSIVA" | "RETROATIVA";
export type UnidadeMeta = "REAIS" | "KG";

export interface Faixa {
  /** Volume a partir do qual a faixa passa a valer, na unidade da meta. */
  minimo: Decimal.Value;
  percentual: Decimal.Value;
}

export interface ConfigComissao {
  /** Vale abaixo da primeira faixa — e para o mês inteiro quando não há faixas. */
  percentualBase: Decimal.Value;
  faixas: Faixa[];
  modo: ModoFaixa;
  unidadeMeta: UnidadeMeta;
}

export interface VolumeApurado {
  /** Volume que define a faixa, na unidade da meta (reais OU quilos). */
  volumeMeta: Decimal.Value;
  /** Base da comissão, SEMPRE em reais, mesmo quando a meta é em quilos. */
  baseReais: Decimal.Value;
}

export interface Apuracao {
  /** Percentual que, aplicado à base, dá a comissão. Pode ser fracionário. */
  percentualEfetivo: Decimal;
  valor: Decimal;
  /** Faixa em que o volume caiu, ou `null` quando está abaixo da primeira. */
  faixaAtual: Faixa | null;
  proximaFaixa: Faixa | null;
  /** Quanto falta, na unidade da meta, para alcançar a próxima faixa. */
  faltaParaProxima: Decimal | null;
}

/** Competência no formato "AAAA-MM", que é como a apuração é guardada. */
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

/** Faixas em ordem crescente de mínimo. A ordem importa para todo o resto. */
function ordenar(faixas: Faixa[]): Faixa[] {
  return [...faixas].sort((a, b) => new Decimal(a.minimo).comparedTo(b.minimo));
}

/** Percentual da faixa em que o volume cai — o modo retroativo usa este. */
export function percentualNaFaixa(config: ConfigComissao, volume: Decimal.Value): Decimal {
  const alvo = new Decimal(volume);

  const alcancada = ordenar(config.faixas)
    .filter((faixa) => alvo.greaterThanOrEqualTo(faixa.minimo))
    .at(-1);

  return new Decimal(alcancada?.percentual ?? config.percentualBase);
}

/**
 * Percentual que de fato incide sobre a base.
 *
 * No modo RETROATIVA é o percentual da faixa alcançada, aplicado a tudo.
 *
 * No modo PROGRESSIVA é a **média ponderada** das faixas atravessadas: cada
 * pedaço do volume rende o percentual da sua faixa. Usar a média permite tratar
 * meta em reais e meta em quilos com a mesma conta — quando a meta é em quilos,
 * a proporção de quilos em cada faixa vale para a mesma proporção da base.
 */
export function percentualEfetivo(config: ConfigComissao, volume: Decimal.Value): Decimal {
  const total = new Decimal(volume);

  if (config.modo === "RETROATIVA") return percentualNaFaixa(config, total);
  if (total.lessThanOrEqualTo(0)) return new Decimal(config.percentualBase);

  const faixas = ordenar(config.faixas);
  let restante = total;
  let acumulado = new Decimal(0);
  let inicioDaFaixa = new Decimal(0);
  let percentualCorrente = new Decimal(config.percentualBase);

  for (const faixa of faixas) {
    const limite = new Decimal(faixa.minimo);
    if (limite.lessThanOrEqualTo(inicioDaFaixa)) continue;
    if (total.lessThanOrEqualTo(limite)) break;

    const pedaco = Decimal.min(restante, limite.minus(inicioDaFaixa));
    acumulado = acumulado.plus(pedaco.times(percentualCorrente));
    restante = restante.minus(pedaco);

    inicioDaFaixa = limite;
    percentualCorrente = new Decimal(faixa.percentual);
  }

  acumulado = acumulado.plus(restante.times(percentualCorrente));

  return acumulado.dividedBy(total);
}

/** Apuração completa: quanto rendeu e o quanto falta para a próxima faixa. */
export function apurar(config: ConfigComissao, volumes: VolumeApurado): Apuracao {
  const volume = new Decimal(volumes.volumeMeta);
  const percentual = percentualEfetivo(config, volume);

  const faixas = ordenar(config.faixas);
  const faixaAtual = faixas.filter((f) => volume.greaterThanOrEqualTo(f.minimo)).at(-1) ?? null;
  const proximaFaixa = faixas.find((f) => volume.lessThan(f.minimo)) ?? null;

  return {
    percentualEfetivo: percentual,
    valor: new Decimal(volumes.baseReais).times(percentual).dividedBy(100),
    faixaAtual,
    proximaFaixa,
    faltaParaProxima: proximaFaixa ? new Decimal(proximaFaixa.minimo).minus(volume) : null,
  };
}
