import Decimal from "decimal.js";

import { competenciaDe, deslocarCompetencia } from "@/lib/comissao";
import {
  acertoDoPedido,
  pedidosDaCompetencia,
  pedidosDoIntervalo,
  percentualDoPedido,
  prepostoDoPedido,
  resumirComissao,
  type PedidoDaComissao,
} from "@/lib/comissao-consulta";
import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import { nomeArquivoRelatorio } from "@/lib/pdf/nome-arquivo";
import { sessaoComAcesso } from "@/lib/sessao";
import { sessaoExpiradaNoArquivo } from "@/lib/resposta-de-erro";

/**
 * As linhas por trás dos gráficos, para conferir no Excel.
 *
 * É UMA planilha de pedidos, e não uma por gráfico. Todo número da aba sai
 * destas linhas — a comissão por cliente é a soma por cliente, a por indústria
 * é a soma por indústria —, então quem exporta os pedidos consegue refazer
 * qualquer um dos cartões, inclusive os cruzamentos que a tela não mostra.
 * Sete CSVs pequenos dariam menos, não mais.
 */

/** Excel em português lê ponto e vírgula; com vírgula ele joga tudo numa coluna. */
const SEPARADOR = ";";

/**
 * O BOM não é enfeite: sem ele o Excel abre o arquivo em ANSI e "Comissão"
 * vira "ComissÃ£o". É o detalhe que faz a planilha chegar legível.
 */
const BOM = "﻿";

const CABECALHO = [
  "Pedido",
  "Parcela",
  "Competência",
  "Vencimento",
  "Prazo de entrega",
  "Entregue em",
  "Enviado em",
  "Cliente",
  "Indústria",
  "Preposto",
  "Base sem IPI",
  "% comissão",
  "Comissão prevista",
  "Base recebida",
  "% recebido",
  "Comissão recebida",
];

export async function GET(requisicao: Request) {
  // Rota de arquivo não passa por layout, então o guarda de sessão é aqui.
  // Responde 401 em vez de lançar: sem sessão não é erro do servidor, e um 500
  // poluiria o log de problemas de verdade.
  const sessao = await sessaoComAcesso();
  if (!sessao) return sessaoExpiradaNoArquivo();

  const url = new URL(requisicao.url);
  const parametro = url.searchParams.get("mes");
  const competencia =
    parametro && /^\d{4}-\d{2}$/.test(parametro) ? parametro : competenciaDe(new Date());

  const escopo = url.searchParams.get("escopo") === "janela" ? "janela" : "mes";
  const meses = [3, 6, 12].includes(Number(url.searchParams.get("meses")))
    ? Number(url.searchParams.get("meses"))
    : 6;

  const ehAdmin = sessao.papel === "ADMIN";
  const db = dbParaOrganizacao(sessao.organizacaoId, {
    usuarioId: sessao.usuarioId,
    papel: sessao.papel,
  });

  const [pedidos, organizacao] = await Promise.all([
    escopo === "janela"
      ? pedidosDoIntervalo(
          db,
          sessao.organizacaoId,
          deslocarCompetencia(competencia, -(meses - 1)),
          competencia,
          ehAdmin ? null : sessao.usuarioId,
        )
      : pedidosDaCompetencia(
          db,
          sessao.organizacaoId,
          competencia,
          ehAdmin ? null : sessao.usuarioId,
        ),
    dbAdministrativo().organizacao.findUnique({
      where: { id: sessao.organizacaoId },
      select: { nome: true },
    }),
  ]);

  const linhas = [
    CABECALHO.join(SEPARADOR),
    ...pedidos.map((pedido) => paraLinha(pedido, ehAdmin).join(SEPARADOR)),
  ];

  // O do mês leva mês e ano, como o PDF; o da janela leva só o ano — o do
  // mês final, que é o que a pessoa escolheu na tela.
  const nome = nomeArquivoRelatorio(
    organizacao?.nome ?? "RepPlast",
    escopo === "janela" ? competencia.slice(0, 4) : competencia,
    "csv",
  );

  // CRLF porque é o que o Excel espera; com LF puro algumas versões colam a
  // última coluna de uma linha na primeira da seguinte.
  return new Response(BOM + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function paraLinha(pedido: PedidoDaComissao, ehAdmin: boolean): string[] {
  const resumo = resumirComissao([pedido]);
  const acerto = acertoDoPedido(pedido);

  return [
    String(pedido.numero),
    // Uma linha por parcela: "1/3", e o mês e o vencimento são os DELA. A
    // planilha soma por competência e bate com a tela.
    pedido.parcela ? `${pedido.parcela.numero}/${pedido.parcela.total}` : "",
    pedido.competencia,
    data(pedido.parcela?.vencimento ?? null),
    data(pedido.prazoEntrega),
    data(pedido.entregueEm),
    data(pedido.enviadoEm),
    texto(pedido.cliente.apelido),
    texto(pedido.fornecedor.nome),
    texto(prepostoDoPedido(pedido)?.nome ?? ""),
    moeda(pedido.subtotalSemIpi.toString()),
    // O percentual da indústria é conta do escritório com a indústria: para o
    // preposto sai em branco, como já sai na tela de Comissões.
    ehAdmin ? numero(percentualDoPedido(pedido)) : "",
    moeda((ehAdmin ? resumo.valor : resumo.previstoDoPreposto).toString()),
    acerto ? moeda(acerto.base) : "",
    acerto && ehAdmin ? numero(acerto.percentual) : "",
    acerto ? moeda((ehAdmin ? resumo.recebido : resumo.recebidoDoPreposto).toString()) : "",
  ];
}

/** Decimal com vírgula, que é o que a planilha em português soma. */
function numero(valor: string): string {
  return valor.replace(".", ",");
}

/**
 * "R$ 1.234,56", que o Excel em português lê como moeda — continua número,
 * soma e ordena. O espaço depois do "R$" é comum de propósito: o do
 * `Intl.NumberFormat` é inseparável (U+00A0), e com ele o Excel trata a célula
 * como texto e para de somar.
 */
function moeda(valor: string): string {
  const arredondado = new Decimal(valor).toDecimalPlaces(2);
  const [inteira, centavos] = arredondado.abs().toFixed(2).split(".");
  const milhares = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sinal = arredondado.isNegative() && !arredondado.isZero() ? "-" : "";
  return `${sinal}R$ ${milhares},${centavos}`;
}

/** "AAAA-MM-DD": ordena certo como texto e o Excel reconhece como data. */
function data(valor: Date | null): string {
  return valor ? valor.toISOString().slice(0, 10) : "";
}

/**
 * Aspas e quebras escapadas, senão um nome de cliente com ponto e vírgula
 * empurra todas as colunas seguintes uma casa para a direita.
 */
function texto(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}
