"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { criarCheckout, ErroAsaas } from "@/lib/asaas";
import { dbAdministrativo } from "@/lib/db";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { normalizarCep, normalizarDocumento, somenteDigitos } from "@/lib/mascara";
import { planoDaUrl, type CodigoPlano } from "@/lib/planos";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { normalizarNomeEscritorio, problemaNoNomeEscritorio } from "@/lib/escritorio-regras";
import { ehConflitoDeNome, erroNomeEmUso, nomeEmUso } from "@/lib/nome-escritorio";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";
import { enviarDoSistema, urlDoSistema } from "@/lib/email-sistema";
import { montarEmailSistema } from "@/lib/email-sistema-html";
import { minutosAte, minutosPorExtenso } from "@/lib/limite-tentativas";
import {
  bloqueioDosPedidos,
  criarRedefinicao,
  LINK_VENCIDO,
  redefinirPeloLink,
  VALIDADE_MIN,
} from "@/lib/redefinicao-senha";
import { criarSessao, encerrarSessao, sessaoAtual } from "@/lib/sessao";
import {
  bloqueioDoLogin,
  ipDaRequisicao,
  JANELA_MIN,
  limparFalhas,
  registrarFalha,
  tentativasRestantes,
} from "@/lib/tentativas-login";

export type { EstadoFormulario };

const EMAIL_INCOMPLETO =
  "Este e-mail parece incompleto. Confira se tem o @ e o final, como voce@escritorio.com.br.";

/**
 * O Asaas fora do ar ou recusando o pedido. A conta já existe nesse ponto, e
 * por isso a frase manda entrar — e não cadastrar de novo, que daria "e-mail
 * já cadastrado".
 */
const PAGAMENTO_INDISPONIVEL =
  "Não conseguimos abrir a página de pagamento agora. Sua conta foi criada: entre com o seu " +
  "e-mail e senha em alguns minutos e use “Ir para o pagamento” para concluir.";

function lerTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Guardamos em minúsculas para que o login não dependa de como foi digitado. */
function lerEmail(valor: FormDataEntryValue | null): string {
  return lerTexto(valor).toLowerCase();
}

/** A senha nova e a repetição — no cadastro e na redefinição, com as mesmas frases. */
function conferirSenhaNova(senha: string, formData: FormData): void {
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
}

function loginBloqueado(libera: Date): ErroParaUsuario {
  return new ErroParaUsuario(
    `Muitas tentativas com senha errada. Espere ${minutosPorExtenso(minutosAte(libera, new Date()))} ` +
      "e tente de novo — ou use “Esqueceu sua senha?” para criar uma nova.",
  );
}

/**
 * Registra a senha errada e devolve a recusa, dizendo quantas tentativas sobram. A que esgota o
 * limite já mostra o bloqueio: avisar "restam 0" e só bloquear na próxima
 * faria a pessoa digitar mais uma senha à toa.
 *
 * A mesma frase para e-mail inexistente e senha errada, de propósito:
 * distinguir os dois casos entregaria a quem tenta invadir a informação de
 * quais e-mails têm conta no sistema.
 */
async function senhaErrada(quem: { email: string; ip: string }): Promise<ErroParaUsuario> {
  await registrarFalha(quem);

  const libera = await bloqueioDoLogin(quem);
  if (libera) return loginBloqueado(libera);

  const resta = await tentativasRestantes(quem);
  return new ErroParaUsuario(
    "E-mail ou senha incorretos. Confira se o e-mail está certo e se o Caps Lock não está " +
      `ligado. ${resta === 1 ? "Resta 1 tentativa" : `Restam ${resta} tentativas`} antes de o ` +
      `acesso ficar bloqueado por ${JANELA_MIN} minutos.`,
  );
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

    // Antes de olhar a senha: bloqueado, nem a certa entra.
    const ip = await ipDaRequisicao();
    const libera = await bloqueioDoLogin({ email, ip });
    if (libera) throw loginBloqueado(libera);

    const usuario = await dbAdministrativo().usuario.findUnique({
      where: { email },
      select: { id: true, senhaHash: true, organizacao: { select: { ativa: true } } },
    });

    if (!usuario) {
      // Confere contra um hash descartável mesmo sem usuário: sem isso, a
      // resposta voltaria bem mais rápido e denunciaria que o e-mail não existe.
      await conferirSenha(senha, await gerarHashSenha("descartavel"));
      throw await senhaErrada({ email, ip });
    }

    if (!(await conferirSenha(senha, usuario.senhaHash))) throw await senhaErrada({ email, ip });
    if (!usuario.organizacao.ativa) {
      throw new ErroParaUsuario(
        "Este escritório está desativado, e por isso não dá para entrar. Se acha que é engano, " +
          "fale com o suporte.",
      );
    }

    await limparFalhas(email);
    await criarSessao(usuario.id);
  } catch (erro) {
    return falhou(erro, formData);
  }

  redirect("/");
}

