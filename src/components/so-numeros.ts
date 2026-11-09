import { type TipoNumero, limparNumeroDigitado } from "@/lib/numero-br";

/**
 * Tira da caixa o que não é número, logo depois de digitar ou colar.
 *
 * Corre no `onChange`, antes de quem usa o valor: o React lê o texto já limpo, e
 * o campo controlado não chega a guardar a letra. O cursor fica onde estava,
 * descontado o que saiu antes dele — sem isso, apagar a letra jogava o cursor
 * para o fim, e quem corrigia o meio do número digitava no lugar errado.
 *
 * Os campos com `numero` no `Campo` já fazem isto; caixa solta (a célula de uma
 * tabela) chama direto: `onChange={(e) => filtrarNumero(e.currentTarget, "decimal")}`.
 */
export function filtrarNumero(campo: HTMLInputElement, tipo: TipoNumero): void {
  const texto = campo.value;
  const limpo = limparNumeroDigitado(texto, tipo);
  if (limpo === texto) return;

  const cursor = campo.selectionStart ?? texto.length;
  const novoCursor = limparNumeroDigitado(texto.slice(0, cursor), tipo).length;
  campo.value = limpo;
  campo.setSelectionRange(novoCursor, novoCursor);
}
