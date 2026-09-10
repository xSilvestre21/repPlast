"use server";

import { revalidatePath } from "next/cache";

import { dbAdministrativo } from "@/lib/db";
import { lerNumeroBr } from "@/lib/numero-br";
import { organizacaoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

/**
 * Define a meta pessoal de comissão do mês.
 *
 * Vive na organização, e não no fornecedor: é o objetivo do representante,
 * somando todas as indústrias. Não entra em cálculo nenhum — serve para ele
 * acompanhar o próprio alvo e comemorar ao bater.
 *
 * Usa o cliente administrativo porque a organização é a própria linha de
 * tenant: o RLS a protege por `id`, e alterá-la é a única escrita que precisa
 * enxergá-la de fora do escopo comum.
 */
export async function definirMeta(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const organizacaoId = await organizacaoAtual();
    const bruto = formData.get("meta");
    const texto = typeof bruto === "string" ? bruto.trim() : "";

    // Campo vazio significa "não quero meta" — é uma opção legítima, e não erro.
    if (texto === "") {
      await dbAdministrativo().organizacao.update({
        where: { id: organizacaoId },
        data: { metaComissaoMensal: null },
      });

      revalidatePath("/comissoes");
      return {};
    }

    const valor = lerNumeroBr(texto);

    if (valor === null) return { erro: "Não entendi esse valor." };
    if (valor < 0) return { erro: "A meta não pode ser negativa." };

    await dbAdministrativo().organizacao.update({
      where: { id: organizacaoId },
      data: { metaComissaoMensal: valor === 0 ? null : String(valor) },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar a meta." };
  }

  revalidatePath("/comissoes");
  return {};
}
