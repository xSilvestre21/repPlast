"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { criarCheckout, ErroAsaas, pagamentoConfigurado } from "@/lib/asaas";
import { dbAdministrativo } from "@/lib/db";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { mascararTelefone, normalizarCep, somenteDigitos } from "@/lib/mascara";
import { planoDaUrl, type CodigoPlano } from "@/lib/planos";
import { conferirSenha, gerarHashSenha } from "@/lib/senha";
import { conferirSenhaNova } from "@/lib/senha-nova";
import { normalizarNomeEscritorio, problemaNoNomeEscritorio } from "@/lib/escritorio-regras";
import { ehConflitoDeNome, erroNomeEmUso, nomeEmUso } from "@/lib/nome-escritorio";
import { consultarCep } from "@/lib/cep";
import { dominioRecebeEmail } from "@/lib/dominio-email";
import { documentoSemPontuacao, problemaNoDocumento } from "@/lib/documento";
import { enviarDoSistema, urlDoSistema } from "@/lib/email-sistema";
import { problemaNoEmail } from "@/lib/email-valido";
import { VERSAO_TERMOS } from "@/lib/lgpd";
import { montarEmailSistema } from "@/lib/email-sistema-html";
import { minutosAte, minutosPorExtenso } from "@/lib/limite-tentativas";
import {
  bloqueioDosPedidos,
  criarRedefinicao,
  LINK_VENCIDO,
  redefinirPeloLink,
  VALIDADE_MIN,
} from "@/lib/redefinicao-senha";
import { criarSessao, encerrarSessao, inicioDa, sessaoAtual } from "@/lib/sessao";
import { LINK_TROCA_VENCIDO, trocarPeloLink } from "@/lib/troca-email";
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
 * O campo do formulário de cadastro para cada campo que o checkout do Asaas
 * recusa, com o que fazer. O Asaas diz só "O campo name é inválido."
 */
const CAMPOS_DO_ASAAS: Record<string, [campo: string, frase: string]> = {
  name: ["nome", "O pagamento não aceitou este nome. Escreva nome e sobrenome, só com letras."],
  email: ["email", "O pagamento não aceitou este e-mail. Confira se está certo."],
  cpfCnpj: ["documento", "O pagamento não aceitou este CPF/CNPJ. Confira os números."],
  phone: ["telefone", "O pagamento não aceitou este celular. Confira o DDD e o número."],
  phoneNumber: ["telefone", "O pagamento não aceitou este celular. Confira o DDD e o número."],
  mobilePhone: ["telefone", "O pagamento não aceitou este celular. Confira o DDD e o número."],
  postalCode: ["cep", "O pagamento não aceitou este CEP. Confira os números."],
  address: ["endereco", "O pagamento não aceitou este endereço. Confira a rua."],
  addressNumber: ["numero", "O pagamento não aceitou este número. Sem número? Escreva S/N."],
  province: ["bairro", "O pagamento não aceitou este bairro. Confira o nome."],
  complement: ["complemento", "O pagamento não aceitou este complemento. Encurte ou deixe vazio."],
};

/**
 * A recusa do Asaas no cadastro, já em português: embaixo do campo que ele
 * apontou, ou geral quando ele está fora do ar. Nada foi gravado ainda.
 */
function recusaDoAsaas(erro: ErroAsaas): Error {
  console.error(`[asaas] checkout do cadastro não abriu: ${erro.message} ${erro.campos.join(", ")}`);
  const conhecido = erro.campos.map((campo) => CAMPOS_DO_ASAAS[campo]).find(Boolean);
  if (conhecido) return new ErroDeCampo(conhecido[0], conhecido[1]);
  return new ErroParaUsuario(
    "Não conseguimos abrir a página de pagamento agora, e por isso o escritório ainda não foi " +
      "criado. Tente de novo em alguns minutos.",
  );
}

function lerTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Guardamos em minúsculas para que o login não dependa de como foi digitado. */
function lerEmail(valor: FormDataEntryValue | null): string {
  return lerTexto(valor).toLowerCase();
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
  let destino: string;

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
      select: {
        id: true,
        senhaHash: true,
        senhaProvisoria: true,
        organizacao: { select: { ativa: true, assinatura: true } },
      },
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
    destino = inicioDa(usuario.organizacao);
    // Entrou com a senha inicial que o administrador criou: antes do sistema,
    // a sugestão de criar uma só dele (com "Agora não" — é sugestão).
    if (destino === "/" && usuario.senhaProvisoria) destino = "/senha?primeiro-acesso=1";
  } catch (erro) {
    return falhou(erro, formData);
  }

  redirect(destino);
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
    conferirSenhaNova(senha, lerTexto(formData.get("confirmacao")));

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

