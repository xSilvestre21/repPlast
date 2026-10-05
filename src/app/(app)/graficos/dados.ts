import {
  competenciaDe,
  competenciaDoPedido,
  deslocarCompetencia,
  metaVigente,
  pontualidadeEntrega,
  type ResumoComissao,
} from "@/lib/comissao";
import {
  contarPedidos,
  metasDoUsuario,
  pedidosDaCompetencia,
  pedidosDoIntervalo,
  prepostoDoPedido,
  resumirComissao,
  type PedidoDaComissao,
} from "@/lib/comissao-consulta";
import { corDoPreposto } from "@/lib/cor-preposto";
import type { DbOrganizacao } from "@/lib/db";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { centavos, itemDoGrafico } from "@/lib/grafico/item";
import type { ItemBarra, PontoSerie } from "@/lib/grafico/geometria";
import { SEMANTICAS } from "@/lib/grafico/paleta";
import { clientesSumidos } from "@/lib/positivacao";

import { nomeDoMes, rotuloCurtoDoMes } from "@/components/navegador-mes";
import { nomeCompleto } from "@/lib/nome-usuario";

import {
  clientesComUltimaCompra,
  orcamentosDoIntervalo,
  pedidosCanceladosDaCompetencia,
  pedidosCanceladosEntre,
} from "./consultas";

/**
 * Tudo que a aba de gráficos calcula, num lugar só.
 *
 * A tela, o PDF e o HTML autocontido leem daqui. É a mesma razão de
 * `comissao-consulta.ts` existir: um relatório que recalculasse por conta
 * própria acabaria discordando da tela que o gerou, e o erro apareceria como
 * número no lugar errado — não como falha.
 */

export interface Fatia extends ItemBarra {
  cor: string;
}

export interface DadosDosGraficos {
  competencia: string;
  /** "Setembro de 2026" — a legenda que viaja com cada gráfico. */
  mes: string;
  /** "abr/26 — set/26". */
  janela: string;
  meses: number;
  dias: number;

  resumo: ResumoComissao;
  /** Os quatro números do topo, já pela visão de quem está olhando. */
  vista: {
    previsto: ResumoComissao["valor"];
    recebido: ResumoComissao["valor"];
    aAcertar: ResumoComissao["valor"];
    diferenca: ResumoComissao["valor"];
  };
  pedidosDoMes: number;

  porIndustria: ItemBarra[];
  porCliente: ItemBarra[];
  /** `null` fora do plano Plus com papel de administrador. */
  porPreposto: ItemBarra[] | null;
  perdidos: ItemBarra[];

  serieMensal: PontoSerie[];
  abcDeClientes: ItemBarra[];

  conversao: Fatia[];
  totalOrcamentos: number;
  viraramPedido: number;
  /** Proposta importada não guarda o vínculo; sem isto o cartão parece fracasso. */
  conversaoSemHistorico: boolean;

  entregas: Fatia[];
  totalEntregas: number;
  semAtraso: number;

  sumidos: ItemBarra[];
}

