import {
  competenciaDoPedido,
  deslocarCompetencia,
  pontualidadeEntrega,
  type ResumoComissao,
} from "@/lib/comissao";
import {
  pedidosDaCompetencia,
  pedidosDoIntervalo,
  prepostoDoPedido,
  resumirComissao,
  type PedidoDaComissao,
} from "@/lib/comissao-consulta";
import type { DbOrganizacao } from "@/lib/db";
import type { ItemBarra, PontoSerie } from "@/lib/grafico/geometria";
import { SEMANTICAS } from "@/lib/grafico/paleta";
import { clientesSumidos } from "@/lib/positivacao";

import { nomeDoMes, rotuloCurtoDoMes } from "@/components/navegador-mes";

import {
  clientesComUltimaCompra,
  orcamentosDoIntervalo,
  pedidosCanceladosDaCompetencia,
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
        detalhe: `${grupo.length} ${grupo.length === 1 ? "pedido" : "pedidos"}`,
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
  const porMes = Map.groupBy(daJanela, (pedido) =>
    competenciaDoPedido(pedido.prazoEntrega, pedido.criadoEm),
  );

  const viraramPedido = orcamentos.filter((orcamento) => orcamento._count.pedidos > 0).length;

  const pontualidades = daJanela
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
    pedidosDoMes: pedidos.length,

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
