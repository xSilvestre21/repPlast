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
import { gerarPlanilha, type ColunaPlanilha, type ValorCelula } from "@/lib/planilha";
import { sessaoComAcesso } from "@/lib/sessao";
import { sessaoExpiradaNoArquivo } from "@/lib/resposta-de-erro";

/**
 * As linhas por trás dos gráficos, para conferir no Excel (.xlsx).
 *
 * É UMA planilha de pedidos, e não uma por gráfico. Todo número da aba sai
 * destas linhas — a comissão por cliente é a soma por cliente, a por indústria
 * é a soma por indústria —, então quem exporta os pedidos consegue refazer
 * qualquer um dos cartões, inclusive os cruzamentos que a tela não mostra.
 * Sete planilhas pequenas dariam menos, não mais.
 *
 * Era CSV, e saiu por causa da largura: o CSV não guarda a largura das
 * colunas, e o Excel abria tudo estreito — "########" no lugar dos valores,
 * até a pessoa alargar coluna por coluna. O .xlsx (`lib/planilha.ts`) já abre
 * com cada coluna do tamanho do maior valor dela.
 */

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Pedido", tipo: "inteiro" },
  { titulo: "Parcela", tipo: "texto" },
  { titulo: "Competência", tipo: "texto" },
  { titulo: "Vencimento", tipo: "data" },
  { titulo: "Prazo de entrega", tipo: "data" },
  { titulo: "Entregue em", tipo: "data" },
  { titulo: "Enviado em", tipo: "data" },
  { titulo: "Cliente", tipo: "texto" },
  { titulo: "Indústria", tipo: "texto" },
  { titulo: "Preposto", tipo: "texto" },
  { titulo: "Base sem IPI", tipo: "moeda" },
  { titulo: "% comissão", tipo: "percentual" },
  { titulo: "Comissão prevista", tipo: "moeda" },
  { titulo: "Base recebida", tipo: "moeda" },
  { titulo: "% recebido", tipo: "percentual" },
  { titulo: "Comissão recebida", tipo: "moeda" },
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

  const planilha = gerarPlanilha(
    "Pedidos",
    COLUNAS,
    pedidos.map((pedido) => paraLinha(pedido, ehAdmin)),
  );

  // O do mês leva mês e ano, como o PDF; o da janela leva só o ano — o do
  // mês final, que é o que a pessoa escolheu na tela.
  const nome = nomeArquivoRelatorio(
    organizacao?.nome ?? "RepPlast",
    escopo === "janela" ? competencia.slice(0, 4) : competencia,
    "xlsx",
  );

  return new Response(new Uint8Array(planilha), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function paraLinha(pedido: PedidoDaComissao, ehAdmin: boolean): ValorCelula[] {
  const resumo = resumirComissao([pedido]);
  const acerto = acertoDoPedido(pedido);

  return [
    String(pedido.numero),
    // Uma linha por parcela: "1/3", e o mês e o vencimento são os DELA. A
    // planilha soma por competência e bate com a tela.
    pedido.parcela ? `${pedido.parcela.numero}/${pedido.parcela.total}` : null,
    pedido.competencia,
    data(pedido.parcela?.vencimento ?? null),
    data(pedido.prazoEntrega),
    data(pedido.entregueEm),
    data(pedido.enviadoEm),
    pedido.cliente.apelido,
    pedido.fornecedor.nome,
    prepostoDoPedido(pedido)?.nome ?? null,
    pedido.subtotalSemIpi.toString(),
    // O percentual da indústria é conta do escritório com a indústria: para o
    // preposto sai em branco, como já sai na tela de Comissões.
    ehAdmin ? percentualDoPedido(pedido) : null,
    (ehAdmin ? resumo.valor : resumo.previstoDoPreposto).toString(),
    acerto ? acerto.base : null,
    acerto && ehAdmin ? acerto.percentual : null,
    acerto ? (ehAdmin ? resumo.recebido : resumo.recebidoDoPreposto).toString() : null,
  ];
}

/**
 * Só o dia, em UTC — o mesmo dia que o CSV imprimia com `toISOString()`. O
 * `enviadoEm` tem hora, e sem cortar ela a célula levaria o horário junto.
 */
function data(valor: Date | null): Date | null {
  return valor ? new Date(valor.toISOString().slice(0, 10) + "T00:00:00Z") : null;
}
