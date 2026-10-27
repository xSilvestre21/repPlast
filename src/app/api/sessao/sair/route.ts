/**
 * A guia fechada e reaberta sai por aqui (`lib/aba.ts`): encerra a sessão e já
 * manda para a tela de entrar, numa ida só ao servidor. Encerrar e depois
 * pedir `/entrar` eram duas — e cada uma pesa no 4G, justo ao abrir o app.
 *
 * POST, por formulário: um link de outro site não desloga ninguém.
 */

import { encerrarSessao } from "@/lib/sessao";

export async function POST(requisicao: Request) {
  await encerrarSessao();
  // 303: o navegador segue com GET, como depois de qualquer formulário.
  return Response.redirect(new URL("/entrar?sessao=encerrada", requisicao.url), 303);
}
