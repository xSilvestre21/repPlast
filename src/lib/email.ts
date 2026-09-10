/**
 * Envio de e-mail.
 *
 * Um único ponto de saída, para o resto do sistema não precisar saber qual
 * serviço está por trás — e para a falta de configuração dar uma mensagem
 * clara em vez de um erro cru do provedor.
 */

import "server-only";

import { Resend } from "resend";

export type Anexo = { nome: string; conteudo: Buffer };

export type ResultadoEnvio = { enviado: true; id: string } | { enviado: false; motivo: string };

/** Diz se o envio está configurado, para a tela não oferecer o que não funciona. */
export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE);
}

export async function enviarEmail(mensagem: {
  para: string[];
  assunto: string;
  texto: string;
  anexos?: Anexo[];
}): Promise<ResultadoEnvio> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;

  if (!chave || !remetente) {
    return {
      enviado: false,
      motivo:
        "Envio de e-mail não configurado. Defina RESEND_API_KEY e EMAIL_REMETENTE no .env — " +
        "por enquanto, baixe o PDF e envie por fora.",
    };
  }

  if (mensagem.para.length === 0) {
    return { enviado: false, motivo: "Nenhum destinatário informado." };
  }

  try {
    const resend = new Resend(chave);

    const { data, error } = await resend.emails.send({
      from: remetente,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
      attachments: mensagem.anexos?.map((anexo) => ({
        filename: anexo.nome,
        content: anexo.conteudo,
      })),
    });

    if (error) return { enviado: false, motivo: error.message };
    if (!data) return { enviado: false, motivo: "O provedor não confirmou o envio." };

    return { enviado: true, id: data.id };
  } catch (erro) {
    return {
      enviado: false,
      motivo: erro instanceof Error ? erro.message : "Falha ao enviar o e-mail.",
    };
  }
}