/**
 * Confirma a troca do e-mail de login, pelo link mandado ao endereço novo.
 *
 * É um botão, e não a simples abertura do link: antivírus de e-mail abrem os
 * links para inspecionar, e uma página que trocasse ao abrir gastaria o token
 * antes da pessoa. O `token` chega preso pelo `.bind` da página; quem confere
 * é `trocarPeloLink`.
 *
 * Quem confirma no mesmo navegador em que está logado continua dentro (a
 * versão da sessão subiu, então o cookie é refeito); em outro aparelho, entra
 * de novo já com o e-mail novo. O endereço antigo recebe o aviso — se não foi
 * a pessoa, é por ele que ela fica sabendo.
 */
export async function confirmarTrocaEmail(
  token: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const logado = await sessaoAtual();
    const troca = await trocarPeloLink(String(token));
    if (!troca.ok) {
      throw new ErroParaUsuario(
        troca.motivo === "em-uso"
          ? "Outra conta passou a usar este e-mail, e por isso a troca não foi feita. Entre com o " +
              "e-mail de antes e peça a troca para outro endereço."
          : LINK_TROCA_VENCIDO,
      );
    }

    // Senhas erradas digitadas com o e-mail novo não contam contra a conta que acaba de recebê-lo.
    await limparFalhas(troca.emailNovo);

    after(() =>
      enviarDoSistema({
        para: troca.emailAntigo,
        assunto: "O e-mail de login do RepPlast foi trocado",
        ...montarEmailSistema({
          nome: troca.nome,
          paragrafos: [
            `A sua conta no RepPlast agora entra com ${troca.emailNovo}, e não mais com este ` +
              "endereço. Os aparelhos que estavam conectados precisam entrar de novo.",
          ],
          notas: [
            "Se foi você, está tudo certo. Se não foi, fale com o suporte agora — e avise o " +
              "administrador do escritório.",
          ],
        }),
      }),
    );

    if (logado?.usuarioId === troca.usuarioId) {
      await criarSessao(troca.usuarioId);
      destino = "/configuracoes?email=trocado#perfil";
    } else {
      destino = "/entrar?email=trocado";
    }
  } catch (erro) {
    return falhou(erro);
  }

  redirect(destino);
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
  telefone?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
}): Promise<string> {
  const checkout = await criarCheckout(organizacao.plano, {
    nome: organizacao.nome,
    email: organizacao.email,
    cpfCnpj: organizacao.documento,
    cep: organizacao.cep,
    telefone: organizacao.telefone,
    endereco: organizacao.endereco,
    numero: organizacao.numero,
    complemento: organizacao.complemento,
    bairro: organizacao.bairro,
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
    if (erro instanceof ErroAsaas) {
      // A tela recebe a frase em português; o motivo de verdade fica no log.
      console.error(`[asaas] checkout não abriu: ${erro.message}`);
      throw new ErroParaUsuario(frase);
    }
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
    // O checkout do Asaas recusa nome sem sobrenome ("O campo name é inválido").
    const [primeiroNome, ...restoDoNome] = nome.split(/\s+/);
    if (restoDoNome.length === 0) {
      throw new ErroDeCampo(
        "nome",
        "Informe também o sobrenome, como João da Silva — o pagamento pede o nome completo.",
      );
    }
    if (!email) throw new ErroDeCampo("email", "Informe o seu e-mail — é com ele que você vai entrar.");
    const problemaNoFormato = problemaNoEmail(email);
    if (problemaNoFormato) throw new ErroDeCampo("email", problemaNoFormato);

    // O checkout do Asaas recusa sem telefone. Com DDD, e o DDD não começa em 0.
    const telefone = somenteDigitos(lerTexto(formData.get("telefone")));
    if (!/^[1-9]\d{9,10}$/.test(telefone)) {
      throw new ErroDeCampo(
        "telefone",
        telefone === ""
          ? "Informe um celular com DDD, como (11) 91234-5678."
          : "Este telefone não está completo. Digite o DDD e o número, como (11) 91234-5678.",
      );
    }

    conferirSenhaNova(senha, lerTexto(formData.get("confirmacao")));

    // O checkout do Asaas exige documento e CEP; aqui são obrigatórios e
    // conferidos de verdade, ao contrário do cadastro de cliente, onde vazio
    // quer dizer "não sei" e os números importados do SICOV nunca foram checados.
    const documento = documentoSemPontuacao(lerTexto(formData.get("documento")));
    const problemaNoDoc = problemaNoDocumento(documento);
    if (problemaNoDoc) throw new ErroDeCampo("documento", problemaNoDoc);

    const cep = normalizarCep(lerTexto(formData.get("cep")), "cep");
    if (!cep) throw new ErroDeCampo("cep", "Informe o CEP de quem paga, como 12345-678.");

    const endereco = lerTexto(formData.get("endereco"));
    if (!endereco) {
      throw new ErroDeCampo(
        "endereco",
        "Informe a rua de quem paga. O CEP costuma preencher sozinho — confira se ele está certo.",
      );
    }
    const numero = lerTexto(formData.get("numero"));
    if (!numero) throw new ErroDeCampo("numero", "Informe o número. Sem número? Escreva S/N.");
    const bairro = lerTexto(formData.get("bairro"));
    if (!bairro) throw new ErroDeCampo("bairro", "Informe o bairro de quem paga, como Centro.");
    // Opcional: vazio vira nulo, não texto em branco.
    const complemento = lerTexto(formData.get("complemento")).slice(0, 60) || undefined;

    if (formData.get("termos") !== "aceito") {
      throw new ErroDeCampo(
        "termos",
        "Para criar o escritório, leia e marque o aceite dos Termos de Uso e da Política de Privacidade.",
      );
    }

    // Por último, as duas que dependem de rede — e deixam passar se a rede
    // não responder (ver `consultarCep` e `dominioRecebeEmail`).
    const [cepExiste, emailRecebe] = await Promise.all([
      consultarCep(somenteDigitos(cep)),
      dominioRecebeEmail(email.split("@")[1]),
    ]);
    if (!emailRecebe) {
      throw new ErroDeCampo(
        "email",
        `O endereço “${email.split("@")[1]}” não recebe e-mails. Confira o que vem depois do @, como voce@escritorio.com.br.`,
      );
    }
    if (cepExiste === "inexistente") {
      throw new ErroDeCampo("cep", "Este CEP não existe. Confira os números, como 12345-678.");
    }

    // Antes de gravar qualquer coisa: conta criada sem como pagar fica presa
    // em "aguardando pagamento", e a próxima tentativa já esbarra no e-mail.
    if (!pagamentoConfigurado()) {
      throw new ErroParaUsuario(
        "O pagamento está fora do ar no momento, e por isso o escritório ainda não foi criado. " +
          "Tente de novo mais tarde — se continuar, fale com o suporte.",
      );
    }

    const db = dbAdministrativo();

    if (await nomeEmUso(db, escritorio)) throw erroNomeEmUso("escritorio", escritorio);
    if (await db.usuario.findUnique({ where: { email }, select: { id: true } })) {
      throw new ErroDeCampo(
        "email",
        "Já existe uma conta com este e-mail. Se ela é sua, use “Entrar” em vez de criar outra.",
      );
    }

    /*
     * O checkout ANTES da conta. Era depois, e quando o Asaas recusava um dado
     * (nome sem sobrenome, telefone) a conta já existia, presa em "aguardando
     * pagamento" com o dado errado e sem tela para corrigir. Assim, a recusa
     * volta para o formulário e nada é gravado; se a gravação é que falhar, o
     * checkout aberto à toa só vence em uma hora.
     */
    let checkout: { id: string; url: string };
    try {
      checkout = await criarCheckout(plano.codigo, {
        nome,
        email,
        cpfCnpj: documento,
        cep: somenteDigitos(cep),
        telefone,
        endereco,
        numero,
        complemento,
        bairro,
      });
    } catch (erro) {
      if (erro instanceof ErroAsaas) throw recusaDoAsaas(erro);
      throw erro;
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
        asaasCheckoutId: checkout.id,
        cobrancaDocumento: documento,
        cobrancaCep: somenteDigitos(cep),
        cobrancaEndereco: endereco,
        cobrancaNumero: numero,
        cobrancaComplemento: complemento,
        cobrancaBairro: bairro,
        usuarios: {
          create: {
            nome: primeiroNome,
            sobrenome: restoDoNome.join(" "),
            email,
            telefone: mascararTelefone(telefone),
            senhaHash: await gerarHashSenha(senha),
            termosAceitosEm: new Date(),
            termosVersao: VERSAO_TERMOS,
          },
        },
      },
      select: { id: true, usuarios: { select: { id: true } } },
    });

    // Logada antes de ir pagar: quem fechar o checkout sem pagar retoma de
    // `/assinatura` sem cadastrar de novo.
    await criarSessao(organizacao.usuarios[0].id);
    pagamento = checkout.url;
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
      select: {
        plano: true,
        cobrancaDocumento: true,
        cobrancaCep: true,
        cobrancaEndereco: true,
        cobrancaNumero: true,
        cobrancaComplemento: true,
        cobrancaBairro: true,
      },
    });
    const pagador = await dbAdministrativo().usuario.findUniqueOrThrow({
      where: { id: sessao.usuarioId },
      select: { telefone: true },
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
        endereco: organizacao.cobrancaEndereco ?? undefined,
        numero: organizacao.cobrancaNumero ?? undefined,
        complemento: organizacao.cobrancaComplemento ?? undefined,
        bairro: organizacao.cobrancaBairro ?? undefined,
        telefone: pagador.telefone ? somenteDigitos(pagador.telefone) : undefined,
      },
    );
  } catch (erro) {
    return falhou(erro, formData);
  }

  redirect(pagamento);
}
