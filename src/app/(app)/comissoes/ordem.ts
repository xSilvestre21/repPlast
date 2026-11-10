/**
 * A ordem das linhas de cada indústria em Comissões.
 *
 * "entrega" é a de sempre — a do SICOV, pela entrega prometida (ou a criação),
 * que já sai assim de `itensEnviadosEntre`, com os cancelados no fim. "numero"
 * é para quem confere o extrato da indústria, que vem pelo número do pedido:
 * com quarenta pedidos dela no mês, achar o #2253 pela data era rolar a lista
 * inteira.
 *
 * Mora na URL (`?ordem=numero`), como o mês e a indústria: F5, link copiado e
 * o voltar do navegador trazem a mesma visão. O padrão fica fora da URL.
 */

export type OrdemComissao = "entrega" | "numero";

/** O que veio na URL — qualquer coisa que não seja "numero" é a ordem de sempre. */
export function ordemDoParametro(valor: unknown): OrdemComissao {
  return valor === "numero" ? "numero" : "entrega";
}

/**
 * Pelo número do pedido, e as parcelas do mesmo pedido juntas, na ordem delas.
 *
 * O cancelado entra no lugar do número dele, e não no fim: quem ordena por
 * número procura pelo número, e "cadê o #2253?" tem de achar a linha que diz
 * que ele foi cancelado.
 *
 * A numeração é por indústria (`@@unique([fornecedorId, numero])`); a tela
 * ordena dentro de cada uma, onde o número não se repete.
 */
export function ordenarPorNumero<T extends { numero: number; parcela: { numero: number } | null }>(
  itens: readonly T[],
): T[] {
  return [...itens].sort(
    (a, b) => a.numero - b.numero || (a.parcela?.numero ?? 0) - (b.parcela?.numero ?? 0),
  );
}
