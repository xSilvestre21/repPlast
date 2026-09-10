import { carregarPedidoParaPdf, gerarPdfPedido } from "@/lib/pdf/gerar-pedido";
import { organizacaoAtual } from "@/lib/sessao";

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

  const organizacaoId = await organizacaoAtual();
  const pedido = await carregarPedidoParaPdf(id, organizacaoId);

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
