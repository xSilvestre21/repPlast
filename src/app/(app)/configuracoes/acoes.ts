"use server";

/**
 * Preferências de conta do usuário logado.
 */

import { revalidatePath } from "next/cache";

import { escopoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

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

/**
 * O texto que entra preenchido em "Condições" num orçamento novo.
 *
 * É de cada usuário, não do escritório: cada representante negocia ICMS,
 * frete e prazo do jeito que costuma fechar, e o texto de um não é o do outro.
 */
export async function salvarObservacoesPadrao(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { usuarioId, organizacaoId, db } = await escopoAtual();

    const bruto = formData.get("observacoesPadrao");
    const texto = typeof bruto === "string" && bruto.trim() !== "" ? bruto.trim() : null;

    await db.usuario.updateMany({
      where: { id: usuarioId, organizacaoId },
      data: { observacoesPadrao: texto },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/configuracoes");
  return {};
}

/**
 * A cidade de onde este usuário escreve.
 *
 * De cada um, e não do escritório, pelo mesmo motivo das condições acima:
 * prepostos moram em cidades diferentes, e a carta é assinada por quem a
 * escreveu. Cada proposta congela a sua na criação — mudar aqui não reescreve
 * o cabeçalho de nenhuma proposta que já existe.
 */
export async function salvarCidade(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { usuarioId, organizacaoId, db } = await escopoAtual();

    const bruto = formData.get("municipio");
    const texto = typeof bruto === "string" && bruto.trim() !== "" ? bruto.trim() : null;

    await db.usuario.updateMany({
      where: { id: usuarioId, organizacaoId },
      data: { municipio: texto },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/configuracoes");
  return {};
}
