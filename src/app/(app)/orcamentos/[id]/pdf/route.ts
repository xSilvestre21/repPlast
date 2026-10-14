import { carregarOrcamentoParaPdf, gerarPdfOrcamento } from "@/lib/pdf/gerar-orcamento";
import { sessaoComAcesso } from "@/lib/sessao";
import { respostaDeErro, sessaoExpiradaNoArquivo } from "@/lib/resposta-de-erro";

/**
 * Gera o PDF da proposta sob demanda.
 *
 * Como no pedido, o arquivo não é guardado: é sempre montado do que está no
 * banco. Os itens congelam descrição, código e preço ao serem criados, então
 * reimprimir uma proposta antiga devolve exatamente o papel que o cliente
 * recebeu — mesmo que o cadastro tenha mudado desde então.
 */
export async function GET(
  requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Rota de arquivo não passa por layout: o guarda de sessão é aqui, e o ator
  // viaja junto para que um preposto não baixe a proposta de outro pela URL.
  const sessao = await sessaoComAcesso();
  if (!sessao) return sessaoExpiradaNoArquivo();

  const orcamento = await carregarOrcamentoParaPdf(id, sessao.organizacaoId, {
    usuarioId: sessao.usuarioId,
    papel: sessao.papel,
  });

  if (!orcamento) {
    return respostaDeErro(
      404,
      "Proposta não encontrada",
      "Esta proposta pode ter sido excluída, ou o link está incompleto. Volte à lista de orçamentos e abra o PDF por lá.",
    );
  }

  const arquivo = await gerarPdfOrcamento(orcamento.dados);
  const abrirNoNavegador = new URL(requisicao.url).searchParams.has("abrir");

  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${abrirNoNavegador ? "inline" : "attachment"}; filename="${orcamento.nomeArquivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
