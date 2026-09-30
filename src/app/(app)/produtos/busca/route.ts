import { dbParaOrganizacao } from "@/lib/db";
import { sessaoAtual } from "@/lib/sessao";

import { buscarProdutos, filtrosDosParametros } from "../consulta";

/**
 * As fatias que a lista pede enquanto a pessoa digita e rola.
 *
 * Rota, e não server action, pelo mesmo motivo de `/pedidos/busca`: o navegador
 * aborta a busca anterior a cada tecla, e uma resposta antiga chegando depois
 * da nova faria a lista voltar no tempo.
 */
export async function GET(requisicao: Request) {
  // Rota de arquivo não passa pelo layout: o guarda de sessão é aqui.
  const sessao = await sessaoAtual();
  if (!sessao) return new Response("Não autenticado", { status: 401 });

  const db = dbParaOrganizacao(sessao.organizacaoId, {
    usuarioId: sessao.usuarioId,
    papel: sessao.papel,
  });

  const parametros = new URL(requisicao.url).searchParams;
  const pagina = Math.max(0, Number(parametros.get("pagina")) || 0);

  const fatia = await buscarProdutos(db, sessao.organizacaoId, {
    ...filtrosDosParametros((nome) => parametros.get(nome)),
    pagina,
  });

  return Response.json(fatia, {
    // Dado de um escritório específico: nunca em cache compartilhado.
    headers: { "Cache-Control": "private, no-store" },
  });
}
