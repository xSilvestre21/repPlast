/**
 * O que a digitação procura numa lista.
 *
 * Mora aqui, e não em `SelecaoBuscavel`, porque as etiquetas de complemento e de
 * aditivo buscam igual e não têm por que depender de um componente.
 */

/**
 * Sem acento e sem caixa.
 *
 * "Conceição" tem de aparecer para quem digitou "conceicao", e "PÉROLA"
 * para quem digitou "perola" — ninguém procura cliente com acento certo.
 */
export function achatar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Os pedaços digitados: cada um precisa aparecer, em qualquer ordem. */
export function termosDaBusca(busca: string): string[] {
  return achatar(busca).split(/\s+/).filter(Boolean);
}

/** `alvo` tem todos os termos? Sem termo nenhum, tudo casa. */
export function casaComTermos(alvo: string, termos: readonly string[]): boolean {
  const achatado = achatar(alvo);
  return termos.every((termo) => achatado.includes(termo));
}
