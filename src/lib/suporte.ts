/**
 * Por onde o cliente fala com o suporte — num lugar só.
 *
 * A página de Ajuda, os cartões de plano e qualquer frase de "fale com a gente"
 * leem daqui: e-mail e WhatsApp com dois donos se desencontram, e o cliente
 * escreve para o número antigo.
 *
 * O e-mail é o mesmo dos Termos e da Política de Privacidade (`lgpd.ts`).
 *
 * Módulo puro: a página usa no navegador, e os testes, em `node`.
 */

import { CONTROLADOR } from "./lgpd";

export const SUPORTE = {
  email: CONTROLADOR.email,
  /**
   * Só dígitos, com o 55 do país e o DDD: "5511912345678". Vazio enquanto o
   * número não existe — o botão do WhatsApp some (`temWhatsapp`) em vez de
   * abrir uma conversa com ninguém.
   */
  whatsapp: "",
} as const;

/** A primeira frase da conversa, para o suporte saber de onde a pessoa vem. */
export const MENSAGEM_PADRAO = "Olá! Preciso de ajuda com o RepPlast.";

export function temWhatsapp(numero: string = SUPORTE.whatsapp): boolean {
  return /^55\d{10,11}$/.test(numero);
}

/** O link que abre a conversa, no aplicativo ou no WhatsApp Web. */
export function linkWhatsapp(mensagem: string = MENSAGEM_PADRAO, numero: string = SUPORTE.whatsapp): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

/** "5511912345678" → "(11) 91234-5678": como o número é escrito para ler. */
export function whatsappEscrito(numero: string = SUPORTE.whatsapp): string {
  if (!temWhatsapp(numero)) return "";

  const ddd = numero.slice(2, 4);
  const resto = numero.slice(4);
  return `(${ddd}) ${resto.slice(0, -4)}-${resto.slice(-4)}`;
}

export function linkEmail(assunto = "Ajuda com o RepPlast"): string {
  return `mailto:${SUPORTE.email}?subject=${encodeURIComponent(assunto)}`;
}
