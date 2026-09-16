"use server";

/**
 * Preferências de conta do usuário logado — hoje só a de animação.
 */

import { revalidatePath } from "next/cache";

import { escopoAtual } from "@/lib/sessao";

/**
 * Liga e desliga a animação da conta.
 *
 * Não recebe `FormData`: é um único booleano, alternado a partir do valor já
 * salvo. Reafirma `id`/`organizacaoId` no `where` mesmo a RLS já limitando à
 * própria linha — defesa em profundidade, mesmo padrão de `alternarAtivoPreposto`
 * em `prepostos/acoes.ts`.
 */
export async function alternarReduzirAnimacoes(): Promise<void> {
  const { usuarioId, organizacaoId, db } = await escopoAtual();

  const usuario = await db.usuario.findFirst({
    where: { id: usuarioId, organizacaoId },
    select: { reduzirAnimacoes: true },
  });

  if (!usuario) throw new Error("Usuário não encontrado.");

  await db.usuario.updateMany({
    where: { id: usuarioId, organizacaoId },
    data: { reduzirAnimacoes: !usuario.reduzirAnimacoes },
  });

  revalidatePath("/configuracoes");
}
