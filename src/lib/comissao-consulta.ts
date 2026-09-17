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
  cliente: { id: string; apelido: string };
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
 * O que uma consulta de comissão precisa trazer.
 *
 * Fica numa constante porque são duas consultas — o mês e a janela de meses — e
 * um campo que entrasse só numa delas produziria um gráfico discordando da
 * tela pelo motivo mais difícil de achar: o dado certo, lido pela metade.
 */
const CAMPOS_DA_COMISSAO = {
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
  representanteId: true,
  valorRecebido: true,
  comissaoPercentualRecebido: true,
  cliente: { select: { id: true, apelido: true } },
  fornecedor: { select: { id: true, nome: true, comissaoPercentual: true } },
} as const;

/**
 * Resolve o preposto de cada pedido numa consulta à parte.
 *
 * O caminho natural seria `representante: { select: ... }` junto dos demais
 * campos, e era assim que estava. Acontece que o motor do Prisma 7.10 quebra o
 * plano de uma relação OPCIONAL em execuções encadeadas e dispara duas consultas
 * na mesma conexão sem esperar a primeira terminar — o `pg` avisa que vai parar
 * de tolerar isso na versão 9. As relações obrigatórias (`cliente`,
 * `fornecedor`) não sofrem disso; só a que aceita nulo.
 *
 * O RLS continua valendo aqui: a policy de `usuario` deixa o preposto ver só a
 * própria linha, exatamente como faria através da junção.
 */
async function comRepresentante<T extends { representanteId: string | null }>(
  db: DbOrganizacao,
  pedidos: T[],
) {
  const ids = [
    ...new Set(pedidos.map((p) => p.representanteId).filter((id) => id !== null)),
  ];

  const representantes = ids.length
    ? await db.usuario.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome: true, papel: true },
      })
    : [];

  const porId = new Map(representantes.map((r) => [r.id, r]));

  return pedidos.map(({ representanteId, ...pedido }) => ({
    ...pedido,
    representante: representanteId ? (porId.get(representanteId) ?? null) : null,
  }));
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

  const pedidos = await db.pedido.findMany({
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
    select: CAMPOS_DA_COMISSAO,
  });

  return comRepresentante(db, pedidos);
}

/**
 * Pedidos enviados numa JANELA de competências, da primeira à última.
 *
 * Uma consulta só, e não uma por mês. Doze idas ao banco para desenhar um
 * gráfico de doze pontos custariam doze transações — e cada `db` do projeto
 * abre transação própria para injetar o contexto do RLS. O agrupamento por mês
 * acontece depois, em memória, com `competenciaDoPedido` — a MESMA função que
 * a consulta de um mês usa, que é o que garante os dois baterem.
 */
export async function pedidosDoIntervalo(
  db: DbOrganizacao,
  organizacaoId: string,
  deCompetencia: string,
  ateCompetencia: string,
  apenasDoPreposto?: string | null,
) {
  const { de } = intervaloDaCompetenciaUtc(deCompetencia);
  const { ate } = intervaloDaCompetenciaUtc(ateCompetencia);

  const pedidos = await db.pedido.findMany({
    where: {
      organizacaoId,
      status: "ENVIADO",
      // Mesmo `OR` da consulta de um mês, e pela mesma razão: não existe
      // COALESCE num `where`, e sem a segunda condição o pedido sem prazo
      // marcado sumiria da série inteira.
      OR: [
        { prazoEntrega: { gte: de, lt: ate } },
        { prazoEntrega: null, criadoEm: { gte: de, lt: ate } },
      ],
      ...(apenasDoPreposto ? { representanteId: apenasDoPreposto } : {}),
    },
    orderBy: [{ prazoEntrega: "asc" }, { numero: "asc" }],
    select: CAMPOS_DA_COMISSAO,
  });

  return comRepresentante(db, pedidos);
}
