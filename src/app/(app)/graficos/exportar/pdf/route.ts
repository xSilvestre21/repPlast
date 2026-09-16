import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import {
  gerarPdfDosGraficos,
  nomeArquivoGraficos,
  relatorioDosGraficos,
} from "@/lib/pdf/gerar-graficos";
import { sessaoAtual } from "@/lib/sessao";

import { carregarDadosDosGraficos } from "../../dados";
import { parametrosDoRelatorio } from "../parametros";

/**
 * O relatório dos gráficos em PDF, gerado sob demanda.
 *
 * Não guardamos o arquivo: ele é sempre montado a partir do que está no banco,
 * como o PDF do pedido. Um relatório salvo seria um número congelado que
 * ninguém sabe de quando é.
 */
export async function GET(requisicao: Request) {
  // Rota de arquivo não passa por layout, então o guarda de sessão é aqui.
  // Responde 401 em vez de lançar: sem sessão não é erro do servidor, e um 500
  // poluiria o log de problemas de verdade.
  const sessao = await sessaoAtual();
  if (!sessao) return new Response("Não autenticado", { status: 401 });

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

  const arquivo = await gerarPdfDosGraficos(
    relatorioDosGraficos(dados, organizacao?.nome ?? "RepPlast"),
  );

  // `?abrir` mostra no navegador; sem ele, baixa. Mesmo contrato do PDF do
  // pedido, para o botão se comportar do jeito que a pessoa já conhece.
  const abrirNoNavegador = url.searchParams.has("abrir");

  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${abrirNoNavegador ? "inline" : "attachment"}; filename="${nomeArquivoGraficos(competencia, "pdf")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
