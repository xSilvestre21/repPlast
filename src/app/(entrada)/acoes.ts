"use server";

import { redirect } from "next/navigation";

import { dbAdministrativo } from "@/lib/db";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";
import { criarSessao, encerrarSessao } from "@/lib/sessao";

export type { EstadoFormulario };

const EMAIL_INCOMPLETO =
  "Este e-mail parece incompleto. Confira se tem o @ e o final, como voce@escritorio.com.br.";

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

    if (!email) throw new ErroDeCampo("email", "Informe o e-mail com que você se cadastrou.");
    if (!senha) throw new ErroDeCampo("senha", "Informe a sua senha.");

    const usuario = await dbAdministrativo().usuario.findUnique({
      where: { email },
      select: { id: true, senhaHash: true, organizacao: { select: { ativa: true } } },
    });

    /*
     * A mesma mensagem para e-mail inexistente e senha errada, de propósito:
     * distinguir os dois casos entregaria a quem tenta invadir a informação de
     * quais e-mails têm conta no sistema.
     */
    const generico = falhou(
      new ErroParaUsuario(
        "E-mail ou senha incorretos. Confira se o e-mail está certo e se o Caps Lock não está " +
          "ligado, e tente de novo.",
      ),
      formData,
    );

    if (!usuario) {
      // Confere contra um hash descartável mesmo sem usuário: sem isso, a
      // resposta voltaria bem mais rápido e denunciaria que o e-mail não existe.
      await conferirSenha(senha, await gerarHashSenha("descartavel"));
      return generico;
    }

    if (!(await conferirSenha(senha, usuario.senhaHash))) return generico;
    if (!usuario.organizacao.ativa) {
      throw new ErroParaUsuario(
        "Este escritório está desativado, e por isso não dá para entrar. Se acha que é engano, " +
          "fale com o suporte.",
      );
    }

    await criarSessao(usuario.id);
  } catch (erro) {
    return falhou(erro, formData);
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

    if (!escritorio) {
      throw new ErroDeCampo(
        "escritorio",
        "Informe o nome do seu escritório — é como a sua representação é conhecida.",
      );
    }
    if (!nome) throw new ErroDeCampo("nome", "Informe o seu nome e sobrenome.");
    if (!email) throw new ErroDeCampo("email", "Informe o seu e-mail — é com ele que você vai entrar.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDeCampo("email", EMAIL_INCOMPLETO);

    if (senha.length < TAMANHO_MINIMO_SENHA) {
      throw new ErroDeCampo(
        "senha",
        `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres. ` +
          "Misture letras e números para ficar mais difícil de adivinhar.",
      );
    }
    if (senha !== lerTexto(formData.get("confirmacao"))) {
      throw new ErroDeCampo(
        "confirmacao",
        "A senha repetida não é igual à primeira. Digite as duas de novo, com calma.",
      );
    }

    const db = dbAdministrativo();

    if (await db.usuario.findUnique({ where: { email }, select: { id: true } })) {
      throw new ErroDeCampo(
        "email",
        "Já existe uma conta com este e-mail. Se ela é sua, use “Entrar” em vez de criar outra.",
      );
    }

    /*
     * Escritório e primeiro usuário numa escrita SÓ. Eram duas, e quando a
     * segunda falhava — dois cadastros com o mesmo e-mail ao mesmo tempo, que
     * a conferência acima não pega — sobrava um escritório sem ninguém. A
     * escrita aninhada é atômica: ou nascem os dois, ou nenhum.
     */
    const organizacao = await db.organizacao.create({
      data: {
        nome: escritorio,
        usuarios: {
          create: { nome, email, senhaHash: await gerarHashSenha(senha) },
        },
      },
      select: { usuarios: { select: { id: true } } },
    });

    await criarSessao(organizacao.usuarios[0].id);
  } catch (erro) {
    return falhou(erro, formData);
  }

  redirect("/");
}
