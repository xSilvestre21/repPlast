import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import { relatorioEmHtml } from "@/lib/grafico/documento-html";
import { relatorioDosGraficos } from "@/lib/pdf/gerar-graficos";
import { nomeArquivoRelatorio } from "@/lib/pdf/nome-arquivo";
import { sessaoComAcesso } from "@/lib/sessao";

import { carregarDadosDosGraficos } from "../../dados";
import { parametrosDoRelatorio } from "../parametros";
import { sessaoExpiradaNoArquivo } from "@/lib/resposta-de-erro";

/**
 * O relatório como um arquivo HTML que abre sozinho.
 *
 * Vai como `attachment`, e não `inline`: aberto na aba ele seria só uma versão
 * pior da tela que a pessoa já está olhando. O que ele resolve é mandar o mês
 * para quem NÃO tem login — o contador, a indústria, o preposto que ainda não
 * foi cadastrado.
 */
export async function GET(requisicao: Request) {
  // Rota de arquivo não passa por layout, então o guarda de sessão é aqui.
  // Responde 401 em vez de lançar: sem sessão não é erro do servidor.
  const sessao = await sessaoComAcesso();
  if (!sessao) return sessaoExpiradaNoArquivo();

  const url = new URL(requisicao.url);
  const { competencia, meses, dias } = parametrosDoRelatorio(url);

  const db = dbParaOrganizacao(sessao.organizacaoId, {
    usuarioId: sessao.usuarioId,
    papel: sessao.papel,
  });

  const [dados, organizacao] = await Promise.all([
    carregarDadosDosGraficos(db, sessao.organizacaoId, {
      ehAdmin: sessao.papel === "ADMIN",
      usuarioId: sessao.usuarioId,
      plano: sessao.plano,
      competencia,
      meses,
      dias,
      agora: Date.now(),
    }),
    dbAdministrativo().organizacao.findUnique({
      where: { id: sessao.organizacaoId },
      select: { nome: true },
    }),
  ]);

  const escritorio = organizacao?.nome ?? "RepPlast";
  const arquivo = relatorioEmHtml(relatorioDosGraficos(dados, escritorio), new Date());

  return new Response(arquivo, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivoRelatorio(escritorio, competencia, "html")}"`,
      "Cache-Control": "private, no-store",
      // O arquivo carrega dado de um escritório; o navegador não deve tentar
      // adivinhar outro tipo para ele.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
