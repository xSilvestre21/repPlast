import "server-only";

import { enviarEmail, type ContaSmtp } from "./email";

/**
 * O remetente do PRÓPRIO RepPlast — a exceção à regra de `email.ts`, onde todo
 * e-mail sai da caixa de quem o manda.
 *
 * Existe para o que não tem dono: o link de "Esqueceu sua senha?" vai para
 * quem não consegue entrar, e por isso não tem caixa cadastrada para mandar.
 * Qualquer provedor SMTP serve (Resend, Brevo, Amazon SES, Google Workspace…);
 * no desenvolvimento, um SMTP local como o maildev mostra o e-mail sem enviá-lo.
 *
 * Variáveis: SISTEMA_SMTP_HOST, SISTEMA_SMTP_PORTA (587 se vazia; 465 liga o
 * TLS direto), SISTEMA_SMTP_USUARIO, SISTEMA_SMTP_SENHA e SISTEMA_EMAIL_REMETENTE.
 */

function contaDoSistema(): ContaSmtp | null {
  const host = process.env.SISTEMA_SMTP_HOST?.trim();
  const remetente = process.env.SISTEMA_EMAIL_REMETENTE?.trim();
  if (!host || !remetente) return null;

  const porta = Number(process.env.SISTEMA_SMTP_PORTA?.trim() || 587);
  return {
    email: remetente,
    nomeExibicao: "RepPlast",
    host,
    porta,
    tlsDireto: porta === 465,
    usuarioSmtp: process.env.SISTEMA_SMTP_USUARIO?.trim() ?? "",
    senha: process.env.SISTEMA_SMTP_SENHA ?? "",
  };
}

/**
 * Envia, ou registra no log por que não enviou. Não lança: quem chama já
 * respondeu à pessoa (o envio roda em `after`), e não há tela para mostrar
 * erro. O log é o que sobra para o suporte.
 */
export async function enviarDoSistema(mensagem: {
  para: string;
  assunto: string;
  texto: string;
}): Promise<void> {
  const conta = contaDoSistema();
  if (!conta) {
    console.error(
      "[email-sistema] SISTEMA_SMTP_HOST ou SISTEMA_EMAIL_REMETENTE ausente no .env — " +
        `o e-mail "${mensagem.assunto}" não foi enviado.`,
    );
    return;
  }

  const resultado = await enviarEmail({
    conta,
    para: [mensagem.para],
    assunto: mensagem.assunto,
    texto: mensagem.texto,
  });
  if (!resultado.enviado) {
    console.error(`[email-sistema] "${mensagem.assunto}" não saiu: ${resultado.motivo}`);
  }
}

/**
 * O endereço do sistema, para os links dos e-mails.
 *
 * Em produção, só `APP_URL`. NUNCA o cabeçalho `Host` da requisição: com ele,
 * quem pedisse a redefinição da senha de outra pessoa mandando um `Host` falso
 * faria o e-mail dela trazer um link para o site do atacante — com o token
 * dentro. No desenvolvimento, sem `APP_URL`, vale o servidor local.
 */
export function urlDoSistema(): string {
  const app = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (app) return app;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL ausente no .env — sem ela os e-mails não têm para onde apontar.");
  }
  return "http://localhost:3000";
}
