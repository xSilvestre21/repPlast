/**
 * Monta o relatório dos gráficos.
 *
 * Isolado da rota pela mesma razão de `gerar-pedido.tsx`: o que muda entre o
 * PDF e o HTML autocontido é só o desenho, e a LISTA DE SEÇÕES precisa ser a
 * mesma nos dois — senão um relatório passa a ter um cartão que o outro não
 * tem, e ninguém percebe até alguém comparar.
 */

import { renderToBuffer } from "@react-pdf/renderer";

import type { DadosDosGraficos } from "@/app/(app)/graficos/dados";
import { SERIES_DA_COMISSAO } from "../grafico/paleta";
import {
  DocumentoGraficos,
  type DadosDoRelatorio,
  type Secao,
} from "./documento-graficos";

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (valor: { toString(): string }) => MOEDA.format(Number(valor.toString()));

/**
 * As seções do relatório, na ordem em que a tela as mostra.
 *
 * Um cartão vazio na tela vira um parágrafo dizendo por que está vazio, e não
 * some: num relatório impresso, a ausência de uma seção se lê como esquecimento
 * — e quem recebe não tem como saber se não houve pedido cancelado ou se o
 * relatório é que deixou de contar.
 */
export function secoesDoRelatorio(dados: DadosDosGraficos): Secao[] {
  const secoes: Secao[] = [];

  const barrasOuTexto = (
    titulo: string,
    periodo: string,
    itens: DadosDosGraficos["porCliente"],
    vazio: string,
    extra: Partial<Extract<Secao, { tipo: "barras" }>> = {},
  ) => {
    secoes.push(
      itens.length > 0
        ? { tipo: "barras", titulo, periodo, itens, ...extra }
        : { tipo: "texto", titulo, periodo, corpo: vazio },
    );
  };

  barrasOuTexto(
    "Comissão por indústria",
    dados.mes,
    dados.porIndustria,
    "Nenhum pedido enviado neste mês.",
    { rotuloResiduo: "Outras" },
  );

  barrasOuTexto(
    "Comissão por cliente",
    dados.mes,
    dados.porCliente,
    "Nenhum pedido enviado neste mês.",
  );

  if (dados.porPreposto) {
    barrasOuTexto(
      "Comissão por preposto",
      dados.mes,
      dados.porPreposto,
      "Nenhum pedido deste mês está creditado a um preposto.",
    );
  }

  barrasOuTexto(
    "Pedidos cancelados",
    dados.mes,
    dados.perdidos,
    "Nenhum pedido cancelado neste mês.",
  );

  secoes.push(
    dados.abcDeClientes.length > 0
      ? {
          tipo: "serie",
          titulo: "Comissão mês a mês",
          periodo: dados.janela,
          pontos: dados.serieMensal,
          series: SERIES_DA_COMISSAO,
        }
      : {
          tipo: "texto",
          titulo: "Comissão mês a mês",
          periodo: dados.janela,
          corpo: "Nenhum pedido enviado nesta janela.",
        },
  );

  barrasOuTexto(
    "Curva ABC de clientes",
    dados.janela,
    dados.abcDeClientes,
    "Nenhum pedido enviado nesta janela.",
  );

  secoes.push({
    tipo: "texto",
    titulo: "Orçamento que virou pedido",
    periodo: dados.janela,
    corpo:
      dados.totalOrcamentos === 0
        ? "Nenhuma proposta criada nesta janela."
        : dados.conversaoSemHistorico
          ? `Nenhuma das ${dados.totalOrcamentos} propostas desta janela foi convertida aqui. Proposta importada do sistema antigo não guarda essa ligação — o número passa a valer para as criadas no RepPlast.`
          : `${dados.viraramPedido} de ${dados.totalOrcamentos} propostas viraram pedido (${Math.round(
              (dados.viraramPedido / dados.totalOrcamentos) * 100,
            )}%).`,
  });

  secoes.push({
    tipo: "texto",
    titulo: "Pontualidade de entrega",
    periodo: dados.janela,
    corpo:
      dados.totalEntregas === 0
        ? "Nenhum pedido desta janela tem entrega registrada."
        : `${dados.entregas
            .filter((fatia) => fatia.valor > 0)
            .map((fatia) => `${fatia.rotulo}: ${fatia.valor}`)
            .join(" · ")} — ${Math.round(
            (dados.semAtraso / dados.totalEntregas) * 100,
          )}% sem atraso em ${dados.totalEntregas} entregas.`,
  });

  barrasOuTexto(
    "Clientes sumidos",
    `Sem comprar há mais de ${dados.dias} dias`,
    dados.sumidos,
    `Ninguém passou de ${dados.dias} dias sem comprar.`,
    { unidade: "dias", mostrarTotal: false },
  );

  return secoes;
}

export function relatorioDosGraficos(
  dados: DadosDosGraficos,
  escritorio: string,
): DadosDoRelatorio {
  return {
    escritorio,
    mes: dados.mes,
    janela: dados.janela,
    totais: [
      { rotulo: "Previsto", valor: moeda(dados.vista.previsto) },
      { rotulo: "Recebido", valor: moeda(dados.vista.recebido) },
      {
        rotulo: "A acertar",
        valor: moeda(dados.vista.aAcertar),
        detalhe: `${dados.pedidosDoMes} ${dados.pedidosDoMes === 1 ? "pedido" : "pedidos"} no mês`,
      },
      { rotulo: "Diferença", valor: moeda(dados.vista.diferenca) },
    ],
    secoes: secoesDoRelatorio(dados),
  };
}

export async function gerarPdfDosGraficos(relatorio: DadosDoRelatorio): Promise<Buffer> {
  return renderToBuffer(<DocumentoGraficos dados={relatorio} />);
}

/** "repplast-graficos-2026-09.pdf" */
export function nomeArquivoGraficos(competencia: string, extensao: string): string {
  return `repplast-graficos-${competencia}.${extensao}`;
}
