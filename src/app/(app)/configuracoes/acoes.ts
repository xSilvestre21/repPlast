"use server";

/**
 * Preferências de conta do usuário logado.
 */

import { revalidatePath } from "next/cache";

import { contaParaEnvio } from "@/lib/conta-email";
import { cifrar, decifrar } from "@/lib/cripto";
import { testarConta } from "@/lib/email";
import { emailValido } from "@/lib/envio-pedido";
import { ehProvedor } from "@/lib/provedores-email";
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

/* -------------------------------------------------------------------------- */
/* Contas de e-mail                                                           */
/* -------------------------------------------------------------------------- */

export type EstadoConta = { erro?: string; ok?: string };

function lerCampo(formData: FormData, nome: string): string {
  const valor = formData.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

/**
 * Cria ou edita uma caixa de e-mail — e só grava se ela funcionar.
 *
 * Salvar TESTA antes: entra no servidor com os dados digitados e, se ele
 * recusar, nada é gravado e a mensagem diz por quê. Uma conta salva que não
 * envia só seria descoberta no primeiro pedido, na frente da indústria.
 *
 * Na edição, senha em branco quer dizer "mantenha a que está": a senha nunca
 * volta para o formulário, então a pessoa não teria como reenviá-la.
 */
export async function salvarContaEmail(
  contaId: string | null,
  _estado: EstadoConta,
  formData: FormData,
): Promise<EstadoConta> {
  try {
    const { usuarioId, organizacaoId, db } = await escopoAtual();

    const provedor = lerCampo(formData, "provedor");
    if (!ehProvedor(provedor)) return { erro: "Escolha o serviço de e-mail." };

    const email = lerCampo(formData, "email").toLowerCase();
    if (!emailValido(email)) return { erro: "O e-mail não parece um e-mail válido." };

    const nomeExibicao = lerCampo(formData, "nomeExibicao");
    if (!nomeExibicao) return { erro: "Informe o nome que aparece para quem recebe." };

    const host = lerCampo(formData, "host");
    if (!host) return { erro: "Informe o servidor SMTP." };

    const porta = Number(lerCampo(formData, "porta"));
    if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
      return { erro: "A porta precisa ser um número, como 465 ou 587." };
    }

    const tlsDireto = lerCampo(formData, "seguranca") !== "starttls";
    const usuarioSmtp = lerCampo(formData, "usuarioSmtp") || email;
    // Senha de app do Gmail aparece em quatro blocos com espaço; o servidor
    // quer as dezesseis letras juntas.
    const senhaDigitada = lerCampo(formData, "senha").replace(/\s+/g, "");

    const existente = contaId
      ? await db.contaEmail.findFirst({ where: { id: contaId, usuarioId } })
      : null;
    if (contaId && !existente) return { erro: "Conta não encontrada." };

    if (!senhaDigitada && !existente) return { erro: "Informe a senha." };

    const senha = senhaDigitada || decifrar(existente!.senhaCifrada);

    const teste = await testarConta({ email, nomeExibicao, host, porta, tlsDireto, usuarioSmtp, senha });
    if (!teste.ok) return { erro: teste.motivo };

    const repetida = await db.contaEmail.findFirst({
      where: { usuarioId, email, NOT: contaId ? { id: contaId } : undefined },
      select: { id: true },
    });
    if (repetida) return { erro: "Você já tem uma conta com este e-mail." };

    // A primeira conta é a padrão sem perguntar: com uma só, não há escolha.
    const quantas = await db.contaEmail.count({ where: { usuarioId } });
    const padrao = formData.get("padrao") === "on" || quantas === 0 || (existente?.padrao ?? false);

    if (padrao) {
      await db.contaEmail.updateMany({ where: { usuarioId }, data: { padrao: false } });
    }

    const dados = {
      provedor,
      email,
      nomeExibicao,
      host,
      porta,
      tlsDireto,
      usuarioSmtp,
      senhaCifrada: senhaDigitada ? cifrar(senhaDigitada) : existente!.senhaCifrada,
      padrao,
      testadaEm: new Date(),
    };

    if (existente) {
      await db.contaEmail.updateMany({ where: { id: existente.id, usuarioId }, data: dados });
    } else {
      await db.contaEmail.create({ data: { organizacaoId, usuarioId, ...dados } });
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/configuracoes");
  return { ok: "Conexão testada e conta salva." };
}

/** Entra na caixa já salva, sem mandar nada, e diz se ainda funciona. */
export async function testarContaEmail(
  contaId: string,
  _estado: EstadoConta,
  _formData: FormData,
): Promise<EstadoConta> {
  try {
    const { usuarioId, db } = await escopoAtual();

    const conta = await contaParaEnvio(db, usuarioId, contaId);
    if (!conta) return { erro: "Conta não encontrada." };

    const teste = await testarConta(conta);
    if (!teste.ok) return { erro: teste.motivo };

    await db.contaEmail.updateMany({
      where: { id: contaId, usuarioId },
      data: { testadaEm: new Date() },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível testar." };
  }

  revalidatePath("/configuracoes");
  return { ok: "Conexão funcionando." };
}

export async function definirContaPadrao(contaId: string, _formData: FormData): Promise<void> {
  const { usuarioId, db } = await escopoAtual();

  const conta = await db.contaEmail.findFirst({ where: { id: contaId, usuarioId } });
  if (!conta) throw new Error("Conta não encontrada.");

  await db.contaEmail.updateMany({ where: { usuarioId }, data: { padrao: false } });
  await db.contaEmail.updateMany({ where: { id: contaId, usuarioId }, data: { padrao: true } });

  revalidatePath("/configuracoes");
}

/**
 * Tira a conta. Se era a padrão, a mais antiga das que sobram assume — sem
 * padrão, o diálogo de envio abriria sem remetente escolhido.
 */
export async function excluirContaEmail(contaId: string, _formData: FormData): Promise<void> {
  const { usuarioId, db } = await escopoAtual();

  const conta = await db.contaEmail.findFirst({ where: { id: contaId, usuarioId } });
  if (!conta) return;

  await db.contaEmail.deleteMany({ where: { id: contaId, usuarioId } });

  if (conta.padrao) {
    const proxima = await db.contaEmail.findFirst({
      where: { usuarioId },
      orderBy: { criadoEm: "asc" },
      select: { id: true },
    });
    if (proxima) {
      await db.contaEmail.updateMany({ where: { id: proxima.id, usuarioId }, data: { padrao: true } });
    }
  }

  revalidatePath("/configuracoes");
}
