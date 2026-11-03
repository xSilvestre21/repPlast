/**
 * Quem pode usar o sistema, pela situação da assinatura — a regra que a
 * sessão, o layout e as rotas de arquivo aplicam (`sessao.ts`).
 *
 * ATIVA usa. CANCELADA também usa até `acessoAte`: os Termos prometem que,
 * cancelada pela tela, "o acesso continua até o fim do mês já pago", e o
 * cancelamento grava ali o próximo vencimento. Os outros estados caem na tela
 * `/assinatura`.
 *
 * Sem banco e sem `server-only`: a regra é testada sozinha, e a tela de
 * Configurações escreve a data com `ultimoDiaDeAcesso`.
 */

export type SituacaoAssinatura = "AGUARDANDO_PAGAMENTO" | "ATIVA" | "ATRASADA" | "CANCELADA";

export function assinaturaLiberada(
  organizacao: { assinatura: SituacaoAssinatura; acessoAte: Date | null },
  agora: Date = new Date(),
): boolean {
  if (organizacao.assinatura === "ATIVA") return true;
  return (
    organizacao.assinatura === "CANCELADA" &&
    organizacao.acessoAte !== null &&
    organizacao.acessoAte.getTime() > agora.getTime()
  );
}

/**
 * O fim do período pago: a meia-noite (de Brasília) do dia do próximo
 * vencimento, que é quando o Asaas cobraria de novo. `vencimento` vem do
 * Asaas como "2026-12-03". O Brasil não tem horário de verão desde 2019, então
 * o fuso é fixo.
 */
export function fimDoPeriodoPago(vencimento: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
    throw new Error(`Vencimento do Asaas fora do formato AAAA-MM-DD: ${vencimento}`);
  }
  return new Date(`${vencimento}T00:00:00-03:00`);
}

/** "02/12/2026": o último dia em que ainda entra — a véspera do vencimento. */
export function ultimoDiaDeAcesso(acessoAte: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(acessoAte.getTime() - 1));
}
