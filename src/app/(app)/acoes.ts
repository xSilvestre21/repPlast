"use server";

/**
 * Ações do Painel.
 */

import { revalidatePath } from "next/cache";

import { escopoAtual } from "@/lib/sessao";

/**
 * O "olho" do Painel: mostra ou mascara os valores em reais.
 *
 * Mesmo formato de `alternarReduzirAnimacoes` em `configuracoes/acoes.ts` — um
 * único booleano, alternado a partir do valor já salvo, com `id`/`organizacaoId`
 * reafirmados no `where` por defesa em profundidade.
 */
export async function alternarOcultarValores(): Promise<void> {
  const { usuarioId, organizacaoId, db } = await escopoAtual();

  const usuario = await db.usuario.findFirst({
    where: { id: usuarioId, organizacaoId },
    select: { ocultarValores: true },
  });

  if (!usuario) throw new Error("Usuário não encontrado.");

  await db.usuario.updateMany({
    where: { id: usuarioId, organizacaoId },
    data: { ocultarValores: !usuario.ocultarValores },
  });

  revalidatePath("/");
}
