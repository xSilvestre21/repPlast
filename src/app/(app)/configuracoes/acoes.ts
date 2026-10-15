"use server";

/**
 * Preferências de conta do usuário logado — e, para o administrador, o nome do
 * escritório.
 */

import { revalidatePath } from "next/cache";

import { contaParaEnvio } from "@/lib/conta-email";
import { cifrar, decifrar } from "@/lib/cripto";
import { testarConta } from "@/lib/email";
import { emailValido } from "@/lib/envio-pedido";
import { problemaNoModelo } from "@/lib/modelo-email";
import { MODELOS_DE_EMAIL, type TipoDeEmail, ehTipoDeEmail } from "@/lib/tipos-de-email";
import { ehProvedor } from "@/lib/provedores-email";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import {
  dataDaProximaTroca,
  normalizarNomeEscritorio,
  problemaNoNomeEscritorio,
} from "@/lib/escritorio-regras";
import { ehConflitoDeNome, erroNomeEmUso, nomeEmUso, situacaoDoNome } from "@/lib/nome-escritorio";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";

export type { EstadoFormulario };

const CONTA_SUMIU =
  "Esta conta de e-mail não foi encontrada — ela pode ter sido excluída em outra tela. " +
  "Recarregue a página.";

/**
 * Troca o nome do escritório — o que aparece no topo de todas as telas.
 *
 * Só o administrador: o nome é do escritório, não de quem clicou. De graça,
 * livre nos primeiros dias e depois uma troca por intervalo
 * (`proximaTrocaPermitida`); nome de outro escritório ativo é recusado, e o
 * nome que este deixou fica livre — para outro, ou para ele mesmo voltar.
 *
 * O nome e o histórico vão numa escrita só (aninhada): sem histórico, a troca
 * seguinte não saberia esperar o intervalo.
 */
export async function renomearEscritorio(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const bruto = formData.get("escritorio");
  const nome = normalizarNomeEscritorio(typeof bruto === "string" ? bruto : "");

  try {
    await exigirAdmin();
    const { usuarioId, organizacaoId, db } = await escopoAtual();

    const problema = problemaNoNomeEscritorio(nome);
    if (problema) throw new ErroDeCampo("escritorio", problema);

    const situacao = await situacaoDoNome(db, organizacaoId);
    if (!situacao) {
      throw new ErroParaUsuario("Não encontramos o seu escritório. Saia e entre de novo no sistema.");
    }
    if (situacao.nome === nome) {
      throw new ErroDeCampo(
        "escritorio",
        "Este já é o nome do escritório. Digite o nome novo antes de usar “Trocar nome”.",
      );
    }
    if (situacao.proximaTroca) {
      throw new ErroDeCampo(
        "escritorio",
        "O nome foi trocado há pouco tempo. A próxima troca fica liberada em " +
          `${dataDaProximaTroca(situacao.proximaTroca)}.`,
      );
    }
    if (await nomeEmUso(db, nome, { exceto: organizacaoId })) {
      throw erroNomeEmUso("escritorio", nome);
    }

    await db.organizacao.update({
      where: { id: organizacaoId },
      data: {
        nome,
        trocasDeNome: { create: { usuarioId, nomeAnterior: situacao.nome, nomeNovo: nome } },
      },
    });
  } catch (erro) {
    // Outro escritório levou o nome entre a conferência e a gravação.
    if (ehConflitoDeNome(erro)) return falhou(erroNomeEmUso("escritorio", nome), formData);
    return falhou(erro, formData);
  }

  // O topo de TODAS as telas mostra o nome.
  revalidatePath("/", "layout");
  return {};
}

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

  if (!usuario) {
    throw new ErroParaUsuario("Não encontramos o seu usuário. Saia e entre de novo no sistema.");
  }

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
    return falhou(erro, formData);
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
    return falhou(erro, formData);
  }

  revalidatePath("/configuracoes");
  return {};
}

/**
 * O assunto e a mensagem com que o e-mail do pedido — ou o da proposta — abre.
 *
 * De cada usuário: quem envia assina. Campo vazio volta ao texto de sempre.
 * Recusa variável que não existe e trecho `{se …}` sem `{fim}` — salvos, iriam
 * para a indústria ou o cliente com chaves no meio, e a pessoa só veria no
 * primeiro envio.
 *
 * O `tipo` chega preso pelo `.bind` da página, mas argumento de `bind` viaja
 * do navegador como qualquer outro: é conferido antes de escolher coluna.
 */
export async function salvarMensagemEnvioPadrao(
  tipo: TipoDeEmail,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    if (!ehTipoDeEmail(tipo)) {
      throw new ErroParaUsuario("Não deu para saber qual mensagem salvar. Recarregue a página e tente de novo.");
    }
    const modelo = MODELOS_DE_EMAIL[tipo];
    const { usuarioId, organizacaoId, db } = await escopoAtual();

    // O textarea manda `\r\n`; o modelo guarda `\n`. Igual ao texto de sempre
    // grava nulo, para que ele continue valendo se um dia mudar.
    const ler = (nome: string, padrao: string) => {
      const bruto = formData.get(nome);
      const texto = typeof bruto === "string" ? bruto.replace(/\r\n?/g, "\n").trim() : "";
      return texto === "" || texto === padrao ? null : texto;
    };
    const assunto = ler(modelo.colunas.assunto, modelo.assuntoPadrao);
    const mensagem = ler(modelo.colunas.mensagem, modelo.mensagemPadrao);

    // Cada campo por si: um `{se}` no assunto não se fecha com o `{fim}` da
    // mensagem. E o erro vai para o campo onde o problema está — antes a
    // frase não dizia se era no assunto ou na mensagem.
    for (const [campo, texto] of [
      [modelo.colunas.assunto, assunto],
      [modelo.colunas.mensagem, mensagem],
    ] as const) {
      const problema = texto && problemaNoModelo(texto, modelo.tabela, modelo.doDocumento);
      if (problema) throw new ErroDeCampo(campo, problema);
    }

    await db.usuario.updateMany({
      where: { id: usuarioId, organizacaoId },
      data: { [modelo.colunas.assunto]: assunto, [modelo.colunas.mensagem]: mensagem },
    });
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath("/configuracoes");
  return {};
}

