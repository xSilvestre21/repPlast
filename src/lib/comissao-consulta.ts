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

import {
  competenciaDoPedido,
  intervaloDaCompetenciaUtc,
  mesesDeMetaBatida,
  somarComissao,
  type LinhaMeta,
  type ResumoComissao,
} from "./comissao";
import type { DbOrganizacao } from "./db";

export interface PedidoDaComissao {
  id: string;
  numero: number;
  status: string;
  /** Preenchido só no cancelado, e nem sempre — escrever é opcional. */
  motivoCancelamento: string | null;
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
  /** "28/35/42" — de onde o editor de parcelas tira os dias sugeridos. */
  prazoPagamento: string | null;

  /**
   * O mês em que ESTE item conta. Para o pedido inteiro, a entrega; para uma
   * parcela, o vencimento dela. É por aqui que tudo agrupa por mês — não mais
   * por `competenciaDoPedido`, que não sabe de parcela.
   */
  competencia: string;
  /**
   * Preenchido quando o item é UMA parcela de um pedido parcelado. Aí
   * `subtotalSemIpi` e o acerto deixam de ser os do pedido e passam a ser os
   * dela (ver `expandirParcelas`).
   */
  parcela: { id: string; numero: number; total: number; vencimento: Date } | null;
  /** A venda inteira do pedido, mesmo quando o item é só uma parcela dela. */
  vendaDoPedido: { toString(): string };
  /** Todas as parcelas do pedido — o editor reabre com elas. Vazio sem parcelas. */
  parcelasDoPedido: ParcelaDoPedido[];
}

export interface ParcelaDoPedido {
  id: string;
  numero: number;
  vencimento: Date;
  base: { toString(): string };
  valorRecebido: { toString(): string } | null;
  comissaoPercentualRecebido: { toString(): string } | null;
}

/** O pedido como sai do banco, antes de virar item: sem os campos derivados. */
type PedidoBruto = Omit<
  PedidoDaComissao,
  "competencia" | "parcela" | "vendaDoPedido" | "parcelasDoPedido"
>;

/**
 * O pedido vira os itens que a comissão soma: ele mesmo, ou uma linha por
 * parcela.
 *
 * É aqui — e só aqui — que o parcelamento acontece. Cada parcela sai com a
 * base e o acerto DELA no lugar dos do pedido, e com o mês do vencimento como
 * competência; daí para frente `resumirComissao`, a meta, os gráficos e o CSV
 * somam itens sem saber que existe parcela. Fosse cada tela a tratar, bastaria
 * uma esquecer para o mês somar o pedido inteiro e a parcela juntos.
 *
 * O acerto do pedido é ignorado no parcelado: a ação de parcelar recusa pedido
 * já acertado, e cada parcela passa a ter o seu.
 */
export function expandirParcelas(
  pedido: PedidoBruto,
  parcelas: ParcelaDoPedido[],
): PedidoDaComissao[] {
  const ordenadas = [...parcelas].sort((a, b) => a.numero - b.numero);

  if (ordenadas.length === 0) {
    return [
      {
        ...pedido,
        competencia: competenciaDoPedido(pedido.prazoEntrega, pedido.criadoEm),
        parcela: null,
        vendaDoPedido: pedido.subtotalSemIpi,
        parcelasDoPedido: [],
      },
    ];
  }

  return ordenadas.map((p) => ({
    ...pedido,
    subtotalSemIpi: p.base,
    valorRecebido: p.valorRecebido,
    comissaoPercentualRecebido: p.comissaoPercentualRecebido,
    competencia: competenciaDoPedido(p.vencimento, p.vencimento),
    parcela: { id: p.id, numero: p.numero, total: ordenadas.length, vencimento: p.vencimento },
    vendaDoPedido: pedido.subtotalSemIpi,
    parcelasDoPedido: ordenadas,
  }));
}

