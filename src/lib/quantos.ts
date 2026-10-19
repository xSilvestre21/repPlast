/**
 * "1 contato", "3 contatos" — a contagem com a palavra no número certo.
 *
 * Existe para as perguntas antes de excluir, que dizem exatamente o que vai
 * junto ("os 3 contatos, os 2 materiais e o logo dela"): escrito à mão em cada
 * uma, o singular e o plural acabavam trocados em alguma.
 */
export function quantos(numero: number, singular: string, plural: string): string {
  return `${numero} ${numero === 1 ? singular : plural}`;
}

/** "a, b e c" — a lista como se fala, para emendar numa frase. */
export function emFrase(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}
