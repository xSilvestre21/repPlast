import "server-only";

import type { DbOrganizacao } from "@/lib/db";

/**
 * Com quem a comissão de um pedido NOVO se divide, e a fatia congelada dele.
 *
 * O preposto que lança é o próprio. O administrador lança para a carteira do
 * preposto o tempo todo, e a comissão continua sendo dele: se o cliente tem
 * UM preposto vinculado, o pedido já nasce com ele. Com vários, não há como
 * adivinhar qual — o pedido nasce do escritório e o preposto se escolhe no
 * cabeçalho. Sem nenhum, é do escritório mesmo.
 *
 * `representanteId` vem quando o pedido já tem dono definido (a proposta que
 * um preposto cotou): vale ele, com a fatia de hoje.
 */
export async function prepostoDoNovoPedido(
  db: DbOrganizacao,
  pedido: {
    organizacaoId: string;
    clienteId: string;
    usuarioId: string;
    ehAdmin: boolean;
    representanteId?: string | null;
  },
): Promise<{ representanteId: string | null; comissaoPercentualPreposto: string | null }> {
  const definido = pedido.representanteId ?? (pedido.ehAdmin ? null : pedido.usuarioId);

  const candidatos = await db.usuario.findMany({
    where: definido
      ? { id: definido, organizacaoId: pedido.organizacaoId, papel: "REPRESENTANTE" }
      : {
          organizacaoId: pedido.organizacaoId,
          papel: "REPRESENTANTE",
          clientes: { some: { clienteId: pedido.clienteId } },
        },
    select: { id: true, comissaoPercentualPadrao: true },
    take: 2,
  });

  const preposto = candidatos.length === 1 ? candidatos[0] : null;
  return {
    representanteId: preposto?.id ?? null,
    comissaoPercentualPreposto: preposto?.comissaoPercentualPadrao?.toString() ?? null,
  };
}
