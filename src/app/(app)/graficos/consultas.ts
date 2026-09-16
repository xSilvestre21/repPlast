import { intervaloDaCompetencia, intervaloDaCompetenciaUtc } from "@/lib/comissao";
import type { DbOrganizacao } from "@/lib/db";

/**
 * Leituras que só a aba de gráficos faz.
 *
 * O que já existia fica onde está: a comissão sai inteira de
 * `comissao-consulta.ts`, e é de propósito — se esta aba montasse a própria
 * consulta, ela e a tela de Comissões passariam a discordar sobre o mesmo mês
 * sem ninguém perceber.
 */

export interface PedidoCancelado {
  id: string;
  numero: number;
  canceladoEm: Date | null;
  subtotalSemIpi: { toString(): string };
  cliente: { apelido: string };
  fornecedor: { id: string; nome: string };
}

/**
 * Pedidos cancelados no mês.
 *
 * **A chave é `canceladoEm`, não a competência do pedido.** As duas respondem
 * perguntas diferentes: pela competência, um pedido com entrega em dezembro que
 * eu cancelo hoje só apareceria em dezembro — e a pergunta que este gráfico
 * responde é "o que eu perdi neste mês", que é sobre quando a perda aconteceu.
 *
 * O sistema anterior não tinha este gráfico, então não há comportamento a
 * reproduzir: é decisão nova, e está escrita aqui para poder ser revista.
 *
 * O intervalo é o local, e não o UTC de `prazoEntrega`: `canceladoEm` é um
 * instante de verdade, gravado com hora, e o mês de quem cancelou é o do
 * calendário dele.
 */
export async function pedidosCanceladosDaCompetencia(
  db: DbOrganizacao,
  organizacaoId: string,
  competencia: string,
  apenasDoPreposto?: string | null,
) {
  const { de, ate } = intervaloDaCompetencia(competencia);

  return db.pedido.findMany({
    where: {
      organizacaoId,
      status: "CANCELADO",
      canceladoEm: { gte: de, lt: ate },
      ...(apenasDoPreposto ? { representanteId: apenasDoPreposto } : {}),
    },
    orderBy: [{ canceladoEm: "desc" }],
    select: {
      id: true,
      numero: true,
      canceladoEm: true,
      subtotalSemIpi: true,
      cliente: { select: { apelido: true } },
      fornecedor: { select: { id: true, nome: true } },
    },
  });
}

/**
 * Propostas criadas na janela, sabendo quantas viraram pedido.
 *
 * O dado já existia e não aparecia em lugar nenhum: `Orcamento` tem a relação
 * com `Pedido`, então "virou pedido" é só contar essa relação — não precisa de
 * campo novo nem de carimbo no momento da conversão.
 *
 * A janela é pela criação da proposta, e não pela conversão: a pergunta é
 * "das que eu mandei neste mês, quantas fecharam", que é sobre o esforço do
 * mês. Contar pela conversão misturaria proposta antiga fechando agora.
 */
export async function orcamentosDoIntervalo(
  db: DbOrganizacao,
  organizacaoId: string,
  deCompetencia: string,
  ateCompetencia: string,
  apenasDoPreposto?: string | null,
) {
  const { de } = intervaloDaCompetenciaUtc(deCompetencia);
  const { ate } = intervaloDaCompetenciaUtc(ateCompetencia);

  return db.orcamento.findMany({
    where: {
      organizacaoId,
      criadoEm: { gte: de, lt: ate },
      ...(apenasDoPreposto ? { representanteId: apenasDoPreposto } : {}),
    },
    select: {
      id: true,
      criadoEm: true,
      status: true,
      _count: { select: { pedidos: true } },
    },
  });
}

/**
 * Clientes que já compraram, com a data da última compra.
 *
 * É a mesma leitura do painel inicial, e de propósito: positivação conta pelo
 * ENVIO (`enviadoEm`), não pela competência da comissão. As duas datas
 * respondem perguntas diferentes — "quando esse cliente comprou pela última
 * vez" não é "em que mês essa comissão cai" — e uniformizá-las estragaria as
 * duas telas de uma vez.
 */
export async function clientesComUltimaCompra(
  db: DbOrganizacao,
  organizacaoId: string,
  apenasDoPreposto?: string | null,
) {
  const clientes = await db.cliente.findMany({
    where: {
      organizacaoId,
      ativo: true,
      pedidos: { some: { status: "ENVIADO" } },
      ...(apenasDoPreposto ? { representanteId: apenasDoPreposto } : {}),
    },
    select: {
      id: true,
      apelido: true,
      pedidos: {
        where: { status: "ENVIADO" },
        orderBy: { enviadoEm: "desc" },
        take: 1,
        select: { enviadoEm: true, totalGeral: true },
      },
    },
  });

  return clientes.map((cliente) => ({
    id: cliente.id,
    apelido: cliente.apelido,
    ultimaCompra: cliente.pedidos[0]?.enviadoEm ?? null,
    ultimoValor: cliente.pedidos[0]?.totalGeral ?? null,
  }));
}
