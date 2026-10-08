import type { Prisma } from "@/generated/prisma/client";

/**
 * As indústrias que se oferecem para escolher: para o preposto, só as marcadas
 * para ele; para o administrador, todas.
 *
 * O RLS deixa o preposto LER também a indústria de um pedido que ele vê (o do
 * escritório, ou um dele de indústria que foi desmarcada), para o pedido não
 * chegar sem nome. Ler não é poder usar: toda lista de onde se escolhe ou se
 * navega para uma indústria passa por este filtro, e criar pedido ou orçamento
 * com indústria não marcada o banco recusa de todo jeito.
 */
export function soIndustriasMarcadas(ator: {
  ehAdmin: boolean;
  usuarioId: string;
}): Prisma.FornecedorWhereInput {
  return ator.ehAdmin ? {} : { prepostos: { some: { usuarioId: ator.usuarioId } } };
}
