/**
 * A cor de cada preposto nas telas de comissão — uma bolinha antes do nome.
 *
 * As cores são as da paleta dos gráficos (`--grafico-*`, validada nos dois
 * temas), para o preposto ter a MESMA cor na bolinha das Comissões e na barra
 * dele nos Gráficos. Ficam de fora o azul (`--grafico-6`, o mesmo do
 * `carimbo`, que já marca a nota de parcela) e qualquer verde, que leria como
 * "bateu" — uma bolinha nessa cor seria sinal, não pessoa.
 *
 * A cor sai da POSIÇÃO do preposto na ordem de cadastro, não de um hash do id:
 * com cinco cores, um hash juntaria dois prepostos na mesma cor já no segundo
 * ou terceiro cadastro. Por ordem, os cinco primeiros nunca se repetem, e
 * cadastrar um novo não mexe na cor de quem já existia.
 */

// A ordem de antes (lilás, sol, pêssego, rosa, ciano): nenhum preposto troca de cor.
const PALETA = [
  "var(--grafico-1)",
  "var(--grafico-4)",
  "var(--grafico-2)",
  "var(--grafico-5)",
  "var(--grafico-3)",
] as const;

/** A cor de quem está na posição `indice` da lista de prepostos por cadastro. */
export function corDoPreposto(indice: number): string {
  return PALETA[((indice % PALETA.length) + PALETA.length) % PALETA.length];
}
