"use server";

/**
 * Cadastro de prepostos — a seção que o plano Plus destrava.
 *
 * Toda ação daqui passa por `contextoAdmin()`, e isso é porteiro de aplicação,
 * não a garantia. A garantia é o banco: o RLS recusa usuário de outro
 * escritório, e um trigger recusa preposto em escritório que não seja Plus (ver
 * migrations `planos_papeis_e_representante` e `prepostos_e_permissao_de_industria`).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dbAdministrativo, type DbOrganizacao } from "@/lib/db";
import { normalizarTelefone } from "@/lib/mascara";
import { lerNumeroBr } from "@/lib/numero-br";
import { gerarHashSenha } from "@/lib/senha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";
import { escopoAtual } from "@/lib/sessao";

export type EstadoFormulario = {
  erro?: string;
  aviso?: string;
  /**
   * O que a pessoa digitou, devolvido quando o envio é recusado. O React limpa
   * o formulário a cada envio; sem isto, um e-mail repetido apagava o cadastro
   * inteiro junto. A senha não volta — nunca se devolve senha ao navegador.
   */
  valores?: {
    nome: string;
    sobrenome: string;
    email: string;
    telefone: string;
    comissaoPercentual: string;
    fornecedorIds: string[];
  };
};

function digitado(formData: FormData): NonNullable<EstadoFormulario["valores"]> {
  return {
    nome: lerTexto(formData.get("nome")),
    sobrenome: lerTexto(formData.get("sobrenome")),
    email: lerTexto(formData.get("email")),
    telefone: lerTexto(formData.get("telefone")),
    comissaoPercentual: lerTexto(formData.get("comissaoPercentualPadrao")),
    fornecedorIds: formData.getAll("fornecedorId").map(String),
  };
}

/** A lista e a ficha do preposto — as duas mostram o que acabou de mudar. */
function revalidarPreposto(id: string) {
  revalidatePath("/prepostos");
  revalidatePath(`/prepostos/${id}`);
}

async function contextoAdmin() {
  const escopo = await escopoAtual();

  if (!escopo.ehAdmin) throw new Error("Esta seção é do administrador do escritório.");
  if (escopo.plano !== "PLUS") throw new Error("Prepostos fazem parte do plano Plus.");

  return escopo;
}

function lerTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Opcional: vazio vira `null`, e não string vazia no banco. */
function lerOpcional(valor: FormDataEntryValue | null): string | null {
  return lerTexto(valor) || null;
}

/**
 * Telefone normalizado aqui, e não só pela máscara do campo: o formulário
 * continua enviando por POST comum quando o JavaScript não roda.
 */
function lerTelefone(valor: FormDataEntryValue | null): string | null {
  return normalizarTelefone(lerTexto(valor));
}

/** Fatia da comissão, em percentual DELA. Vazio vale zero — preposto sem acordo ainda. */
function lerPercentual(valor: FormDataEntryValue | null): string | null {
  const texto = lerTexto(valor);
  if (texto === "") return null;

  const numero = lerNumeroBr(texto);
  if (numero === null) throw new Error("Não entendi o percentual.");
  if (numero < 0 || numero > 100) throw new Error("O percentual precisa ficar entre 0 e 100.");

  return String(numero);
}

/**
 * Regrava as indústrias que o preposto vê: exatamente as marcadas.
 *
 * O id que não é de uma indústria deste escritório é descartado em silêncio —
 * só chega assim um formulário adulterado, e o RLS recusaria a gravação de
 * todo jeito.
 */
async function gravarIndustrias(
  db: DbOrganizacao,
  organizacaoId: string,
  usuarioId: string,
  formData: FormData,
) {
  const marcadas = formData.getAll("fornecedorId").map(String);
  const validas =
    marcadas.length === 0
      ? []
      : await db.fornecedor.findMany({
          where: { organizacaoId, id: { in: marcadas } },
          select: { id: true },
        });

  await db.fornecedorPreposto.deleteMany({ where: { usuarioId } });

  if (validas.length > 0) {
    await db.fornecedorPreposto.createMany({
      data: validas.map((f) => ({ fornecedorId: f.id, usuarioId })),
    });
  }
}