/**
 * "Esqueceu sua senha?": manda o link para criar uma senha nova.
 *
 * A resposta é a MESMA com ou sem conta para o e-mail — senão esta tela diria
 * a qualquer um quais e-mails têm conta. Pelo mesmo motivo o e-mail sai em
 * `after`, depois da resposta: enviar leva segundos, e esperar por ele só
 * quando a conta existe denunciaria a conta pelo tempo.
 */
export async function pedirRedefinicaoSenha(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const email = lerEmail(formData.get("email"));
    if (!email) throw new ErroDeCampo("email", "Informe o e-mail com que você entra no sistema.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDeCampo("email", EMAIL_INCOMPLETO);

    const ip = await ipDaRequisicao();
    const libera = await bloqueioDosPedidos({ email, ip });
    if (libera) {
      throw new ErroParaUsuario(
        "Já pedimos vários links para este e-mail há pouco. Confira a caixa de entrada e o spam — " +
          `ou espere ${minutosPorExtenso(minutosAte(libera, new Date()))} para pedir de novo.`,
      );
    }

    const envio = await criarRedefinicao({ email, ip });
    if (envio) {
      const link = `${urlDoSistema()}/redefinir-senha/${envio.token}`;
      after(() =>
        enviarDoSistema({
          para: envio.para,
          assunto: "Crie uma senha nova no RepPlast",
          ...montarEmailSistema({
            nome: envio.nome,
            paragrafos: [
              "Recebemos um pedido para criar uma senha nova para a sua conta no RepPlast. " +
                "Clique no botão abaixo para criar:",
            ],
            botao: { rotulo: "Criar senha nova", url: link },
            notas: [
              `Este link vale por ${VALIDADE_MIN} minutos e funciona uma vez só.`,
              "Se não foi você, ignore este e-mail: a sua senha continua a mesma.",
            ],
          }),
        }),
      );
    }
  } catch (erro) {
    return falhou(erro, formData);
  }

  redirect("/esqueci-senha?enviado=1");
}

/**
 * A senha nova, pelo link do e-mail. O `token` chega preso pelo `.bind` da
 * página, mas viaja do navegador como qualquer argumento: quem confere é
 * `redefinirPeloLink`, não a página.
 */
