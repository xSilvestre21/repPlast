/**
 * A caixa de um controle de formulário.
 *
 * Mora fora de `campos.tsx` porque aquele módulo é `"use client"`, e uma
 * constante exportada de um módulo de cliente chega a um Server Component como
 * referência, não como o texto da classe. Estas são usadas dos dois lados.
 *
 * Exportada para as poucas telas que precisam de um campo SEM rótulo em cima —
 * uma linha de tabela editável, onde o cabeçalho da coluna já diz o que é e um
 * rótulo por célula viraria ruído. Fora esses casos, use `Campo`.
 */
const CONTROLE_BASE =
  "bg-folha-2 text-tinta border border-transparent " +
  "placeholder:text-tinta-3 outline-none " +
  "transition-[background-color,border-color,box-shadow] duration-150 " +
  "hover:border-filete " +
  "focus:bg-folha focus:border-carimbo focus:ring-4 focus:ring-carimbo-fraco " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const CLASSE_CONTROLE = `w-full px-3.5 py-2.5 text-corpo rounded-suave ${CONTROLE_BASE}`;

/**
 * O mesmo controle, do tamanho de uma célula de tabela.
 *
 * A tabela de itens tinha um campo próprio: raio de 4px, padding menor e
 * `focus:border-carimbo` sem o anel. Eram os campos mais usados do produto —
 * quantidade e preço, doze vezes por pedido — e os únicos em que o teclado não
 * mostrava onde estava. O que muda aqui é a medida, nunca o foco.
 */
export const CLASSE_CONTROLE_CELULA = `px-2 py-1 text-corpo rounded-miudo ${CONTROLE_BASE}`;

/** A borda e o fundo que um controle ganha quando o valor dele não serve. */
export const CLASSE_ERRO = "border-perigo bg-perigo-fraco";
