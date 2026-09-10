"use server";

import { redirect } from "next/navigation";

import { dbAdministrativo } from "@/lib/db";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";
import { criarSessao, encerrarSessao } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

function lerTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Guardamos em minúsculas para que o login não dependa de como foi digitado. */
function lerEmail(valor: FormDataEntryValue | null): string {
  return lerTexto(valor).toLowerCase();
}

export async function entrar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const email = lerEmail(formData.get("email"));
    const senha = lerTexto(formData.get("senha"));

    if (!email || !senha) return { erro: "Informe e-mail e senha." };

    const usuario = await dbAdministrativo().usuario.findUnique({
      where: { email },
      select: { id: true, senhaHash: true, organizacao: { select: { ativa: true } } },
    });

    /*
     * A mesma mensagem para e-mail inexistente e senha errada, de propósito:
     * distinguir os dois casos entregaria a quem tenta invadir a informação de
     * quais e-mails têm conta no sistema.
     */
    const generico = { erro: "E-mail ou senha incorretos." };

    if (!usuario) {
      // Confere contra um hash descartável mesmo sem usuário: sem isso, a
      // resposta voltaria bem mais rápido e denunciaria que o e-mail não existe.
      await conferirSenha(senha, await gerarHashSenha("descartavel"));
      return generico;
    }

    if (!(await conferirSenha(senha, usuario.senhaHash))) return generico;
    if (!usuario.organizacao.ativa) return { erro: "Este escritório está desativado." };

    await criarSessao(usuario.id);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível entrar." };
  }

  redirect("/");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/entrar");
}

/**
 * Cria um escritório novo com o seu primeiro usuário.
 *
 * É o onboarding do SaaS: cada cadastro nasce como um tenant isolado, e a
 * partir daí nada mais atravessa a fronteira entre escritórios.
 */
export async function cadastrar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const escritorio = lerTexto(formData.get("escritorio"));
    const nome = lerTexto(formData.get("nome"));
    const email = lerEmail(formData.get("email"));
    const senha = lerTexto(formData.get("senha"));

    if (!escritorio) return { erro: "Informe o nome do seu escritório." };
    if (!nome) return { erro: "Informe o seu nome." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "E-mail inválido." };

    if (senha.length < TAMANHO_MINIMO_SENHA) {
      return { erro: `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.` };
    }
    if (senha !== lerTexto(formData.get("confirmacao"))) {
      return { erro: "As senhas não conferem." };
    }

    const db = dbAdministrativo();

    if (await db.usuario.findUnique({ where: { email }, select: { id: true } })) {
      return { erro: "Já existe uma conta com este e-mail." };
    }

    const organizacao = await db.organizacao.create({ data: { nome: escritorio } });

    const usuario = await db.usuario.create({
      data: {
        organizacaoId: organizacao.id,
        nome,
        email,
        senhaHash: await gerarHashSenha(senha),
      },
      select: { id: true },
    });

    await criarSessao(usuario.id);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível criar a conta." };
  }

  redirect("/");
}
