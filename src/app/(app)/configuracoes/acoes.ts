"use server";

/**
 * Preferências de conta do usuário logado — e, para o administrador, o nome e o
 * plano do escritório.
 */

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { atualizarValorAssinatura, ErroAsaas } from "@/lib/asaas";
import { limparAssinatura } from "@/lib/assinatura-email";
import { contaParaEnvio } from "@/lib/conta-email";
import { cifrar, decifrar } from "@/lib/cripto";
import { dbAdministrativo } from "@/lib/db";
import { dominioRecebeEmail } from "@/lib/dominio-email";
import { testarConta } from "@/lib/email";
import { enviarDoSistema, urlDoSistema } from "@/lib/email-sistema";
import { montarEmailSistema } from "@/lib/email-sistema-html";
import { problemaNoEmail } from "@/lib/email-valido";
import { emailValido } from "@/lib/envio-pedido";
import { minutosAte, minutosPorExtenso } from "@/lib/limite-tentativas";
import { normalizarTelefone } from "@/lib/mascara";
import { PLANOS, valorMensal, type CodigoPlano } from "@/lib/planos";
import { conferirSenha } from "@/lib/senha";
import { bloqueioDoLogin, ipDaRequisicao, registrarFalha } from "@/lib/tentativas-login";
import { bloqueioDasTrocas, criarTrocaEmail, VALIDADE_TROCA_MIN } from "@/lib/troca-email";
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

/** O estado de sempre mais o recado verde de "deu certo". */
export type EstadoConta = EstadoFormulario & { ok?: string };

const ASSINATURA_SUMIU =
  "Esta assinatura não foi encontrada — ela pode ter sido excluída em outra tela. " +
  "Recarregue a página.";

const CONTA_SUMIU =
  "Esta conta de e-mail não foi encontrada — ela pode ter sido excluída em outra tela. " +
  "Recarregue a página.";

const USUARIO_SUMIU = "Não encontramos o seu usuário. Saia e entre de novo no sistema.";

/* -------------------------------------------------------------------------- */
/* Perfil                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Nome, sobrenome e telefone de quem está logado — para corrigir o que saiu
 * errado no cadastro.
 *
 * O administrador precisa do sobrenome: é ele quem paga, e o checkout do Asaas
 * recusa nome sem sobrenome ("O campo name é inválido") — mesma regra do
 * cadastro. O preposto pode ficar só com o nome, como na ficha dele.
 */
export async function salvarPerfil(
  _estado: EstadoConta,
  formData: FormData,
): Promise<EstadoConta> {
  try {
    const { usuarioId, organizacaoId, ehAdmin, db } = await escopoAtual();

    const nome = lerCampo(formData, "nome").replace(/\s+/g, " ");
    const sobrenome = lerCampo(formData, "sobrenome").replace(/\s+/g, " ");
    if (!nome) throw new ErroDeCampo("nome", "Informe o seu nome, como João.");
    if (ehAdmin && !sobrenome) {
      throw new ErroDeCampo(
        "sobrenome",
        "Informe também o sobrenome, como da Silva — o pagamento da assinatura pede o nome completo.",
      );
    }

    await db.usuario.updateMany({
      where: { id: usuarioId, organizacaoId },
      data: {
        nome,
        sobrenome: sobrenome || null,
        telefone: normalizarTelefone(lerCampo(formData, "telefone")),
      },
    });
  } catch (erro) {
    return falhou(erro, formData);
  }

  // O menu de TODAS as telas mostra o nome.
  revalidatePath("/", "layout");
  return { ok: "Perfil salvo." };
}

/**
 * Pede a troca do e-mail de login: confere a senha e manda o link ao endereço
 * novo. Nada muda até o link ser aberto (`lib/troca-email.ts`).
 *
 * A senha é pedida pelo mesmo motivo da tela de senha: uma sessão esquecida
 * aberta no computador do cliente não pode virar a conta tomada — trocar o
 * e-mail é trocar para onde vai o "Esqueceu sua senha?".
 */
