import { dbParaOrganizacao } from "@/lib/db";
import { sessaoAtual } from "@/lib/sessao";

import { buscarOrcamentos, statusDoParametro } from "../consulta";

/**
 * As fatias que a lista pede enquanto a pessoa digita e rola.
 *
 * É rota, e não server action, por causa do cancelamento: o navegador aborta a
 * busca anterior a cada tecla, e uma resposta antiga que chegasse depois da nova
 * faria a lista voltar no tempo. Server action ainda seria POST em fila, onde
 * uma consulta lenta segura a seguinte.
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

  const fatia = await buscarOrcamentos(db, sessao.organizacaoId, {
    busca: parametros.get("busca") ?? "",
    status: statusDoParametro(parametros.get("status")),
    pagina,
  });

  return Response.json(fatia, {
    // Dado de um escritório específico: nunca em cache compartilhado.
    headers: { "Cache-Control": "private, no-store" },
  });
}
