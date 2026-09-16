/**
 * As cores dos gráficos, como token — nunca como hex.
 *
 * O design system é explícito: carimbo, verde, perigo e destaque CARREGAM
 * significado de estado, e gastá-los como cor de série faria uma barra
 * qualquer parecer um link, um acerto ou um erro. As placas de ícone são "o
 * único lugar do sistema onde a cor aparece sem carregar significado", e é de
 * lá que sai a paleta categórica.
 *
 * Tudo sai como `var(--token)` porque o SVG aceita `var()` em `fill` e
 * `stroke`: com isso o gráfico troca de tema junto com a página, sem uma linha
 * de JavaScript e sem ler `getComputedStyle`.
 */

/**
 * A ordem em que séries sem significado próprio recebem cor.
 *
 * Mar não vem primeiro de propósito: no tema claro `--placa-mar-traco` é o
 * mesmo `#2f6fed` do `--carimbo`, e uma série nessa cor pareceria clicável.
 */
export const CATEGORICAS = [
  "var(--placa-lilas-traco)",
  "var(--placa-pessego-traco)",
  "var(--placa-sol-traco)",
  "var(--placa-mar-traco)",
  "var(--placa-menta-traco)",
] as const;

export function categorica(indice: number): string {
  return CATEGORICAS[indice % CATEGORICAS.length];
}

/** Onde a cor significa mesmo alguma coisa, ela é a do estado. */
export const SEMANTICAS = {
  /** O que ainda não entrou: presente, mas fantasma. */
  previsto: "var(--tinta-3)",
  /** O que entrou. "Verde é resultado alcançado." */
  recebido: "var(--verde)",
  /** "Vermelho é erro e perda." */
  perda: "var(--perigo)",
  /** Entrega no prazo, atrasada e adiantada. */
  noPrazo: "var(--verde)",
  atrasado: "var(--perigo)",
  adiantado: "var(--placa-mar-traco)",
  /** O resto agregado: não é par das outras, é resíduo. */
  residuo: "var(--tinta-3)",
} as const;

/** Bandas da curva ABC. É escala ordinal, então desce de intensidade. */
export const BANDAS = {
  A: "var(--placa-lilas-traco)",
  B: "var(--placa-mar-traco)",
  C: "var(--tinta-3)",
} as const;

/**
 * As duas séries da comissão, num lugar só.
 *
 * A tela, o PNG, o PDF e o HTML leem daqui: quatro listas separadas trocariam
 * as cores entre o que se vê e o que se manda.
 */
export const SERIES_DA_COMISSAO = [
  { rotulo: "Previsto", cor: SEMANTICAS.previsto },
  { rotulo: "Recebido", cor: SEMANTICAS.recebido, preencher: true },
];