export async function redefinirSenha(
  token: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const senha = lerTexto(formData.get("senha"));
    conferirSenhaNova(senha, formData);

    const trocada = await redefinirPeloLink(String(token), await gerarHashSenha(senha));
    if (!trocada) throw new ErroParaUsuario(LINK_VENCIDO);

    // As senhas erradas de antes não contam mais contra quem acabou de provar
    // que é dono do e-mail.
    await limparFalhas(trocada.email);
    after(() =>
      enviarDoSistema({
        para: trocada.email,
        assunto: "A sua senha do RepPlast foi alterada",
        ...montarEmailSistema({
          nome: trocada.nome,
          paragrafos: [
            "A senha da sua conta no RepPlast acabou de ser trocada, e todos os aparelhos que estavam " +
              "conectados precisam entrar de novo.",
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

  redirect("/entrar?senha=redefinida");
}

export async function sair(): Promise<void> {
  await encerrarSessao();
  redirect("/entrar");
}

/**
 * Abre um checkout novo e o amarra ao escritório.
 *
 * Grava o id ANTES de devolver o link: é por ele que o webhook `CHECKOUT_PAID`
 * acha o escritório, e um pagamento feito num checkout que não foi gravado não
 * liberaria ninguém. O cliente administrativo é necessário porque um trigger
 * impede o papel da aplicação de mexer nos campos de cobrança.
 */
async function abrirPagamento(organizacao: {
  id: string;
  plano: CodigoPlano;
  nome: string;
  email: string;
  documento: string;
  cep: string;
}): Promise<string> {
  const checkout = await criarCheckout(organizacao.plano, {
    nome: organizacao.nome,
    email: organizacao.email,
    cpfCnpj: organizacao.documento,
    cep: organizacao.cep,
  });

  await dbAdministrativo().organizacao.update({
    where: { id: organizacao.id },
    data: { asaasCheckoutId: checkout.id },
  });

  return checkout.url;
}

/** Falha do Asaas vira frase em português; o resto segue para o `falhou`. */
async function abrirPagamentoOu(
  frase: string,
  organizacao: Parameters<typeof abrirPagamento>[0],
): Promise<string> {
  try {
    return await abrirPagamento(organizacao);
  } catch (erro) {
    if (erro instanceof ErroAsaas) throw new ErroParaUsuario(frase);
    throw erro;
  }
}

/**
 * Cria um escritório novo com o seu primeiro usuário, e manda pagar.
 *
 * É o onboarding do SaaS: cada cadastro nasce como um tenant isolado, e a
 * partir daí nada mais atravessa a fronteira entre escritórios. Nasce
 * AGUARDANDO_PAGAMENTO e com a sessão aberta — quem fechar o checkout sem
 * pagar cai em `/assinatura` ao entrar, e de lá retoma.
 */
export async function cadastrar(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let pagamento: string;

  try {
    const plano = planoDaUrl(lerTexto(formData.get("plano")));
    if (!plano) {
      throw new ErroParaUsuario(
        "Escolha um plano antes de criar o escritório — use “Trocar plano”, logo acima.",
      );
    }

    const escritorio = normalizarNomeEscritorio(lerTexto(formData.get("escritorio")));
    const nome = lerTexto(formData.get("nome"));
    const email = lerEmail(formData.get("email"));
    const senha = lerTexto(formData.get("senha"));

    const problemaNoNome = problemaNoNomeEscritorio(escritorio);
    if (problemaNoNome) throw new ErroDeCampo("escritorio", problemaNoNome);
    if (!nome) throw new ErroDeCampo("nome", "Informe o seu nome e sobrenome.");
    if (!email) throw new ErroDeCampo("email", "Informe o seu e-mail — é com ele que você vai entrar.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDeCampo("email", EMAIL_INCOMPLETO);

    conferirSenhaNova(senha, formData);

    // O checkout do Asaas exige os dois; aqui eles são obrigatórios, ao
    // contrário do cadastro de cliente, onde vazio quer dizer "não sei".
    const documento = normalizarDocumento(lerTexto(formData.get("documento")), "documento");
    if (!documento) {
      throw new ErroDeCampo(
        "documento",
        "Informe o CPF ou o CNPJ de quem paga a assinatura, como 123.456.789-09.",
      );
    }
    const cep = normalizarCep(lerTexto(formData.get("cep")), "cep");
    if (!cep) throw new ErroDeCampo("cep", "Informe o CEP de quem paga, como 14781-160.");

    const db = dbAdministrativo();

    if (await nomeEmUso(db, escritorio)) throw erroNomeEmUso("escritorio", escritorio);
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
        plano: plano.codigo,
        assinatura: "AGUARDANDO_PAGAMENTO",
        cobrancaDocumento: somenteDigitos(documento),
        cobrancaCep: somenteDigitos(cep),
        usuarios: {
          create: { nome, email, senhaHash: await gerarHashSenha(senha) },
        },
      },
      select: { id: true, usuarios: { select: { id: true } } },
    });

    // A sessão vem antes do pagamento: se o Asaas falhar, a conta já existe e
    // a pessoa retoma de `/assinatura` sem cadastrar de novo.
    await criarSessao(organizacao.usuarios[0].id);

    pagamento = await abrirPagamentoOu(PAGAMENTO_INDISPONIVEL, {
      id: organizacao.id,
      plano: plano.codigo,
      nome,
      email,
      documento: somenteDigitos(documento),
      cep: somenteDigitos(cep),
    });
  } catch (erro) {
    // Outro cadastro levou o nome entre a conferência e a gravação.
    if (ehConflitoDeNome(erro)) {
      const escritorio = normalizarNomeEscritorio(lerTexto(formData.get("escritorio")));
      return falhou(erroNomeEmUso("escritorio", escritorio), formData);
    }
    return falhou(erro, formData);
  }

  // Fora do `try`: o `redirect` lança de propósito, e o `catch` o engoliria.
  redirect(pagamento);
}

/**
 * Abre outro checkout para o escritório da sessão — o anterior venceu, foi
 * fechado, ou a assinatura atrasou ou foi cancelada.
 *
 * Usa `sessaoAtual` e não `escopoAtual`: este é justamente o caminho de quem
 * ainda não tem a assinatura em dia.
 */
export async function reabrirPagamento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let pagamento: string;

  try {
    const sessao = await sessaoAtual();
    if (!sessao) {
      throw new ErroParaUsuario("Sua sessão expirou. Entre de novo para concluir o pagamento.");
    }
    if (sessao.papel !== "ADMIN") {
      throw new ErroParaUsuario(
        "Quem paga a assinatura é o administrador do escritório. Peça a essa pessoa para entrar e " +
          "concluir o pagamento.",
      );
    }
    if (sessao.assinatura === "ATIVA") {
      throw new ErroParaUsuario("A assinatura já está em dia. Use “Ir para o sistema”.");
    }

    const organizacao = await dbAdministrativo().organizacao.findUniqueOrThrow({
      where: { id: sessao.organizacaoId },
      select: { plano: true, cobrancaDocumento: true, cobrancaCep: true },
    });

    if (!organizacao.cobrancaDocumento || !organizacao.cobrancaCep) {
      throw new ErroParaUsuario(
        "Faltam o CPF/CNPJ e o CEP de quem paga neste escritório. Fale com o suporte para concluir.",
      );
    }

    pagamento = await abrirPagamentoOu(
      "Não conseguimos abrir a página de pagamento agora. Tente de novo em alguns minutos.",
      {
        id: sessao.organizacaoId,
        plano: organizacao.plano,
        nome: sessao.nome,
        email: sessao.email,
        documento: organizacao.cobrancaDocumento,
        cep: organizacao.cobrancaCep,
      },
    );
  } catch (erro) {
    return falhou(erro, formData);
  }

  redirect(pagamento);
}
