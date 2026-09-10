/**
 * Consultas de comissão.
 *
 * A comissão é DERIVADA dos pedidos: o percentual fica congelado em cada um ao
 * ser criado, então somar os enviados do mês dá sempre o mesmo resultado que o
 * usuário viu na época. Não há tabela de apuração para manter em dia.
 *
 * Vive num módulo próprio porque o painel inicial e a tela de comissões
 * precisam exatamente do mesmo número — e duplicar a consulta seria pedir para
 * os dois divergirem.
 */

import { intervaloDaCompetencia, somarComissao, type ResumoComissao } from "./comissao";
import type { DbOrganizacao } from "./db";

export interface PedidoDaComissao {
  id: string;
  numero: number;
  status: string;
  enviadoEm: Date | null;
  subtotalSemIpi: { toString(): string };
  comissaoPercentual: { toString(): string } | null;
  cliente: { apelido: string };
  fornecedor: { id: string; nome: string; comissaoPercentual: { toString(): string } };
}

/**
 * Percentual que vale para o pedido.
 *
 * Cai no percentual da indústria apenas para dados antigos, gravados antes de o
 * congelamento existir.
 */
export function percentualDoPedido(pedido: PedidoDaComissao): string {
  return (pedido.comissaoPercentual ?? pedido.fornecedor.comissaoPercentual).toString();
}

export function resumirComissao(pedidos: PedidoDaComissao[]): ResumoComissao {
  return somarComissao(
    pedidos.map((p) => ({
      base: p.subtotalSemIpi.toString(),
      percentual: percentualDoPedido(p),
    })),
  );
}

/** Pedidos enviados na competência, com o necessário para calcular a comissão. */
export async function pedidosDaCompetencia(
  db: DbOrganizacao,
  organizacaoId: string,
  competencia: string,
) {
  const { de, ate } = intervaloDaCompetencia(competencia);

  return db.pedido.findMany({
    where: { organizacaoId, status: "ENVIADO", enviadoEm: { gte: de, lt: ate } },
    orderBy: { enviadoEm: "asc" },
    select: {
      id: true,
      numero: true,
      status: true,
      enviadoEm: true,
      subtotalSemIpi: true,
      comissaoPercentual: true,
      cliente: { select: { apelido: true } },
      fornecedor: { select: { id: true, nome: true, comissaoPercentual: true } },
    },
  });
}
