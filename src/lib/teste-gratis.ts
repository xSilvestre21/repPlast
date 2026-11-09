/**
 * Os 7 dias grátis.
 *
 * Quem cria o primeiro escritório de um CPF/CNPJ cadastra o cartão no checkout
 * do Asaas, e a primeira cobrança vence 7 dias depois: cadastro no dia 9, testa
 * de 9 a 15, cobrança no dia 16. Cancelou antes, o Asaas apaga a cobrança
 * agendada e nada é cobrado — e o acesso continua até o fim do teste, como o do
 * mês pago continua para quem cancela em dia (`acesso-assinatura.ts`).
 *
 * O escritório em teste é `ATIVA` com `testeAte` no futuro: não há estado novo
 * de assinatura, e a sessão, o cancelamento e o webhook servem como estão.
 *
 * Sem banco e sem `server-only`: as datas aparecem no cadastro, na faixa do
 * sistema, em Configurações e no e-mail, e precisam sair iguais de todo lugar.
 */

import { fimDoPeriodoPago, type SituacaoAssinatura } from "./acesso-assinatura";

export const DIAS_DE_TESTE = 7;

const FUSO = "America/Sao_Paulo";

/** "2026-11-09": o dia de hoje em Brasília, que é o calendário do Asaas. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** "2026-11-16": o dia da primeira cobrança de quem começa o teste agora. */
export function primeiraCobranca(agora: Date = new Date()): string {
  // Meio-dia UTC: somar dias nunca escorrega de data por causa do fuso.
  const dia = new Date(`${hojeEmBrasilia(agora)}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + DIAS_DE_TESTE);
  return dia.toISOString().slice(0, 10);
}

/** Está nos 7 dias grátis: em dia, e antes da primeira cobrança. */
export function emTesteGratis(
  organizacao: { assinatura: SituacaoAssinatura; testeAte: Date | null },
  agora: Date = new Date(),
): boolean {
  return (
    organizacao.assinatura === "ATIVA" &&
    organizacao.testeAte !== null &&
    organizacao.testeAte.getTime() > agora.getTime()
  );
}

/**
 * Quantos dias grátis faltam, contando hoje: 7 no dia do cadastro, 1 na
 * véspera da cobrança. `testeAte` é a meia-noite do dia da cobrança.
 */
export function diasDeTesteRestantes(testeAte: Date, agora: Date = new Date()): number {
  const hoje = Date.parse(`${hojeEmBrasilia(agora)}T00:00:00Z`);
  const cobranca = Date.parse(`${hojeEmBrasilia(testeAte)}T00:00:00Z`);
  return Math.max(0, Math.round((cobranca - hoje) / 86_400_000));
}

/**
 * Um dia escrito para a tela: "16/11/2026", ou "16/11" com `curto`. Recebe a
 * meia-noite de Brasília (`testeAte`) ou "AAAA-MM-DD", como o Asaas escreve.
 */
export function escreverDia(dia: Date | string, { curto = false }: { curto?: boolean } = {}): string {
  const data = typeof dia === "string" ? new Date(`${dia}T12:00:00Z`) : dia;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    ...(curto ? {} : { year: "numeric" }),
  }).format(data);
}

/** O último dia grátis — a véspera da cobrança. Mesmo formato de `escreverDia`. */
export function ultimoDiaGratis(testeAte: Date, opcoes: { curto?: boolean } = {}): string {
  return escreverDia(new Date(testeAte.getTime() - 1), opcoes);
}

/** As datas de quem começa o teste agora, como a tela do cadastro escreve: "09/11", "15/11", "16/11". */
export function datasDoTeste(agora: Date = new Date()): { hoje: string; ultimoDia: string; cobranca: string } {
  const cobranca = primeiraCobranca(agora);
  return {
    hoje: escreverDia(hojeEmBrasilia(agora), { curto: true }),
    ultimoDia: ultimoDiaGratis(fimDoPeriodoPago(cobranca), { curto: true }),
    cobranca: escreverDia(cobranca, { curto: true }),
  };
}
