import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

/**
 * Serve o logo da indústria.
 *
 * O arquivo mora no banco, então precisa de uma rota para virar `<img src>` —
 * e é a mesma fonte que o gerador de PDF vai ler.
 *
 * A busca passa pelo cliente com escopo de escritório: o logo de uma indústria
 * de outro tenant não é alcançável nem por URL adivinhada.
 */
export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const fornecedor = await db.fornecedor.findFirst({
    where: { id, organizacaoId },
    select: { logo: true, logoTipo: true, atualizadoEm: true },
  });

  if (!fornecedor?.logo || !fornecedor.logoTipo) {
    return new Response("Sem logo", { status: 404 });
  }

  return new Response(new Uint8Array(fornecedor.logo), {
    headers: {
      "Content-Type": fornecedor.logoTipo,
      // Privado: é dado de um escritório específico, não pode ficar em cache
      // compartilhado. O ETag evita rebaixar o arquivo a cada visita.
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: `"${fornecedor.atualizadoEm.getTime()}"`,
      // Defesa contra o navegador adivinhar um tipo diferente do declarado.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
