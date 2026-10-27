/**
 * Usar o sistema estica a sessão: `GuardaDaAba` chama o POST ao abrir o app e
 * ao voltar para ele. Ver os prazos em `lib/token-sessao.ts`.
 *
 * O DELETE é a mesma `GuardaDaAba` encerrando a sessão da guia que foi fechada
 * e reaberta (`lib/aba.ts`).
 *
 * Rota, e não o layout: Server Component não grava cookie.
 */

import { encerrarSessao, renovarSessao, sessaoAtual } from "@/lib/sessao";

export async function POST() {
  // `sessaoAtual` antes: usuário desativado ou senha trocada não renova nada.
  if (!(await sessaoAtual()) || !(await renovarSessao())) return new Response(null, { status: 401 });
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  await encerrarSessao();
  return new Response(null, { status: 204 });
}
