/**
 * Escritório (tenant) da requisição atual.
 *
 * ⚠️ PROVISÓRIO — ainda não há autenticação. Até a tela de login existir, o
 * sistema assume a única organização do banco. Quando a autenticação entrar,
 * só esta função muda: todo o resto do código já pergunta o tenant por aqui.
 */

import { cache } from "react";

import { dbAdministrativo } from "./db";

/**
 * `cache` do React garante uma única resolução por requisição, mesmo que várias
 * partes da página perguntem qual é o escritório.
 */
export const organizacaoAtual = cache(async (): Promise<string> => {
  const fixa = process.env.ORGANIZACAO_ID?.trim();
  if (fixa) return fixa;

  const organizacao = await dbAdministrativo().organizacao.findFirst({
    orderBy: { criadaEm: "asc" },
    select: { id: true },
  });

  if (!organizacao) {
    throw new Error(
      "Nenhuma organização cadastrada. Rode `npm run db:seed` para criar a inicial.",
    );
  }

  return organizacao.id;
});