/** Quantos PEDIDOS há numa lista de itens — duas parcelas do mesmo são um. */
export function contarPedidos(itens: { id: string }[]): number {
  return new Set(itens.map((i) => i.id)).size;
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
  // Para a linha do cancelado dizer POR QUE ela está ali zerada.
  motivoCancelamento: true,
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
  prazoPagamento: true,
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
 * As parcelas dos pedidos, numa consulta à parte — pelo mesmo motivo do
 * `comRepresentante`: relação aninhada no `select` faz o Prisma 7.10 encadear
 * consultas na mesma conexão. O RLS de `parcela_recebimento` segue o do pedido.
 */
async function parcelasDe(db: DbOrganizacao, pedidoIds: string[]) {
  if (pedidoIds.length === 0) return new Map<string, ParcelaDoPedido[]>();

  const parcelas = await db.parcelaRecebimento.findMany({
    where: { pedidoId: { in: pedidoIds } },
    orderBy: { numero: "asc" },
    select: {
      id: true,
      pedidoId: true,
      numero: true,
      vencimento: true,
      base: true,
      valorRecebido: true,
      comissaoPercentualRecebido: true,
    },
  });

  return Map.groupBy(parcelas, (p) => p.pedidoId);
}

/**
 * Os itens de comissão dos pedidos enviados com competência de `deCompetencia`
 * a `ateCompetencia`, já com as parcelas abertas.
 *
 * Busca o pedido que conta pela ENTREGA na janela — o `deliveryDate ||
 * createdAt` do SICOV; o `OR` existe porque não há COALESCE num `where` — e
 * também o que tem PARCELA vencendo nela, que pode ter sido entregue meses
 * antes. Depois de abrir as parcelas, o filtro final é pela competência de cada
 * item: o pedido parcelado que veio pela entrega mas não tem parcela na janela
 * sai aqui.
 *
 * O mês e a janela passam ambos por esta função, e é isso que garante o ponto
 * de setembro no gráfico ser o número de setembro na apuração.
 */
async function itensEnviadosEntre(
  db: DbOrganizacao,
  organizacaoId: string,
  deCompetencia: string,
  ateCompetencia: string,
  apenasDoPreposto?: string | null,
): Promise<PedidoDaComissao[]> {
  const { de } = intervaloDaCompetenciaUtc(deCompetencia);
  const { ate } = intervaloDaCompetenciaUtc(ateCompetencia);

  const brutos = await db.pedido.findMany({
    where: {
      organizacaoId,
      status: "ENVIADO",
      OR: [
        { prazoEntrega: { gte: de, lt: ate } },
        { prazoEntrega: null, criadoEm: { gte: de, lt: ate } },
        { parcelas: { some: { vencimento: { gte: de, lt: ate } } } },
      ],
      ...(apenasDoPreposto ? { representanteId: apenasDoPreposto } : {}),
    },
    select: CAMPOS_DA_COMISSAO,
  });

  const [pedidos, parcelas] = await Promise.all([
    comRepresentante(db, brutos),
    parcelasDe(
      db,
      brutos.map((p) => p.id),
    ),
  ]);

  const quando = (item: PedidoDaComissao) =>
    (item.parcela?.vencimento ?? item.prazoEntrega ?? item.criadoEm).getTime();

  return pedidos
    .flatMap((pedido) => expandirParcelas(pedido, parcelas.get(pedido.id) ?? []))
    .filter((item) => item.competencia >= deCompetencia && item.competencia <= ateCompetencia)
    .sort(
      (a, b) =>
        quando(a) - quando(b) ||
        a.numero - b.numero ||
        (a.parcela?.numero ?? 0) - (b.parcela?.numero ?? 0),
    );
}

/**
 * Os itens de comissão da competência: pedidos enviados e parcelas que vencem
 * nela.
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
  return itensEnviadosEntre(db, organizacaoId, competencia, competencia, apenasDoPreposto);
}

/**
 * Os CANCELADOS da mesma competência — para aparecer, não para somar.
 *
 * Consulta à parte, e não um `status: { in: [...] }` na de cima, de propósito:
 * `pedidosDaCompetencia` alimenta também os gráficos, a exportação em CSV e o
 * painel, e alargá-la mudaria os três de uma vez sem ninguém pedir. O caminho
 * do dinheiro fica intocado; quem quiser mostrar o cancelado junto pede as duas
 * listas e soma só a primeira.
 *
 * A competência é a MESMA regra do enviado (entrega, com a criação como último
 * recurso). Assim o pedido aparece no mês a que pertencia, e não no mês em que
 * alguém o cancelou — essa outra pergunta, "o que eu perdi neste mês", é do
 * gráfico de cancelados, que filtra por `canceladoEm`.
 *
 * Entram os cancelados que nunca foram enviados também. Poderia-se argumentar
 * que só o "enviado e depois cancelado" interessa, já que só ele chegou a
 * contar — mas no acervo real os dez cancelados nunca foram enviados, e esse
 * corte deixaria a tela exatamente como estava.
 */
export async function canceladosDaCompetencia(
  db: DbOrganizacao,
  organizacaoId: string,
  competencia: string,
  apenasDoPreposto?: string | null,
) {
  const { de, ate } = intervaloDaCompetenciaUtc(competencia);

  const pedidos = await db.pedido.findMany({
    where: {
      organizacaoId,
      status: "CANCELADO",
      OR: [
        { prazoEntrega: { gte: de, lt: ate } },
        { prazoEntrega: null, criadoEm: { gte: de, lt: ate } },
      ],
      ...(apenasDoPreposto ? { representanteId: apenasDoPreposto } : {}),
    },
    orderBy: [{ prazoEntrega: "asc" }, { numero: "asc" }],
    select: CAMPOS_DA_COMISSAO,
  });

  // Inteiro, sem abrir parcela: o cancelado está na lista para ser visto, não
  // somado, e parcela de pedido cancelado não vence.
  return (await comRepresentante(db, pedidos)).flatMap((p) => expandirParcelas(p, []));
}

/**
 * Pedidos enviados numa JANELA de competências, da primeira à última.
 *
 * Uma consulta só, e não uma por mês. Doze idas ao banco para desenhar um
 * gráfico de doze pontos custariam doze transações — e cada `db` do projeto
 * abre transação própria para injetar o contexto do RLS. O agrupamento por mês
 * acontece depois, em memória, pela `competencia` de cada item — a mesma que a
 * consulta de um mês filtra, que é o que garante os dois baterem.
 */
export async function pedidosDoIntervalo(
  db: DbOrganizacao,
  organizacaoId: string,
  deCompetencia: string,
  ateCompetencia: string,
  apenasDoPreposto?: string | null,
) {
  return itensEnviadosEntre(db, organizacaoId, deCompetencia, ateCompetencia, apenasDoPreposto);
}

/**
 * Todas as metas que a pessoa já definiu, uma por mês em que mudou.
 *
 * São poucas linhas — uma a cada troca de meta —, então vêm todas de uma vez e
 * `metaVigente` escolhe a de cada mês em memória. O RLS já limita à própria
 * pessoa; o `usuarioId` no `where` é a defesa em profundidade de sempre.
 */
export async function metasDoUsuario(db: DbOrganizacao, usuarioId: string): Promise<LinhaMeta[]> {
  const linhas = await db.metaComissao.findMany({
    where: { usuarioId },
    orderBy: { competencia: "asc" },
    select: { competencia: true, valor: true },
  });

  return linhas.map((l) => ({ competencia: l.competencia, valor: l.valor?.toString() ?? null }));
}

/**
 * Os meses em que a pessoa bateu a meta daquele mês, da primeira meta até `ate`.
 *
 * Mede o mesmo número que a tela de comissões mede: o RECEBIDO, e na leitura de
 * quem olha — o do escritório para o administrador, a fatia do preposto para
 * ele. Uma consulta para o intervalo inteiro, agrupada por mês com
 * `competenciaDoPedido`, como os gráficos fazem.
 */
export async function mesesComMetaBatida(
  db: DbOrganizacao,
  organizacaoId: string,
  usuarioId: string,
  ehAdmin: boolean,
  linhas: LinhaMeta[],
  ate: string,
): Promise<string[]> {
  const de = linhas[0]?.competencia;
  if (!de || de > ate) return [];

  const pedidos = await pedidosDoIntervalo(db, organizacaoId, de, ate, ehAdmin ? null : usuarioId);

  const alcancado = new Map(
    [...Map.groupBy(pedidos, (p) => p.competencia)].map(
      ([mes, doMes]) => {
        const resumo = resumirComissao(doMes);
        return [mes, (ehAdmin ? resumo.recebido : resumo.recebidoDoPreposto).toString()];
      },
    ),
  );

  return mesesDeMetaBatida(linhas, alcancado, de, ate);
}