export async function pedirTrocaEmail(
  _estado: EstadoConta,
  formData: FormData,
): Promise<EstadoConta> {
  try {
    const { usuarioId } = await escopoAtual();
    const db = dbAdministrativo();

    const usuario = await db.usuario.findUnique({
      where: { id: usuarioId },
      select: { email: true, nome: true, senhaHash: true },
    });
    if (!usuario) throw new ErroParaUsuario(USUARIO_SUMIU);

    const email = lerCampo(formData, "emailNovo").toLowerCase();
    if (!email) throw new ErroDeCampo("emailNovo", "Digite o e-mail novo, como voce@escritorio.com.br.");
    const problema = problemaNoEmail(email);
    if (problema) throw new ErroDeCampo("emailNovo", problema);
    if (email === usuario.email) {
      throw new ErroDeCampo("emailNovo", "Este já é o seu e-mail de login. Digite o e-mail novo.");
    }

    // Sem `trim`: espaço pode ser parte da senha.
    const bruta = formData.get("senhaAtual");
    const senha = typeof bruta === "string" ? bruta : "";
    if (!senha) throw new ErroDeCampo("senhaAtual", "Digite a senha que você usa hoje para entrar.");

    // A mesma porta do login: senão, quem achasse uma sessão aberta testaria
    // senhas à vontade aqui. Bloqueado, nem confere — como no login.
    const quem = { email: usuario.email, ip: await ipDaRequisicao() };
    const fechado = await bloqueioDoLogin(quem);
    if (fechado) {
      throw new ErroDeCampo(
        "senhaAtual",
        `Muitas tentativas com senha errada. Espere ${minutosPorExtenso(minutosAte(fechado, new Date()))} ` +
          "e tente de novo.",
      );
    }
    if (!(await conferirSenha(senha, usuario.senhaHash))) {
      await registrarFalha(quem);
      throw new ErroDeCampo(
        "senhaAtual",
        "Esta não é a sua senha atual. Digite de novo — se não lembrar, troque a senha antes, em “Trocar minha senha”.",
      );
    }

    const libera = await bloqueioDasTrocas(usuarioId);
    if (libera) {
      throw new ErroParaUsuario(
        "Você já pediu vários links há pouco. Confira a caixa de entrada e o spam do e-mail novo — " +
          `ou espere ${minutosPorExtenso(minutosAte(libera, new Date()))} para pedir de novo.`,
      );
    }

    if (await db.usuario.findUnique({ where: { email }, select: { id: true } })) {
      throw new ErroDeCampo("emailNovo", "Este e-mail já é o login de outra conta no sistema. Use outro e-mail.");
    }
    const dominio = email.split("@")[1];
    if (!(await dominioRecebeEmail(dominio))) {
      throw new ErroDeCampo(
        "emailNovo",
        `O endereço “${dominio}” não recebe e-mails. Confira o que vem depois do @, como voce@escritorio.com.br.`,
      );
    }

    const token = await criarTrocaEmail({ usuarioId, emailNovo: email, ip: quem.ip });
    const link = `${urlDoSistema()}/confirmar-email/${token}`;
    after(() =>
      enviarDoSistema({
        para: email,
        assunto: "Confirme o seu e-mail novo no RepPlast",
        ...montarEmailSistema({
          nome: usuario.nome,
          paragrafos: [
            `Você pediu para entrar no RepPlast com este e-mail no lugar de ${usuario.email}. ` +
              "Clique no botão abaixo para confirmar:",
          ],
          botao: { rotulo: "Confirmar e-mail novo", url: link },
          notas: [
            `Este link vale por ${VALIDADE_TROCA_MIN} minutos e funciona uma vez só.`,
            "Se não foi você, ignore este e-mail: nada muda na conta.",
          ],
        }),
      }),
    );
  } catch (erro) {
    // A senha nunca volta para o navegador (`valoresDigitados` a tira).
    return falhou(erro, formData);
  }

  revalidatePath("/configuracoes");
  return {
    ok:
      "Mandamos um link para o e-mail novo. A troca só vale depois que você clicar nele — até lá, " +
      "continue entrando com o e-mail de hoje.",
  };
}

