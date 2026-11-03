/**
 * Envio de e-mail pela caixa do próprio usuário.
 *
 * Um único ponto de saída, para o resto do sistema não precisar saber de SMTP —
 * e para os erros do servidor chegarem à tela como uma frase que diz o que
 * fazer, e não como "535-5.7.8 Username and Password not accepted".
 *
 * O pedido sai do endereço de quem o manda, que é com quem a indústria fala.
 * No Gmail, o enviado ainda aparece na pasta Enviados da pessoa, como se ela
 * tivesse mandado de lá. A única exceção é o que não tem dono — o link de
 * "Esqueceu sua senha?" —, que sai do remetente do RepPlast (`email-sistema.ts`),
 * pelo mesmo `enviarEmail` daqui.
 */

import "server-only";

import { lookup } from "node:dns/promises";

import nodemailer from "nodemailer";

import { enderecoInterno } from "./endereco-interno";

/**
 * Com `cid`, o anexo é uma imagem do próprio corpo HTML (`<img src="cid:…">`):
 * chega junto com a mensagem, sem depender de site no ar nem de a pessoa
 * clicar em "mostrar imagens".
 */
export type Anexo = { nome: string; conteudo: Buffer; tipo?: string; cid?: string };

/** Uma caixa pronta para usar: a senha já decifrada. Nunca sai do servidor. */
export type ContaSmtp = {
  email: string;
  nomeExibicao: string;
  host: string;
  porta: number;
  tlsDireto: boolean;
  usuarioSmtp: string;
  senha: string;
};

export type ResultadoEnvio =
  | { enviado: true; id: string; recusados: string[] }
  | { enviado: false; motivo: string };

/** Servidor na própria máquina — o SMTP de teste do desenvolvimento. */
function ehLocal(host: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host.toLowerCase());
}

/** As portas de envio de e-mail. Outra porta não é SMTP — é alguém sondando. */
const PORTAS_SMTP = [25, 465, 587, 2525];

/**
 * Por que o sistema não conecta a esta caixa — ou `null`, se pode.
 *
 * Em produção, o servidor de e-mail tem de estar na internet: o host e a porta
 * vêm do formulário das Configurações, e sem esta conferência o "Testar"
 * viraria um jeito de sondar a rede interna do servidor (o banco, os metadados
 * da nuvem), porta por porta, pela frase de erro que volta. No
 * desenvolvimento, o SMTP de teste na própria máquina continua valendo.
 *
 * O nome é resolvido aqui e de novo pelo nodemailer: um DNS que mude de
 * resposta entre as duas passaria. É a fresta que sobra, estreita — e o
 * firewall da instância também não deixa sair para a rede interna.
 */
async function destinoRecusado(
  conta: Pick<ContaSmtp, "host" | "porta">,
): Promise<{ motivo: string; campo: "host" | "porta" } | null> {
  if (process.env.NODE_ENV !== "production") return null;

  if (!PORTAS_SMTP.includes(conta.porta)) {
    return {
      campo: "porta",
      motivo:
        `A porta ${conta.porta} não é de envio de e-mail. Use a que o seu provedor indica — quase sempre ` +
        "587 (STARTTLS) ou 465 (SSL).",
    };
  }

  let enderecos: { address: string }[];
  try {
    enderecos = await lookup(conta.host, { all: true });
  } catch {
    // Não resolveu: o nodemailer dá o erro de conexão de sempre (EDNS).
    return null;
  }
  if (enderecos.some(({ address }) => enderecoInterno(address))) {
    return {
      campo: "host",
      motivo:
        `O servidor “${conta.host}” aponta para um endereço interno, que o sistema não usa para mandar e-mail. ` +
        "Confira o servidor de envio da sua conta — como smtp.gmail.com.",
    };
  }
  return null;
}

function transporte(conta: ContaSmtp) {
  return nodemailer.createTransport({
    host: conta.host,
    port: conta.porta,
    secure: conta.tlsDireto,
    // STARTTLS obrigatório na 587: sem isto, um servidor que não oferecesse TLS
    // receberia a senha em texto puro. A exceção é o servidor local de teste
    // (maildev), que não tem TLS — ali a senha não sai da máquina.
    requireTLS: !conta.tlsDireto && !ehLocal(conta.host),
    auth: { user: conta.usuarioSmtp, pass: conta.senha },
    // Os padrões esperam minutos. Quem clicou em "Enviar" não espera tanto, e
    // um servidor errado precisa virar mensagem enquanto a pessoa ainda olha.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    // Folga maior aqui: é durante o socket que os 20 MB de anexo sobem.
    socketTimeout: 120_000,
  });
}

/**
 * O erro do servidor, em português e com o próximo passo.
 *
 * Exportado para ser testado: é a parte que a pessoa lê quando dá errado.
 */
