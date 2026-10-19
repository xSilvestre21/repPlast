/**
 * Por que um cadastro não pode ser excluído — a mesma frase em dois lugares.
 *
 * A tela usa para avisar ANTES (a janela de excluir abre dizendo que não dá, e
 * o que fazer no lugar), e a ação do servidor para recusar se, entre abrir a
 * página e clicar, alguém lançou um pedido. Escritas uma vez aqui, as duas não
 * se desencontram.
 *
 * `null` é "pode excluir".
 */

import { emFrase, quantos } from "@/lib/quantos";

export function recusaExcluirCliente(pedidos: number): string | null {
  if (pedidos === 0) return null;
  return (
    `Este cliente tem ${quantos(pedidos, "pedido", "pedidos")} e não pode ser excluído. Se ele ` +
    "parou de comprar, use “Marcar como inativo”: sai das listas e continua nos pedidos antigos."
  );
}

export function recusaExcluirIndustria(uso: {
  produtos: number;
  pedidos: number;
  propostas: number;
}): string | null {
  const onde = [
    uso.produtos > 0 && quantos(uso.produtos, "produto cadastrado", "produtos cadastrados"),
    uso.pedidos > 0 && quantos(uso.pedidos, "pedido", "pedidos"),
    uso.propostas > 0 && quantos(uso.propostas, "proposta", "propostas"),
  ].filter((parte): parte is string => typeof parte === "string");
  if (onde.length === 0) return null;

  return (
    `Esta indústria tem ${emFrase(onde)} e não pode ser excluída. Se você não a representa ` +
    "mais, use “Marcar como inativa”: ela sai das listas e continua nos documentos antigos."
  );
}

export function recusaExcluirProduto(itensDePedido: number): string | null {
  if (itensDePedido === 0) return null;
  const onde = itensDePedido === 1 ? "1 pedido" : `${itensDePedido} itens de pedido`;
  return (
    `Este produto está em ${onde} e não pode ser excluído. Se não é mais vendido, use ` +
    "“Marcar como inativo”: sai das listas e continua nos pedidos antigos."
  );
}
