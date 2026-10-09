"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ADIAMENTO_MS, colunaDoDia } from "@/lib/agenda";
import { dataValida } from "@/lib/calendario";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { escopoAtual } from "@/lib/sessao";

export type { EstadoFormulario };

const SO_QUEM_MARCOU =
  "Só quem marcou este compromisso pode mudá-lo — ele foi compartilhado com você para leitura. " +
  "Se precisar de uma mudança, avise quem marcou.";

/**
 * O formulário do compromisso, validado.
 *
 * A hora é opcional ("o dia inteiro") e, quando vem, é "HH:MM" de verdade — o
 * banco tem o mesmo CHECK, mas a mensagem daqui é a que a pessoa entende.
 */
const Compromisso = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Dê um título ao compromisso — por exemplo, “Ligar para a FLEXOPET”.")
    .max(200, "O título pode ter até 200 letras. Passe os detalhes para a anotação."),
  data: z.string().refine(dataValida, "Escolha o dia do compromisso no calendário."),
  hora: z
    .string()
    .trim()
    .refine(
      (h) => h === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(h),
      "Esta hora não é válida. Digite como 14:30 — ou deixe em branco para o dia inteiro.",
    )
    .transform((h) => (h === "" ? null : h)),
  importancia: z.enum(
    ["NORMAL", "IMPORTANTE", "URGENTE"],
    "Escolha a importância: normal, importante ou urgente.",
  ),
  clienteId: z
    .string()
    .trim()
    .transform((id) => (id === "" ? null : id)),
  anotacao: z
    .string()
    .trim()
    .max(2000, "A anotação pode ter até 2.000 letras. Resuma o que for possível.")
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
    if (!lido.success) {
      // O Zod sabe de qual campo é o problema; antes isso era jogado fora.
      const [problema] = lido.error.issues;
      const campo = problema?.path[0];
      throw typeof campo === "string"
        ? new ErroDeCampo(campo, problema.message)
        : new ErroParaUsuario("Confira os campos do compromisso e tente de novo.");
    }
    const dados = lido.data;

    const { organizacaoId, usuarioId, db } = await escopoAtual();
    if (!(await clienteVisivel(db, organizacaoId, dados.clienteId))) {
      throw new ErroDeCampo(
        "clienteId",
        "Este cliente não foi encontrado, ou não é da sua carteira. Escolha outro na lista.",
      );
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
      if (count === 0) throw new ErroParaUsuario(SO_QUEM_MARCOU);
    }
  } catch (erro) {
    return falhou(erro, formData);
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
    if (count === 0) throw new ErroParaUsuario(SO_QUEM_MARCOU);
  } catch (erro) {
    return falhou(erro);
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
    if (count === 0) throw new ErroParaUsuario(SO_QUEM_MARCOU);
  } catch (erro) {
    return falhou(erro);
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
    return falhou(erro);
  }

  revalidatePath("/");
  return {};
}