/* -------------------------------------------------------------------------- */
/* Escritório                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Passa o escritório para o outro plano — Solo ↔ Max.
 *
 * Só o administrador. O valor novo vale da próxima mensalidade (e da que está
 * em aberto), sem conta proporcional — o mesmo que já acontece quando um
 * preposto passa dos inclusos. O Asaas é acertado ANTES de gravar, como em
 * `acertarMensalidade` (`prepostos/acoes.ts`): se ele recusar, nada muda.
 *
 * Max → Solo com preposto ativo é recusado: o Solo não tem preposto, e
 * inativar a equipe por baixo dos panos seria uma ação em massa escondida num
 * botão de plano. Inativos podem ficar — o trigger `usuario_exige_plus` só
 * olha quem é criado ou muda de papel, e voltar ao Max os traz de volta.
 *
 * Grava pelo cliente administrativo: o trigger `cobranca_so_administrativa`
 * impede o papel da aplicação de mexer no plano, para ninguém se dar o Max
 * montando a requisição à mão sem passar por aqui.
 */
export async function trocarPlano(
  planoNovo: CodigoPlano,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    // Chega pelo `bind`, mas viaja do navegador como qualquer argumento.
    if (planoNovo !== "PADRAO" && planoNovo !== "PLUS") {
      throw new ErroParaUsuario("Não deu para saber qual plano escolher. Recarregue a página e tente de novo.");
    }
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const [organizacao, ativos] = await Promise.all([
      db.organizacao.findUniqueOrThrow({
        where: { id: organizacaoId },
        select: { plano: true, asaasAssinaturaId: true },
      }),
      db.usuario.count({ where: { organizacaoId, papel: "REPRESENTANTE", ativo: true } }),
    ]);

    const destino = PLANOS[planoNovo];
    if (organizacao.plano === planoNovo) {
      throw new ErroParaUsuario(`O escritório já está no plano ${destino.nome}.`);
    }
    if (planoNovo === "PADRAO" && ativos > 0) {
      throw new ErroParaUsuario(
        `O Solo não tem prepostos. Inative ${ativos === 1 ? "o preposto ativo" : `os ${ativos} prepostos ativos`} ` +
          "em “Prepostos” antes de passar para o Solo — os dados e os pedidos deles continuam guardados.",
      );
    }

    if (organizacao.asaasAssinaturaId) {
      try {
        await atualizarValorAssinatura(organizacao.asaasAssinaturaId, valorMensal(planoNovo, ativos), planoNovo);
      } catch (erro) {
        if (!(erro instanceof ErroAsaas)) throw erro;
        throw new ErroParaUsuario(
          "Não conseguimos acertar a mensalidade agora, e por isso o plano não foi trocado. " +
            "Tente de novo em alguns minutos.",
        );
      }
    }

    await dbAdministrativo().organizacao.update({
      where: { id: organizacaoId },
      data: { plano: planoNovo },
    });
  } catch (erro) {
    return falhou(erro);
  }

  // O menu (Prepostos) e as telas com coluna de preposto dependem do plano.
  revalidatePath("/", "layout");
  return {};
}

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
 *
 * As assinaturas não passam por aqui: têm as ações delas, logo abaixo, e
 * mexer numa não pede testar a conexão de novo.
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

/* -------------------------------------------------------------------------- */
/* Assinaturas de cada conta                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cria ou edita uma assinatura da caixa `contaId`.
 *
 * Chega o HTML que a pessoa colou, e é gravado limpo (`limparAssinatura`).
 * Caixa vazia é recusada: o jeito de tirar uma assinatura é "Excluir", e
 * gravar uma vazia deixaria na lista do envio um nome que manda nada.
 *
 * A primeira da caixa é a padrão sem perguntar, como a primeira conta.
 */
