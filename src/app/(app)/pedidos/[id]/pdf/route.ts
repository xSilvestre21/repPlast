import { carregarPedidoParaPdf, gerarPdfPedido } from "@/lib/pdf/gerar-pedido";
import { sessaoAtual } from "@/lib/sessao";

/**
 * Gera o PDF do pedido sob demanda.
 *
 * Não guardamos o arquivo: ele é sempre montado a partir do que está no banco.
 * Como o item congela descrição, códigos e preço ao ser criado, reimprimir um
 * pedido antigo devolve exatamente o papel que a indústria recebeu na época,
 * mesmo que o cadastro tenha mudado depois.
 */
export async function GET(
  requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Rota de arquivo não passa por layout, então o guarda de sessão é aqui.
  // Responde 401 em vez de deixar `organizacaoAtual()` lançar: sem sessão não
  // é erro do servidor, e um 500 poluiria o log de problemas de verdade.
  const sessao = await sessaoAtual();
  if (!sessao) return new Response("Não autenticado", { status: 401 });

  const pedido = await carregarPedidoParaPdf(id, sessao.organizacaoId);

  if (!pedido) return new Response("Pedido não encontrado", { status: 404 });

  const arquivo = await gerarPdfPedido(pedido.dados);

  // `?abrir` mostra no navegador; sem ele, baixa. A visualização é o que o
  // usuário quer antes de enviar para a indústria.
  const abrirNoNavegador = new URL(requisicao.url).searchParams.has("abrir");

  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${abrirNoNavegador ? "inline" : "attachment"}; filename="${pedido.nomeArquivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