export function explicarErro(erro: unknown, conta: Pick<ContaSmtp, "host" | "porta">): string {
  const codigo =
    typeof erro === "object" && erro && "code" in erro ? String((erro as { code: unknown }).code) : "";
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  const gmail = conta.host.includes("gmail");

  switch (codigo) {
    case "EAUTH":
      return gmail
        ? "O Gmail recusou a senha. Ele só aceita uma senha de app (16 letras), não a senha normal da conta."
        : "O servidor recusou o usuário ou a senha. Confira os dois na conta de e-mail.";
    case "ECONNECTION":
    case "ESOCKET":
    case "ETIMEDOUT":
    case "EDNS":
      return (
        `Não foi possível conectar a ${conta.host}:${conta.porta}. ` +
        "Confira o servidor, a porta e a segurança (SSL ou STARTTLS) da conta."
      );
    case "ETLS":
      return "A conexão segura falhou. Confira a segurança da conta: 465 costuma ser SSL, 587 STARTTLS.";
    /*
     * Daqui para baixo, o texto do próprio servidor vai só para o log: ele vem
     * em inglês e em jargão ("553 5.7.1 Sender address rejected"), e o que a
     * pessoa precisa é do próximo passo.
     */
    case "EENVELOPE":
      console.error(mensagem);
      return (
        "O servidor de e-mail recusou algum destinatário. Confira se os endereços estão " +
        "certos — um caractere a mais ou a menos já basta para a recusa."
      );
    case "EMESSAGE":
      console.error(mensagem);
      return (
        "O servidor de e-mail recusou a mensagem. Costuma ser anexo grande demais ou de tipo " +
        "bloqueado: tente enviar sem os anexos extras."
      );
    default:
      console.error(erro);
      return (
        "O e-mail não saiu. Tente de novo em instantes; se continuar, clique em “Testar” na " +
        "sua conta de e-mail, em Configurações, para ver o que há com ela."
      );
  }
}

/** Entra na caixa sem mandar nada. É o "Testar conexão" das configurações. */
/**
 * Qual campo da conta de e-mail o erro do servidor aponta — para a frase de
 * `explicarErro` aparecer embaixo dele, e não solta no formulário.
 */
function campoDoErro(erro: unknown): "senha" | "host" | "seguranca" | undefined {
  const codigo =
    typeof erro === "object" && erro && "code" in erro ? String((erro as { code: unknown }).code) : "";

  if (codigo === "EAUTH") return "senha";
  if (["ECONNECTION", "ESOCKET", "ETIMEDOUT", "EDNS"].includes(codigo)) return "host";
  if (codigo === "ETLS") return "seguranca";
  return undefined;
}

export async function testarConta(
  conta: ContaSmtp,
): Promise<{ ok: true } | { ok: false; motivo: string; campo?: string }> {
  const recusa = await destinoRecusado(conta);
  if (recusa) return { ok: false, ...recusa };

  try {
    await transporte(conta).verify();
    return { ok: true };
  } catch (erro) {
    return { ok: false, motivo: explicarErro(erro, conta), campo: campoDoErro(erro) };
  }
}

export async function enviarEmail(mensagem: {
  conta: ContaSmtp;
  para: string[];
  cc?: string[];
  assunto: string;
  texto: string;
  /** A versão bonita. O `texto` continua indo junto, para quem lê em texto puro. */
  html?: string;
  anexos?: Anexo[];
}): Promise<ResultadoEnvio> {
  const { conta } = mensagem;

  if (mensagem.para.length === 0) {
    return { enviado: false, motivo: "Nenhum destinatário informado." };
  }

  const recusa = await destinoRecusado(conta);
  if (recusa) return { enviado: false, motivo: recusa.motivo };

  try {
    const info = await transporte(conta).sendMail({
      from: { name: conta.nomeExibicao, address: conta.email },
      to: mensagem.para,
      cc: mensagem.cc && mensagem.cc.length > 0 ? mensagem.cc : undefined,
      subject: mensagem.assunto,
      text: mensagem.texto,
      html: mensagem.html,
      // A imagem da assinatura embutida (`data:`) vira anexo com `cid`: o logo
      // chega dentro do e-mail, e não como um texto enorme que muitos leitores
      // recusam. E o HTML colado nunca faz o servidor ler arquivo nem URL.
      attachDataUrls: true,
      disableFileAccess: true,
      disableUrlAccess: true,
      attachments: mensagem.anexos?.map((anexo) => ({
        filename: anexo.nome,
        content: anexo.conteudo,
        contentType: anexo.tipo,
        cid: anexo.cid,
      })),
    });

    // Parte dos destinatários recusada e parte aceita: o e-mail saiu, mas quem
    // ficou de fora precisa saber. Tratar como falha faria a pessoa reenviar
    // para quem já recebeu.
    const recusados = (info.rejected ?? []).map(String);
    if (recusados.length > 0 && recusados.length >= mensagem.para.length + (mensagem.cc?.length ?? 0)) {
      return { enviado: false, motivo: `O servidor recusou: ${recusados.join(", ")}.` };
    }

    return { enviado: true, id: info.messageId, recusados };
  } catch (erro) {
    return { enviado: false, motivo: explicarErro(erro, conta) };
  }
}
