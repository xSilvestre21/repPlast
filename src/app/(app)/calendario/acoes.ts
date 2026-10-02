"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ADIAMENTO_MS, colunaDoDia } from "@/lib/agenda";
import { dataValida } from "@/lib/calendario";
import { escopoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

/**
 * O formulário do compromisso, validado.
 *
 * A hora é opcional ("o dia inteiro") e, quando vem, é "HH:MM" de verdade — o
 * banco tem o mesmo CHECK, mas a mensagem daqui é a que a pessoa entende.
 */
const Compromisso = z.object({
  titulo: z.string().trim().min(1, "Dê um título ao compromisso.").max(200, "Título longo demais."),
  data: z.string().refine(dataValida, "Data inválida."),
  hora: z
    .string()
    .trim()
    .refine((h) => h === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(h), "Hora inválida.")
    .transform((h) => (h === "" ? null : h)),
  importancia: z.enum(["NORMAL", "IMPORTANTE", "URGENTE"], "Escolha a importância."),
  clienteId: z
    .string()
    .trim()
    .transform((id) => (id === "" ? null : id)),
  anotacao: z
    .string()
    .trim()
    .max(2000, "Anotação longa demais.")
    .transform((t) => (t === "" ? null : t)),
  compartilhado: z.boolean(),
});

function lerFormulario(formData: FormData) {
  const texto = (campo: string) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : "";
  };

  return Compromisso.safeParse({
    titulo: texto("titulo"),
    data: texto("data"),
    hora: texto("hora"),
    importancia: texto("importancia") || "NORMAL",
    clienteId: texto("clienteId"),
    anotacao: texto("anotacao"),
    compartilhado: formData.get("compartilhado") === "on",
  });
}

/**
 * O cliente vinculado precisa ser um que quem marca ENXERGA.
 *
 * A chave estrangeira não passa pelo RLS: sem esta conferência, um preposto
 * poderia vincular o compromisso a um cliente da carteira do colega só
 * mandando o id.
 */
async function clienteVisivel(
  db: Awaited<ReturnType<typeof escopoAtual>>["db"],
  organizacaoId: string,
  clienteId: string | null,
) {
  if (clienteId === null) return true;
  return (await db.cliente.count({ where: { id: clienteId, organizacaoId } })) > 0;
}

function revalidar() {
  revalidatePath("/calendario");
  // O aviso e o cartão "Hoje" moram no Painel.
  revalidatePath("/");
}

export async function salvarCompromisso(
  compromissoId: string | null,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const lido = lerFormulario(formData);
    if (!lido.success) return { erro: lido.error.issues[0]?.message ?? "Confira os campos." };
    const dados = lido.data;

    const { organizacaoId, usuarioId, db } = await escopoAtual();
    if (!(await clienteVisivel(db, organizacaoId, dados.clienteId))) {
      return { erro: "Cliente não encontrado." };
    }

    const campos = {
      titulo: dados.titulo,
      data: colunaDoDia(dados.data),
      hora: dados.hora,
      importancia: dados.importancia,
      clienteId: dados.clienteId,
      anotacao: dados.anotacao,
      compartilhado: dados.compartilhado,
    };

    if (compromissoId === null) {
      await db.compromisso.create({ data: { ...campos, organizacaoId, autorId: usuarioId } });
    } else {
      // `updateMany` com o autor no filtro: alterar o do colega não acha
      // linha nenhuma — e a policy recusaria de todo jeito.
      const { count } = await db.compromisso.updateMany({
        where: { id: compromissoId, organizacaoId, autorId: usuarioId },
        data: campos,
      });
      if (count === 0) return { erro: "Só quem marcou pode alterar este compromisso." };
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidar();
  return {};
}

/** Marca como feito — ou desfaz, com `feito` falso. Some do aviso no Painel. */
export async function concluirCompromisso(
  compromissoId: string,
  feito: boolean,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, usuarioId, db } = await escopoAtual();
    const { count } = await db.compromisso.updateMany({
      where: { id: compromissoId, organizacaoId, autorId: usuarioId },
      data: { concluidoEm: feito ? new Date() : null },
    });
    if (count === 0) return { erro: "Só quem marcou pode concluir este compromisso." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível concluir." };
  }

  revalidar();
  return {};
}

export async function excluirCompromisso(
  compromissoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, usuarioId, db } = await escopoAtual();
    const { count } = await db.compromisso.deleteMany({
      where: { id: compromissoId, organizacaoId, autorId: usuarioId },
    });
    if (count === 0) return { erro: "Só quem marcou pode excluir este compromisso." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível excluir." };
  }

  revalidar();
  return {};
}

/**
 * "Lembrar depois": cala o aviso no Painel por `ADIAMENTO_MS`, só para quem
 * clicou. Funciona também no compromisso compartilhado do colega — adiar o
 * próprio aviso não mexe no compromisso dele.
 */
export async function adiarAviso(
  compromissoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { usuarioId, db } = await escopoAtual();
    const ate = new Date(Date.now() + ADIAMENTO_MS);

    await db.avisoAdiado.upsert({
      where: { usuarioId_compromissoId: { usuarioId, compromissoId } },
      create: { usuarioId, compromissoId, ate },
      update: { ate },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível adiar." };
  }

  revalidatePath("/");
  return {};
}
