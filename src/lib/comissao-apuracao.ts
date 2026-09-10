/**
 * Apuração de comissão gravada no banco.
 *
 * O motor de cálculo mora em `comissao.ts`, puro e testado. Aqui é só a parte
 * que fala com o banco: junta os pedidos do mês, chama o motor e guarda o
 * resultado.
 *
 * Por que GRAVAR em vez de calcular na leitura: a regra de faixas é uma
 * configuração do fornecedor, e ela muda com o tempo. Recalcular meses
 * passados com a configuração de hoje daria um número diferente do que o
 * usuário viu — e do que a indústria pagou.
 */

import Decimal from "decimal.js";

import {
  type ConfigComissao,
  type ModoFaixa,
  type UnidadeMeta,
  apurar,
  competenciaDe,
  intervaloDaCompetencia,
} from "./comissao";
import type { DbOrganizacao } from "./db";

/**
 * Recalcula e grava a apuração de um fornecedor num mês.
 *
 * Chamada sempre que um pedido entra ou sai da contagem — envio, cancelamento,
 * reabertura. Refaz o mês inteiro em vez de somar diferenças: com faixa
 * retroativa um pedido novo muda a comissão dos anteriores, então cálculo
 * incremental daria errado.
 */
export async function recalcularApuracao(
  db: DbOrganizacao,
  organizacaoId: string,
  fornecedorId: string,
  competencia: string,
): Promise<void> {
  const fornecedor = await db.fornecedor.findFirst({
    where: { id: fornecedorId, organizacaoId },
    select: {
      comissaoPercentual: true,
      unidadeMeta: true,
      modoFaixa: true,
      faixas: { orderBy: { minimo: "asc" } },
    },
  });

  if (!fornecedor) return;

  const { de, ate } = intervaloDaCompetencia(competencia);

  const pedidos = await db.pedido.findMany({
    where: {
      organizacaoId,
      fornecedorId,
      status: "ENVIADO",
      enviadoEm: { gte: de, lt: ate },
    },
    select: {
      id: true,
      subtotalSemIpi: true,
      pesoTotalKg: true,
      comissaoPercentual: true,
    },
  });

  const config: ConfigComissao = {
    percentualBase: fornecedor.comissaoPercentual.toString(),
    modo: fornecedor.modoFaixa as ModoFaixa,
    unidadeMeta: fornecedor.unidadeMeta as UnidadeMeta,
    faixas: fornecedor.faixas.map((f) => ({
      minimo: f.minimo.toString(),
      percentual: f.percentual.toString(),
    })),
  };

  const baseReais = pedidos.reduce(
    (acc, p) => acc.plus(p.subtotalSemIpi.toString()),
    new Decimal(0),
  );
  const baseKg = pedidos.reduce((acc, p) => acc.plus(p.pesoTotalKg.toString()), new Decimal(0));

  const volumeMeta = config.unidadeMeta === "KG" ? baseKg : baseReais;
  const resultado = apurar(config, { volumeMeta, baseReais });

  /*
   * Pedidos com percentual próprio são exceção combinada com a indústria: eles
   * contam para o VOLUME (é venda) mas rendem o percentual deles, e não o da
   * faixa. Os demais dividem a comissão do mês na proporção da própria base —
   * com faixa progressiva não existe "a comissão daquele pedido" isolada, já
   * que o valor depende do que veio antes no mês.
   */
  const comExcecao = pedidos.filter((p) => p.comissaoPercentual !== null);
  const semExcecao = pedidos.filter((p) => p.comissaoPercentual === null);

  const baseSemExcecao = semExcecao.reduce(
    (acc, p) => acc.plus(p.subtotalSemIpi.toString()),
    new Decimal(0),
  );

  const valorExcecoes = comExcecao.reduce(
    (acc, p) =>
      acc.plus(
        new Decimal(p.subtotalSemIpi.toString())
          .times(p.comissaoPercentual!.toString())
          .dividedBy(100),
      ),
    new Decimal(0),
  );

  // A parte apurada por faixa incide só sobre quem segue a regra da indústria.
  const valorPorFaixa = baseSemExcecao.times(resultado.percentualEfetivo).dividedBy(100);
  const valorTotal = valorPorFaixa.plus(valorExcecoes);

  const apuracao = await db.comissaoApuracao.upsert({
    where: { fornecedorId_competencia: { fornecedorId, competencia } },
    create: {
      organizacaoId,
      fornecedorId,
      competencia,
      baseReais: baseReais.toDecimalPlaces(2).toString(),
      baseKg: baseKg.toDecimalPlaces(3).toString(),
      percentualAplicado: resultado.percentualEfetivo.toDecimalPlaces(3).toString(),
      valorComissao: valorTotal.toDecimalPlaces(2).toString(),
    },
    update: {
      baseReais: baseReais.toDecimalPlaces(2).toString(),
      baseKg: baseKg.toDecimalPlaces(3).toString(),
      percentualAplicado: resultado.percentualEfetivo.toDecimalPlaces(3).toString(),
      valorComissao: valorTotal.toDecimalPlaces(2).toString(),
    },
    select: { id: true },
  });

  /*
   * Os lançamentos são o detalhamento por pedido da apuração corrente, e por
   * isso são refeitos junto com ela.
   *
   * Não há lançamento de ESTORNO para pedido cancelado: como a comissão só
   * conta no envio e não existe controle de pagamento, nada foi recebido para
   * ser estornado — o pedido simplesmente deixa de contar, e o cancelamento
   * fica registrado no próprio pedido. O tipo ESTORNO existe no schema para
   * quando houver baixa de recebimento.
   */
  await db.comissaoLancamento.deleteMany({ where: { apuracaoId: apuracao.id } });

  if (pedidos.length > 0) {
    await db.comissaoLancamento.createMany({
      data: pedidos.map((pedido) => {
        const base = new Decimal(pedido.subtotalSemIpi.toString());
        const percentual = pedido.comissaoPercentual
          ? new Decimal(pedido.comissaoPercentual.toString())
          : resultado.percentualEfetivo;

        return {
          apuracaoId: apuracao.id,
          pedidoId: pedido.id,
          tipo: "LANCAMENTO" as const,
          base: base.toDecimalPlaces(2).toString(),
          percentual: percentual.toDecimalPlaces(3).toString(),
          valor: base.times(percentual).dividedBy(100).toDecimalPlaces(2).toString(),
          motivo: pedido.comissaoPercentual ? "Percentual combinado neste pedido" : null,
        };
      }),
    });
  }
}

/**
 * Recalcula as competências afetadas por uma mudança de status.
 *
 * São duas quando o pedido sai de um mês: desmarcar o envio zera `enviadoEm`,
 * então a competência antiga precisa ser refeita sem ele.
 */
export async function recalcularAposMudancaDeStatus(
  db: DbOrganizacao,
  organizacaoId: string,
  fornecedorId: string,
  datas: (Date | null)[],
): Promise<void> {
  const competencias = new Set(
    datas.filter((data): data is Date => data !== null).map(competenciaDe),
  );

  for (const competencia of competencias) {
    await recalcularApuracao(db, organizacaoId, fornecedorId, competencia);
  }
}
