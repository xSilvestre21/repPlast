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

import { dbAdministrativo } from "@/lib/db";
import { lerNumeroBr } from "@/lib/numero-br";
import { gerarHashSenha } from "@/lib/senha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";
import { escopoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string; aviso?: string };

async function contextoAdmin() {
  const escopo = await escopoAtual();

  if (!escopo.ehAdmin) throw new Error("Esta seção é do administrador do escritório.");
  if (escopo.plano !== "PLUS") throw new Error("Prepostos fazem parte do plano Plus.");

  return escopo;
}

function lerTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
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

export async function inscreverPreposto(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contextoAdmin();

    const nome = lerTexto(formData.get("nome"));
    const email = lerTexto(formData.get("email")).toLowerCase();
    const senha = lerTexto(formData.get("senha"));

    if (!nome) return { erro: "Informe o nome do preposto." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "E-mail inválido." };
    if (senha.length < TAMANHO_MINIMO_SENHA) {
      return { erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` };
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
    if (jaExiste) return { erro: "Já existe uma conta com este e-mail." };

    await db.usuario.create({
      data: {
        organizacaoId,
        nome,
        email,
        senhaHash: await gerarHashSenha(senha),
        papel: "REPRESENTANTE",
        comissaoPercentualPadrao,
      },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível inscrever." };
  }

  revalidatePath("/prepostos");
  return { aviso: "Preposto inscrito. Passe a senha a ele por um canal seguro." };
}

export async function atualizarPreposto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contextoAdmin();

    const nome = lerTexto(formData.get("nome"));
    if (!nome) return { erro: "Informe o nome do preposto." };

    const { count } = await db.usuario.updateMany({
      where: { id, organizacaoId, papel: "REPRESENTANTE" },
      data: {
        nome,
        comissaoPercentualPadrao: lerPercentual(formData.get("comissaoPercentualPadrao")),
      },
    });

    if (count === 0) return { erro: "Preposto não encontrado." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/prepostos");
  return {};
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

  revalidatePath("/prepostos");
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

  revalidatePath("/prepostos");
  return { aviso: "Senha trocada." };
}
