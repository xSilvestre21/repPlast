"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { dbAdministrativo } from "@/lib/db";
import { enviarDoSistema, urlDoSistema } from "@/lib/email-sistema";
import { montarEmailSistema } from "@/lib/email-sistema-html";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario as EstadoBase,
} from "@/lib/erro-formulario";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { conferirSenhaNova } from "@/lib/senha-nova";
import { criarSessao, escopoAtual } from "@/lib/sessao";

/** O estado de sempre mais o recado verde de "senha trocada". */
export type EstadoFormulario = EstadoBase & { aviso?: string };

function lerTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor : "";
}

/**
 * A pessoa troca a PRÓPRIA senha — a única forma de trocar a senha de alguém
 * de dentro do sistema. O administrador cria a senha inicial do preposto e
 * não mexe mais nela: senha que o chefe conhece não é senha do preposto.
 *
 * Pede a atual, como em todo lugar: uma sessão esquecida aberta num
 * computador do cliente não pode virar a conta tomada. Trocar derruba as
 * outras sessões (`sessaoVersao + 1`) e renova a desta, para quem trocou
 * continuar dentro.
 */
export async function trocarMinhaSenha(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const primeiroAcesso = formData.get("primeiroAcesso") === "1";

  try {
    const { usuarioId } = await escopoAtual();

    const atual = lerTexto(formData.get("atual"));
    const nova = lerTexto(formData.get("senha"));
    if (!atual) throw new ErroDeCampo("atual", "Digite a senha que você usa hoje para entrar.");

    const db = dbAdministrativo();
    const usuario = await db.usuario.findUnique({
      where: { id: usuarioId },
      select: { senhaHash: true, email: true, nome: true },
    });
    if (!usuario) throw new ErroParaUsuario("Não encontramos o seu usuário. Saia e entre de novo.");

    if (!(await conferirSenha(atual, usuario.senhaHash))) {
      throw new ErroDeCampo(
        "atual",
        "Esta não é a sua senha atual. Digite de novo — se não lembrar, saia e use “Esqueceu sua senha?” na tela de entrar.",
      );
    }

    conferirSenhaNova(nova, lerTexto(formData.get("confirmacao")));
    if (nova === atual) {
      throw new ErroDeCampo("senha", "A senha nova é igual à atual. Escolha uma diferente.");
    }

    await db.usuario.update({
      where: { id: usuarioId },
      data: {
        senhaHash: await gerarHashSenha(nova),
        senhaProvisoria: false,
        sessaoVersao: { increment: 1 },
      },
    });
    // A versão subiu: sem um cookie novo, esta sessão também cairia.
    await criarSessao(usuarioId);

    after(() =>
      enviarDoSistema({
        para: usuario.email,
        assunto: "A sua senha do RepPlast foi alterada",
        ...montarEmailSistema({
          nome: usuario.nome,
          paragrafos: [
            "A senha da sua conta no RepPlast acabou de ser trocada, e os outros aparelhos em que " +
              "você estava conectado precisam entrar de novo.",
          ],
          botao: { rotulo: "Entrar no RepPlast", url: `${urlDoSistema()}/entrar` },
          notas: [
            "Se foi você, está tudo certo. Se não foi, use “Esqueceu sua senha?” na tela de entrar " +
              "para criar outra agora e fale com o suporte.",
          ],
        }),
      }),
    );
  } catch (erro) {
    return falhou(erro, formData);
  }

  // No primeiro acesso, a troca era o que faltava antes de começar.
  if (primeiroAcesso) redirect("/");
  return { aviso: "Senha trocada. Nos outros aparelhos em que você estava conectado, é preciso entrar de novo." };
}
