import type { BaseDosGraficos } from "@/lib/grafico/base";

/**
 * "Outubro de 2026" para um mês só; "mai/26 — out/26" para um período.
 *
 * É o subtítulo de cada cartão, e muda junto com o seletor — o período que
 * está na tela fica escrito, não só implícito na pílula marcada.
 */
export function descreverPeriodo(base: BaseDosGraficos, meses: string[]): string {
  const primeiro = meses[0];
  const ultimo = meses.at(-1)!;

  if (meses.length === 1) return base.rotulos[ultimo]?.longo ?? ultimo;
  return `${base.rotulos[primeiro]?.curto ?? primeiro} — ${base.rotulos[ultimo]?.curto ?? ultimo}`;
}
