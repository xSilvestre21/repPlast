/**
 * Usar o sistema estica a sessão: `GuardaDaAba` chama aqui ao abrir o app e
 * ao voltar para ele. Ver os prazos em `lib/token-sessao.ts`. A saída da guia
 * fechada é a rota vizinha, `sair/`.
 *
 * Rota, e não o layout: Server Component não grava cookie.
 */

import { renovarSessao, sessaoAtual } from "@/lib/sessao";

export async function POST() {
  // `sessaoAtual` antes: usuário desativado ou senha trocada não renova nada.
  if (!(await sessaoAtual()) || !(await renovarSessao())) return new Response(null, { status: 401 });
  return new Response(null, { status: 204 });
}