/* -------------------------------------------------------------------------- */
/* Contas de e-mail                                                           */
/* -------------------------------------------------------------------------- */

export type EstadoConta = EstadoFormulario & { ok?: string };

/**
 * A senha já salva, para testar a conta sem pedi-la de novo. Se ela não puder
 * ser lida (a chave do servidor mudou), o caminho é digitá-la outra vez — e a
 * frase diz isso, em vez do erro de criptografia.
 */
function senhaGuardada(cifrada: string): string {
  try {
    return decifrar(cifrada);
  } catch (erro) {
    console.error(erro);
    throw new ErroDeCampo(
      "senha",
      "Não conseguimos ler a senha guardada desta conta. Digite a senha de novo e salve.",
    );
  }
}

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
    if (!ehProvedor(provedor)) {
      throw new ErroDeCampo("provedor", "Escolha o seu serviço de e-mail: Gmail, Outlook ou outro.");
    }

    const email = lerCampo(formData, "email").toLowerCase();
    if (!emailValido(email)) {
      throw new ErroDeCampo(
        "email",
        "Este e-mail parece incompleto. Confira se tem o @ e o final, como voce@escritorio.com.br.",
      );
    }

    const nomeExibicao = lerCampo(formData, "nomeExibicao");
    if (!nomeExibicao) {
      throw new ErroDeCampo(
        "nomeExibicao",
        "Informe o nome que aparece para quem recebe — por exemplo, o nome do seu escritório.",
      );
    }

    const host = lerCampo(formData, "host");
    if (!host) {
      throw new ErroDeCampo(
        "host",
        "Informe o servidor de envio, como smtp.seudominio.com.br. Quem fornece o seu e-mail sabe qual é.",
      );
    }

    const porta = Number(lerCampo(formData, "porta"));
    if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
      throw new ErroDeCampo("porta", "A porta é um número, quase sempre 465 ou 587.");
    }

    const tlsDireto = lerCampo(formData, "seguranca") !== "starttls";
    const usuarioSmtp = lerCampo(formData, "usuarioSmtp") || email;
    // Senha de app do Gmail aparece em quatro blocos com espaço; o servidor
    // quer as dezesseis letras juntas.
    const senhaDigitada = lerCampo(formData, "senha").replace(/\s+/g, "");

    const existente = contaId
      ? await db.contaEmail.findFirst({ where: { id: contaId, usuarioId } })
      : null;
    if (contaId && !existente) throw new ErroParaUsuario(CONTA_SUMIU);

    if (!senhaDigitada && !existente) {
      throw new ErroDeCampo("senha", "Informe a senha da conta de e-mail.");
    }

    const senha = senhaDigitada || senhaGuardada(existente!.senhaCifrada);

    const teste = await testarConta({ email, nomeExibicao, host, porta, tlsDireto, usuarioSmtp, senha });
    if (!teste.ok) {
      // O servidor recusou: a frase já vem explicada, e o campo diz onde mexer.
      throw teste.campo ? new ErroDeCampo(teste.campo, teste.motivo) : new ErroParaUsuario(teste.motivo);
    }

    const repetida = await db.contaEmail.findFirst({
      where: { usuarioId, email, NOT: contaId ? { id: contaId } : undefined },
      select: { id: true },
    });
    if (repetida) {
      throw new ErroDeCampo(
        "email",
        "Você já cadastrou uma conta com este e-mail. Para mudar algo nela, use “Editar”, ao lado dela.",
      );
    }

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
    // A senha nunca volta para o navegador (`valoresDigitados` a tira).
    return falhou(erro, formData);
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
    if (!conta) throw new ErroParaUsuario(CONTA_SUMIU);

    const teste = await testarConta(conta);
    if (!teste.ok) {
      throw new ErroParaUsuario(
        teste.campo === "senha"
          ? `${teste.motivo} Use “Editar”, ao lado da conta, para trocar a senha.`
          : teste.motivo,
      );
    }

    await db.contaEmail.updateMany({
      where: { id: contaId, usuarioId },
      data: { testadaEm: new Date() },
    });
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/configuracoes");
  return { ok: "Conexão funcionando." };
}

async function gravarDefinirContaPadrao(contaId: string, _formData: FormData): Promise<void> {
  const { usuarioId, db } = await escopoAtual();

  const conta = await db.contaEmail.findFirst({ where: { id: contaId, usuarioId } });
  if (!conta) throw new ErroParaUsuario(CONTA_SUMIU);

  await db.contaEmail.updateMany({ where: { usuarioId }, data: { padrao: false } });
  await db.contaEmail.updateMany({ where: { id: contaId, usuarioId }, data: { padrao: true } });

  revalidatePath("/configuracoes");
}

/**
 * Tira a conta. Se era a padrão, a mais antiga das que sobram assume — sem
 * padrão, o diálogo de envio abriria sem remetente escolhido.
 */
async function gravarExcluirContaEmail(contaId: string, _formData: FormData): Promise<void> {
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

/** `gravarDefinirContaPadrao`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function definirContaPadrao(
  contaId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarDefinirContaPadrao(contaId, _formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}

/** `gravarExcluirContaEmail`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function excluirContaEmail(
  contaId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarExcluirContaEmail(contaId, _formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}
