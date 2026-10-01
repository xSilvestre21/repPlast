/**
 * "Começa com", para uma medida guardada como número.
 *
 * Quem digita a largura ainda não terminou de digitar: o "1" do comprimento é o
 * começo de 110, de 15, de 160. Casar o valor exato nesse momento dizia "nada
 * encontrado" a cada tecla. O prefixo do texto vira faixas de número — "1" é
 * [1, 2), [10, 20), [100, 200)… — o que deixa o banco comparar Decimal com
 * Decimal em vez de converter a coluna em texto linha por linha.
 */

export type Faixa = { gte: number; lt: number };

/**
 * Quantas ordens de grandeza a parte inteira pode ganhar depois do que já foi
 * digitado. Cinco cobre de 1 a 199.999 cm a partir de "1" — folga para qualquer
 * saco, bobina ou stretch.
 */
const ORDENS = 5;

/**
 * As faixas de todo número cujo texto começa com `texto`, ou `null` quando o
 * texto não é começo de número nenhum (aí o filtro é ignorado, como na medida
 * exata).
 *
 * Vírgula ou ponto são o decimal: depois dele a parte inteira está fechada, e
 * cada casa digitada estreita a faixa — "0,05" é [0,05; 0,06).
 */
export function faixasDoPrefixo(texto: string): Faixa[] | null {
  const partes = /^(\d+)(?:[.,](\d*))?$/.exec(texto.trim());
  if (!partes) return null;

  const [, inteiro, fracao] = partes;

  if (fracao !== undefined) {
    // Em inteiros e dividido no fim: 0,05 + 0,01 em ponto flutuante dá
    // 0,06000000000000001, e a faixa engoliria o próprio 0,06.
    const escala = 10 ** fracao.length;
    const base = Number(inteiro + fracao);
    return [{ gte: base / escala, lt: (base + 1) / escala }];
  }

  const numero = Number(inteiro);
  // Zero à esquerda não cresce: "0" só pode ser o começo de 0,algo.
  if (numero === 0) return [{ gte: 0, lt: 1 }];

  return Array.from({ length: ORDENS }, (_, ordem) => ({
    gte: numero * 10 ** ordem,
    lt: (numero + 1) * 10 ** ordem,
  }));
}