export async function salvarAssinaturaEmail(
  contaId: string,
  assinaturaId: string | null,
  _estado: EstadoConta,
  formData: FormData,
): Promise<EstadoConta> {
  try {
    const { usuarioId, organizacaoId, db } = await escopoAtual();

    const conta = await db.contaEmail.findFirst({ where: { id: contaId, usuarioId }, select: { id: true } });
    if (!conta) throw new ErroParaUsuario(CONTA_SUMIU);

    const existente = assinaturaId
      ? await db.assinaturaEmail.findFirst({ where: { id: assinaturaId, contaId, usuarioId } })
      : null;
    if (assinaturaId && !existente) throw new ErroParaUsuario(ASSINATURA_SUMIU);

    const nome = lerCampo(formData, "nome");
    if (!nome) {
      throw new ErroDeCampo(
        "nome",
        "Dê um nome para reconhecer esta assinatura na hora de enviar, como “Completa” ou “Curta”.",
      );
    }

    const repetida = await db.assinaturaEmail.findFirst({
      where: { contaId, usuarioId, nome, NOT: assinaturaId ? { id: assinaturaId } : undefined },
      select: { id: true },
    });
    if (repetida) {
      throw new ErroDeCampo(
        "nome",
        "Este e-mail já tem uma assinatura com este nome. Use outro, como “Curta” ou o nome da indústria.",
      );
    }

    const { html } = limparAssinatura(lerCampo(formData, "assinatura"));
    if (!html) {
      throw new ErroDeCampo(
        "assinatura",
        "A caixa da assinatura está vazia. Cole a sua assinatura nela (Ctrl+V) ou escreva uma. " +
          "Para tirar esta assinatura, use “Excluir”, na lista.",
      );
    }

    const quantas = await db.assinaturaEmail.count({ where: { contaId, usuarioId } });
    const padrao = formData.get("padrao") === "on" || quantas === 0 || (existente?.padrao ?? false);
    if (padrao) {
      await db.assinaturaEmail.updateMany({ where: { contaId, usuarioId }, data: { padrao: false } });
    }

    if (existente) {
      await db.assinaturaEmail.updateMany({
        where: { id: existente.id, usuarioId },
        data: { nome, html, padrao },
      });
    } else {
      await db.assinaturaEmail.create({
        data: { organizacaoId, usuarioId, contaId, nome, html, padrao },
      });
    }
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath("/configuracoes");
  return { ok: "Assinatura salva." };
}

/** A assinatura que já vem escolhida no envio por esta caixa. */
export async function definirAssinaturaPadrao(
  assinaturaId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { usuarioId, db } = await escopoAtual();

    const assinatura = await db.assinaturaEmail.findFirst({ where: { id: assinaturaId, usuarioId } });
    if (!assinatura) throw new ErroParaUsuario(ASSINATURA_SUMIU);

    await db.assinaturaEmail.updateMany({
      where: { contaId: assinatura.contaId, usuarioId },
      data: { padrao: false },
    });
    await db.assinaturaEmail.updateMany({ where: { id: assinaturaId, usuarioId }, data: { padrao: true } });
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/configuracoes");
  return {};
}

/**
 * Tira a assinatura. Se era a padrão, a mais antiga das que sobram assume —
 * quem tem assinatura continua mandando com uma, sem precisar escolher.
 */
export async function excluirAssinaturaEmail(
  assinaturaId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { usuarioId, db } = await escopoAtual();

    const assinatura = await db.assinaturaEmail.findFirst({ where: { id: assinaturaId, usuarioId } });
    if (!assinatura) return {};

    await db.assinaturaEmail.deleteMany({ where: { id: assinaturaId, usuarioId } });

    if (assinatura.padrao) {
      const proxima = await db.assinaturaEmail.findFirst({
        where: { contaId: assinatura.contaId, usuarioId },
        orderBy: { criadoEm: "asc" },
        select: { id: true },
      });
      if (proxima) {
        await db.assinaturaEmail.updateMany({ where: { id: proxima.id, usuarioId }, data: { padrao: true } });
      }
    }
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/configuracoes");
  return {};
}
