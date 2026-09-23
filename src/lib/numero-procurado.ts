/**
 * O número do documento, quando foi ele que a pessoa digitou na busca.
 *
 * Serve ao orçamento e ao pedido. Mora aqui, e não numa cópia em cada consulta,
 * porque valor com dois donos se desencontra: nesta mesma base já houve um nome
 * de campo lido de um jeito num lado e escrito de outro no outro, e o resultado
 * foi IPI sumindo sem erro nenhum na tela (ver `ipi-do-formulario.ts`).
 */

/** O maior valor que cabe no `int` do Postgres, onde os dois `numero` moram. */
const MAIOR_INT = 2_147_483_647;

/**
 * O `#` entra na conta porque é assim que a tela escreve o número — "Orçamento
 * #180", "Pedido #2253" — e quem copia de lá copia com ele.
 *
 * A comparação que sai daqui é exata, e não "contém": `numero` é inteiro no
 * banco, onde `contains` nem se aplica, e o número existe justamente para o
 * documento ser citável ao telefone. Quem diz "o 7" quer o 7, não os dezoito
 * que têm 7 no meio.
 *
 * No PEDIDO um número pode casar com mais de uma linha, e isso é correto: a
 * numeração dele é por indústria (`@@unique([fornecedorId, numero])`), então o
 * 133 da ERIPACK e o 133 de outra convivem. A lista mostra a indústria ao lado
 * justamente para desempatar.
 */
export function numeroProcurado(texto: string): number | null {
  const digitos = texto.trim().replace(/^#\s*/, "");
  if (!/^\d+$/.test(digitos)) return null;

  const numero = Number(digitos);

  // Fora do alcance do `int` a consulta estouraria — e ali não há documento
  // nenhum para achar de qualquer forma.
  return numero >= 1 && numero <= MAIOR_INT ? numero : null;
}
