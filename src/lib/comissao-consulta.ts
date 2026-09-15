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

import { intervaloDaCompetenciaUtc, somarComissao, type ResumoComissao } from "./comissao";
import type { DbOrganizacao } from "./db";

export interface PedidoDaComissao {
  id: string;
  numero: number;
  status: string;
  criadoEm: Date;
  enviadoEm: Date | null;
  prazoEntrega: Date | null;
  entregueEm: Date | null;
  subtotalSemIpi: { toString(): string };
  comissaoPercentual: { toString(): string } | null;
  comissaoPercentualPreposto: { toString(): string } | null;
  representante: { id: string; nome: string; papel: string } | null;
  valorRecebido: { toString(): string } | null;
  comissaoPercentualRecebido: { toString(): string } | null;
  cliente: { apelido: string };
  fornecedor: { id: string; nome: string; comissaoPercentual: { toString(): string } };
}

/**
 * O preposto a quem este pedido credita comissão — ou `null` quando o pedido é
 * do próprio escritório.
 *
 * O dono do escritório NÃO é preposto dele mesmo. Parece óbvio e não é: nada no
 * banco impede `representanteId` de apontar para um ADMIN, e quando isso
 * acontece a tela passa a mostrar o nome do dono onde deveria estar o de quem
 * vende por ele — e a lista "por preposto" ganha uma linha dizendo que ele deve
 * a si mesmo. Foi o que uma importação mal carimbada produziu.
 */
export function prepostoDoPedido(pedido: PedidoDaComissao) {
  const r = pedido.representante;
  return r && r.papel === "REPRESENTANTE" ? r : null;
}

/**
 * O acerto do pedido, quando já houve.
 *
 * Exige os DOIS campos: um acerto com base e sem percentual não é meio acerto,
 * é um formulário que não foi terminado — e contá-lo daria comissão zero, que
 * pareceria prejuízo em vez de pendência.
 */
export function acertoDoPedido(pedido: PedidoDaComissao) {
  if (pedido.valorRecebido === null || pedido.comissaoPercentualRecebido === null) return null;

  return {
    base: pedido.valorRecebido.toString(),
    percentual: pedido.comissaoPercentualRecebido.toString(),
  };
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
      percentualPreposto: p.comissaoPercentualPreposto?.toString() ?? null,
      acerto: acertoDoPedido(p),
    })),
  );
}

/**
 * Pedidos enviados na competência, com o necessário para calcular a comissão.
 *
 * `apenasDoPreposto` restringe à carteira de um preposto. O RLS já esconderia
 * o pedido de outro preposto, mas não o pedido DA CASA — aquele é visível a
 * todos por definição. Numa tela de comissão ele seria ruído: apareceria
 * rendendo zero, porque a fatia do preposto num pedido do escritório é zero.
 */
export async function pedidosDaCompetencia(
  db: DbOrganizacao,
  organizacaoId: string,
  competencia: string,
  apenasDoPreposto?: string | null,
) {
  const { de, ate } = intervaloDaCompetenciaUtc(competencia);

  return db.pedido.findMany({
    where: {
      organizacaoId,
      status: "ENVIADO",
      /*
       * A competência é a ENTREGA, com o envio como último recurso — é o
       * `deliveryDate || createdAt` do sistema anterior, escrito em Prisma.
       *
       * O `OR` é necessário porque não existe "COALESCE" num `where`: são duas
       * condições excludentes, e a segunda só vale para o pedido sem prazo
       * marcado. Sem ela, esse pedido sumiria de toda apuração.
       */
      OR: [
        { prazoEntrega: { gte: de, lt: ate } },
        { prazoEntrega: null, criadoEm: { gte: de, lt: ate } },
      ],
      ...(apenasDoPreposto ? { representanteId: apenasDoPreposto } : {}),
    },
    orderBy: [{ prazoEntrega: "asc" }, { numero: "asc" }],
    select: {
      id: true,
      numero: true,
      status: true,
      criadoEm: true,
      enviadoEm: true,
      prazoEntrega: true,
      entregueEm: true,
      subtotalSemIpi: true,
      comissaoPercentual: true,
      comissaoPercentualPreposto: true,
      representante: { select: { id: true, nome: true, papel: true } },
      valorRecebido: true,
      comissaoPercentualRecebido: true,
      cliente: { select: { apelido: true } },
      fornecedor: { select: { id: true, nome: true, comissaoPercentual: true } },
    },
  });
}