export async function carregarDadosDosGraficos(
  db: DbOrganizacao,
  organizacaoId: string,
  opcoes: {
    ehAdmin: boolean;
    usuarioId: string;
    plano: string;
    competencia: string;
    meses: number;
    dias: number;
    /** Um instante só para toda a página, para as contagens não discordarem. */
    agora: number;
  },
): Promise<DadosDosGraficos> {
  const { ehAdmin, usuarioId, plano, competencia, meses, dias, agora } = opcoes;
  const doPreposto = ehAdmin ? null : usuarioId;
  const primeiraCompetencia = deslocarCompetencia(competencia, -(meses - 1));

  const [pedidos, cancelados, daJanela, orcamentos, clientes] = await Promise.all([
    pedidosDaCompetencia(db, organizacaoId, competencia, doPreposto),
    pedidosCanceladosDaCompetencia(db, organizacaoId, competencia, doPreposto),
    pedidosDoIntervalo(db, organizacaoId, primeiraCompetencia, competencia, doPreposto),
    orcamentosDoIntervalo(db, organizacaoId, primeiraCompetencia, competencia, doPreposto),
    clientesComUltimaCompra(db, organizacaoId, doPreposto),
  ]);

  const resumo = resumirComissao(pedidos);

  /*
   * As mesmas barras para os dois papéis, com números diferentes: o
   * administrador vê o que a indústria paga ao escritório, o preposto vê a
   * fatia dele. O corte acontece AQUI, montando os dados — o total do
   * escritório não chega a existir no objeto que a tela do preposto recebe.
   */
  const previstoDe = (grupo: PedidoDaComissao[]) => {
    const parcial = resumirComissao(grupo);
    return (ehAdmin ? parcial.valor : parcial.previstoDoPreposto).toNumber();
  };

  const recebidoDe = (grupo: PedidoDaComissao[]) => {
    const parcial = resumirComissao(grupo);
    return (ehAdmin ? parcial.recebido : parcial.recebidoDoPreposto).toNumber();
  };

  const vista = ehAdmin
    ? {
        previsto: resumo.valor,
        recebido: resumo.recebido,
        aAcertar: resumo.aAcertar,
        diferenca: resumo.diferenca,
      }
    : {
        previsto: resumo.previstoDoPreposto,
        recebido: resumo.recebidoDoPreposto,
        aAcertar: resumo.aAcertarDoPreposto,
        diferenca: resumo.diferencaDoPreposto,
      };

  const agrupar = (
    lista: PedidoDaComissao[],
    chave: (pedido: PedidoDaComissao) => string | null,
    rotulo: (pedido: PedidoDaComissao) => string,
    /** Para onde a linha leva ao ser clicada. Sem isto, ela não é clicável. */
    destino?: (chave: string) => string,
  ): ItemBarra[] => {
    const comChave = lista.filter((pedido) => chave(pedido) !== null);

    return [...Map.groupBy(comChave, (pedido) => chave(pedido)!).entries()].map(
      ([id, grupo]) => ({
        chave: id,
        rotulo: rotulo(grupo[0]),
        valor: previstoDe(grupo),
        // Pedidos, não itens: duas parcelas do mesmo pedido são um pedido.
        detalhe: `${contarPedidos(grupo)} ${contarPedidos(grupo) === 1 ? "pedido" : "pedidos"}`,
        href: destino?.(id),
      }),
    );
  };

  /*
   * A janela é montada mês a mês, e não a partir do que a consulta devolveu:
   * mês sem pedido precisa aparecer como zero. Fosse pelos dados, um mês vazio
   * sumiria do eixo e a linha pularia por cima dele, desenhando uma
   * continuidade que não houve.
   */
  const competencias = Array.from({ length: meses }, (_, i) =>
    deslocarCompetencia(competencia, -(meses - 1 - i)),
  );

  // A MESMA função de competência da tela de Comissões. É o que garante que o
  // ponto de setembro no gráfico seja o número de setembro na apuração.
  // Pela competência de cada ITEM — a parcela conta no mês do vencimento dela.
  const porMes = Map.groupBy(daJanela, (pedido) => pedido.competencia);

  const viraramPedido = orcamentos.filter((orcamento) => orcamento._count.pedidos > 0).length;

  // Uma entrega por pedido: as parcelas repetiriam a mesma entrega.
  const pontualidades = [...new Map(daJanela.map((pedido) => [pedido.id, pedido])).values()]
    .map((pedido) => pontualidadeEntrega(pedido.prazoEntrega, pedido.entregueEm))
    .filter((situacao) => situacao !== null);

  const contar = (situacao: string) =>
    pontualidades.filter((p) => p.situacao === situacao).length;

  return {
    competencia,
    mes: nomeDoMes(competencia),
    janela: `${rotuloCurtoDoMes(primeiraCompetencia)} — ${rotuloCurtoDoMes(competencia)}`,
    meses,
    dias,

    resumo,
    vista,
    pedidosDoMes: contarPedidos(pedidos),

    porIndustria: agrupar(
      pedidos,
      (pedido) => pedido.fornecedor.id,
      (pedido) => pedido.fornecedor.nome,
      (id) => `/fornecedores/${id}`,
    ),
    /*
     * Agrupado pelo ID, não pelo apelido.
     *
     * Era pelo apelido porque o id não vinha na consulta. Dois clientes com o
     * mesmo apelido — duas filiais da mesma empresa, por exemplo — caíam numa
     * linha só, somando comissão de CNPJs diferentes. Conferido no banco antes
     * de trocar: há um apelido repetido, e nenhum dos dois tem pedido, então a
     * troca não move nenhum número hoje. Passa a mover quando mover, e aí
     * estará certa.
     */
    porCliente: agrupar(
      pedidos,
      (pedido) => pedido.cliente.id,
      (pedido) => pedido.cliente.apelido,
      (id) => `/clientes/${id}`,
    ),
    /*
     * O gráfico por preposto NÃO É MONTADO fora do plano Plus com papel de
     * administrador — não é escondido depois. O que não entra aqui não entra
     * no HTML, nem no PDF, nem no payload que o navegador recebe.
     */
    porPreposto:
      ehAdmin && plano === "PLUS"
        ? agrupar(
            pedidos,
            (pedido) => prepostoDoPedido(pedido)?.id ?? null,
            (pedido) => prepostoDoPedido(pedido)!.nome,
          )
        : null,
    perdidos: cancelados.map((pedido) => ({
      chave: pedido.id,
      rotulo: `#${pedido.numero} · ${pedido.cliente.apelido}`,
      valor: Number(pedido.subtotalSemIpi.toString()),
      href: `/pedidos/${pedido.id}`,
    })),

    serieMensal: competencias.map((comp) => {
      const doMes = porMes.get(comp) ?? [];
      return {
        rotulo: rotuloCurtoDoMes(comp),
        // O eixo é curto por falta de espaço; o balão tem espaço e usa o nome
        // por extenso, que é como a pessoa pensa no mês.
        titulo: nomeDoMes(comp),
        href: `/comissoes?mes=${comp}`,
        valores: [previstoDe(doMes), recebidoDe(doMes)],
      };
    }),
    abcDeClientes: agrupar(
      daJanela,
      (pedido) => pedido.cliente.id,
      (pedido) => pedido.cliente.apelido,
      (id) => `/clientes/${id}`,
    ),

    conversao: [
      { chave: "fechou", rotulo: "Virou pedido", valor: viraramPedido, cor: SEMANTICAS.recebido },
      {
        chave: "aberto",
        rotulo: "Ainda não",
        valor: orcamentos.length - viraramPedido,
        cor: SEMANTICAS.residuo,
      },
    ],
    totalOrcamentos: orcamentos.length,
    viraramPedido,
    /*
     * A ligação proposta→pedido só existe para quem foi convertido AQUI: ela é
     * gravada em `Pedido.orcamentoId` na hora da conversão. As propostas que
     * vieram do sistema antigo não trazem esse vínculo, porque ele não era
     * guardado. Sem este aviso o cartão mostraria "0% fecharam" sobre um número
     * grande, que se lê como fracasso de venda em vez de lacuna do histórico.
     */
    conversaoSemHistorico: orcamentos.length > 0 && viraramPedido === 0,

    entregas: [
      { chave: "no_prazo", rotulo: "No prazo", valor: contar("no_prazo"), cor: SEMANTICAS.noPrazo },
      { chave: "atrasado", rotulo: "Atrasado", valor: contar("atrasado"), cor: SEMANTICAS.atrasado },
      {
        chave: "adiantado",
        rotulo: "Adiantado",
        valor: contar("adiantado"),
        cor: SEMANTICAS.adiantado,
      },
    ],
    totalEntregas: pontualidades.length,
    semAtraso: contar("no_prazo") + contar("adiantado"),

    sumidos: clientesSumidos(clientes, dias, agora).map((sumido) => ({
      chave: sumido.cliente.id,
      rotulo: sumido.cliente.apelido,
      valor: sumido.diasSemComprar,
      // É o gráfico em que o clique mais importa: quem sumiu é quem se vai
      // ligar, e a ficha tem o telefone.
      href: `/clientes/${sumido.cliente.id}`,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* A base da página interativa                                                */
/* -------------------------------------------------------------------------- */

/**
 * Quantos meses a página carrega. 24 e não 12 porque o mês a mês compara com
 * o mesmo período do ano anterior: doze meses na tela mais os doze de antes.
 */
export const MESES_DA_BASE = 24;

/**
 * Tudo que a página de gráficos manda ao navegador, numa ida ao banco.
 *
 * `carregarDadosDosGraficos` (acima) continua existindo para o PDF, o HTML e o
 * CSV, que ainda são montados no servidor com o mês e a janela fixos.
 *
 * Cada item sai pela visão de quem olha (`itemDoGrafico`), com a conta da
 * tela de Comissões — é o que faz os totais baterem com os de lá.
 */
export async function carregarBaseDosGraficos(
  db: DbOrganizacao,
  organizacaoId: string,
  opcoes: {
    ehAdmin: boolean;
    usuarioId: string;
    plano: string;
    competencia: string;
    agora: number;
  },
): Promise<BaseDosGraficos> {
  const { ehAdmin, usuarioId, plano, competencia, agora } = opcoes;
  const doPreposto = ehAdmin ? null : usuarioId;
  const comPreposto = ehAdmin && plano === "PLUS";

  const competencias = Array.from({ length: MESES_DA_BASE }, (_, i) =>
    deslocarCompetencia(competencia, -(MESES_DA_BASE - 1 - i)),
  );
  const primeira = competencias[0];

  const [pedidos, cancelados, orcamentos, clientes, metas, prepostos] = await Promise.all([
    pedidosDoIntervalo(db, organizacaoId, primeira, competencia, doPreposto),
    pedidosCanceladosEntre(db, organizacaoId, primeira, competencia, doPreposto),
    orcamentosDoIntervalo(db, organizacaoId, primeira, competencia, doPreposto),
    clientesComUltimaCompra(db, organizacaoId, doPreposto),
    metasDoUsuario(db, usuarioId),
    comPreposto
      ? db.usuario.findMany({
          where: { organizacaoId, papel: "REPRESENTANTE" },
          // A mesma ordem da tela de Comissões: é ela que decide a cor.
          orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
          select: { id: true, nome: true, sobrenome: true },
        })
      : Promise.resolve([]),
  ]);

  const itens = pedidos.map((pedido) => itemDoGrafico(pedido, { ehAdmin, comPreposto }));

  // Uma entrega por PEDIDO: as parcelas repetiriam a mesma mercadoria.
  const entregas = [...new Map(pedidos.map((p) => [p.id, p])).values()].flatMap((pedido) => {
    const pontualidade = pontualidadeEntrega(pedido.prazoEntrega, pedido.entregueEm);
    return pontualidade
      ? [
          {
            pedidoId: pedido.id,
            numero: pedido.numero,
            cliente: pedido.cliente.apelido,
            competencia: competenciaDoPedido(pedido.prazoEntrega, pedido.criadoEm),
            situacao: pontualidade.situacao,
          },
        ]
      : [];
  });

  const metasPorMes: Record<string, number> = {};
  for (const mes of competencias) {
    const valor = metaVigente(metas, mes)?.valor;
    if (valor) metasPorMes[mes] = centavos(valor);
  }

  return {
    competencia,
    competencias,
    rotulos: Object.fromEntries(
      competencias.map((mes) => [mes, { curto: rotuloCurtoDoMes(mes), longo: nomeDoMes(mes) }]),
    ),
    ehAdmin,
    comPreposto,
    itens,
    metas: metasPorMes,
    cancelados: cancelados.map((pedido) => ({
      pedidoId: pedido.id,
      numero: pedido.numero,
      cliente: pedido.cliente.apelido,
      fornecedor: pedido.fornecedor.nome,
      // `canceladoEm` é instante com hora: o mês é o do calendário de quem
      // cancelou, como em `pedidosCanceladosDaCompetencia`.
      competencia: competenciaDe(pedido.canceladoEm!),
      valor: centavos(pedido.subtotalSemIpi.toString()),
      motivo: pedido.motivoCancelamento,
    })),
    orcamentos: orcamentos.map((orcamento) => ({
      id: orcamento.id,
      numero: orcamento.numero,
      cliente: orcamento.cliente?.apelido ?? orcamento.clienteAvulsoNome ?? "—",
      // A janela de `orcamentosDoIntervalo` é em UTC; o mês sai da mesma régua.
      competencia: orcamento.criadoEm.toISOString().slice(0, 7),
      virou: orcamento._count.pedidos > 0,
      pedidoId: orcamento.pedidos[0]?.id ?? null,
    })),
    entregas,
    clientes: clientes.map((cliente) => ({
      id: cliente.id,
      apelido: cliente.apelido,
      ultimaCompra: cliente.ultimaCompra?.getTime() ?? null,
      ultimoValor: cliente.ultimoValor ? centavos(cliente.ultimoValor.toString()) : null,
    })),
    prepostos: prepostos.map((preposto, i) => ({
      id: preposto.id,
      nome: nomeCompleto(preposto),
      cor: corDoPreposto(i),
    })),
    agora,
  };
}
