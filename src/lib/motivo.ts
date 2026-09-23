/**
 * O motivo escrito à mão quando um documento não vinga.
 *
 * Duas perguntas, a mesma forma: por que o cliente recusou a proposta, e por que
 * o pedido foi cancelado. As duas são a única coisa que o documento perdido
 * ainda responde meses depois, e as duas são texto livre e opcional.
 *
 * Mora aqui porque o teto já estava escrito em dois lugares — uma vez no
 * servidor e outra no componente, com um comentário reconhecendo a cópia. Dois
 * donos para o mesmo número é como o `maxLength` da caixa e o corte da gravação
 * deixam de combinar sem ninguém decidir isso.
 *
 * Sem `server-only`: o limite é lido também pelo componente que desenha a caixa.
 */

/**
 * Quantos caracteres cabem.
 *
 * Generoso para caber uma frase inteira ("pediram 12% e a indústria só deu 5,
 * fecharam com a Selpack"), curto o bastante para não virar depósito de texto
 * num campo que a lista mostra inteiro.
 */
export const LIMITE_DO_MOTIVO = 280;

/**
 * Lê o motivo do formulário.
 *
 * `null` quando o campo nem veio — que é diferente de veio vazio. A distinção
 * importa: formulário sem a caixa não opinou e não deve apagar o que já estava
 * escrito, enquanto caixa enviada em branco é alguém dizendo "não quero
 * escrever".
 */
export function motivoDoFormulario(formData: FormData, campo = "motivo"): string | null {
  const bruto = formData.get(campo);
  if (typeof bruto !== "string") return null;

  return bruto.trim().slice(0, LIMITE_DO_MOTIVO);
}