export async function inscreverPreposto(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, db } = await contextoAdmin();

    const nome = lerTexto(formData.get("nome"));
    const email = lerTexto(formData.get("email")).toLowerCase();
    const senha = lerTexto(formData.get("senha"));

    if (!nome) return { erro: "Informe o nome do preposto.", valores: digitado(formData) };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "E-mail inválido.", valores: digitado(formData) };
    if (senha.length < TAMANHO_MINIMO_SENHA) {
      return { erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`, valores: digitado(formData) };
    }

    const comissaoPercentualPadrao = lerPercentual(formData.get("comissaoPercentualPadrao"));

    /*
     * O e-mail é único no sistema inteiro, não por escritório — é a chave do
     * login. Conferir antes rende mensagem legível em vez do erro cru do banco,
     * mas quem garante continua sendo o índice único.
     */
    const jaExiste = await dbAdministrativo().usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (jaExiste) return { erro: "Já existe uma conta com este e-mail.", valores: digitado(formData) };

    const preposto = await db.usuario.create({
      data: {
        organizacaoId,
        nome,
        sobrenome: lerOpcional(formData.get("sobrenome")),
        email,
        telefone: lerTelefone(formData.get("telefone")),
        senhaHash: await gerarHashSenha(senha),
        papel: "REPRESENTANTE",
        comissaoPercentualPadrao,
      },
      select: { id: true },
    });

    await gravarIndustrias(db, organizacaoId, preposto.id, formData);

    destino = `/prepostos/${preposto.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível inscrever.", valores: digitado(formData) };
  }

  // Como o cadastro de cliente: gravou, abre a ficha do que acabou de nascer.
  revalidatePath("/prepostos");
  redirect(destino);
}

export async function atualizarPreposto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contextoAdmin();

    const nome = lerTexto(formData.get("nome"));
    if (!nome) return { erro: "Informe o nome do preposto.", valores: digitado(formData) };

    const { count } = await db.usuario.updateMany({
      where: { id, organizacaoId, papel: "REPRESENTANTE" },
      data: {
        nome,
        sobrenome: lerOpcional(formData.get("sobrenome")),
        telefone: lerTelefone(formData.get("telefone")),
        comissaoPercentualPadrao: lerPercentual(formData.get("comissaoPercentualPadrao")),
      },
    });

    if (count === 0) return { erro: "Preposto não encontrado.", valores: digitado(formData) };

    await gravarIndustrias(db, organizacaoId, id, formData);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar.", valores: digitado(formData) };
  }

  revalidarPreposto(id);
  // "Salvar e voltar": gravou, a ficha volta a ser leitura.
  redirect(`/prepostos/${id}`);
}

/**
 * Liga e desliga o acesso.
 *
 * Desativar, e não apagar: o preposto aparece em pedido, cliente e comissão de
 * meses fechados, e apagá-lo devolveria essa carteira ao escritório calada.
 * `sessaoAtual()` relê `ativo` a cada requisição, então o corte é imediato —
 * não espera o cookie dele vencer.
 */
export async function alternarAtivoPreposto(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contextoAdmin();

  const preposto = await db.usuario.findFirst({
    where: { id, organizacaoId, papel: "REPRESENTANTE" },
    select: { ativo: true },
  });

  if (!preposto) throw new Error("Preposto não encontrado.");

  await db.usuario.updateMany({
    where: { id, organizacaoId, papel: "REPRESENTANTE" },
    data: { ativo: !preposto.ativo },
  });

  revalidarPreposto(id);
}

export async function redefinirSenhaPreposto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contextoAdmin();

    const senha = lerTexto(formData.get("senha"));
    if (senha.length < TAMANHO_MINIMO_SENHA) {
      return { erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` };
    }

    const { count } = await db.usuario.updateMany({
      where: { id, organizacaoId, papel: "REPRESENTANTE" },
      data: { senhaHash: await gerarHashSenha(senha) },
    });

    if (count === 0) return { erro: "Preposto não encontrado." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível trocar a senha." };
  }

  revalidarPreposto(id);
  return { aviso: "Senha trocada." };
}

/**
 * Regrava os clientes que o preposto atende: exatamente os marcados.
 *
 * Mexe só nos vínculos DESTE preposto — um cliente pode ser de vários, e
 * marcar aqui não tira o cliente de ninguém. O id que não é de cliente deste
 * escritório é descartado; o RLS recusaria o vínculo de todo jeito.
 */
export async function definirClientesDoPreposto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contextoAdmin();

    const preposto = await db.usuario.count({
      where: { id, organizacaoId, papel: "REPRESENTANTE" },
    });
    if (preposto === 0) return { erro: "Preposto não encontrado." };

    const marcados = formData.getAll("clienteId").map(String);
    const validos =
      marcados.length === 0
        ? []
        : await db.cliente.findMany({
            where: { organizacaoId, id: { in: marcados } },
            select: { id: true },
          });

    await db.clientePreposto.deleteMany({ where: { usuarioId: id } });

    if (validos.length > 0) {
      await db.clientePreposto.createMany({
        data: validos.map((c) => ({ clienteId: c.id, usuarioId: id })),
      });
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidarPreposto(id);
  revalidatePath("/clientes");
  redirect(`/prepostos/${id}`);
}
