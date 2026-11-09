/**
 * Quando a mensalidade muda no Asaas: sobe na hora, desce no ciclo seguinte.
 *
 * O Asaas gera cada cobrança 40 dias antes do vencimento, de modo que a do
 * próximo vencimento sempre já existe. Se a redução também valesse para ela,
 * bastaria inativar o preposto (ou voltar ao Solo) na véspera e reativar
 * depois de pagar: o mês inteiro usado, pago pelo valor menor.
 *
 * Por isso:
 *
 *   - Aumento (preposto além dos inclusos, Solo → Max) vai ao Asaas na hora,
 *     inclusive para a fatura em aberto, sem proporcional.
 *   - Redução (inativar, Max → Solo) não vai ao Asaas. O acesso muda na hora,
 *     mas a fatura em aberto segue com o valor de hoje; quando ela é paga, o
 *     webhook chama `acertarDepoisDoPagamento`, que leva o valor do que está
 *     ativo às faturas seguintes.
 *
 * O aumento compara com o que o Asaas cobra, e não com a conta do que estava
 * ativo: inativar dois e reativar um no mesmo ciclo não pode baixar a fatura.
 *
 * O mesmo que o GitHub faz com cadeiras: a que entra cobra já, a que sai só
 * deixa de cobrar na renovação.
 *
 * Nos 7 dias grátis (`teste-gratis.ts`) não há mês usado: a redução também vai
 * ao Asaas na hora (`reduzirNoTeste`), e a primeira cobrança sai com o que o
 * escritório tem no fim do teste.
 */

import "server-only";

import type Decimal from "decimal.js";

import { atualizarValorAssinatura, valorDaAssinatura } from "./asaas";
import { dbAdministrativo } from "./db";
import { type CodigoPlano, valorMensal } from "./planos";
import { emTesteGratis } from "./teste-gratis";

/**
 * Leva a mensalidade a `valor` quando o Asaas cobra menos que isso — e não faz
 * nada quando já cobra isso ou mais (uma redução deste ciclo ainda não
 * aplicada). Lança `ErroAsaas`; quem chama não grava nada se ele lançar.
 */
export async function subirMensalidade(assinaturaId: string, valor: Decimal, plano?: CodigoPlano): Promise<void> {
  const cobrado = await valorDaAssinatura(assinaturaId);
  if (valor.lte(cobrado)) return;

  await atualizarValorAssinatura(assinaturaId, valor, plano);
}

/**
 * Depois de uma fatura paga: as próximas passam a cobrar o que o escritório
 * tem agora — o plano e os prepostos ativos. É aqui que a redução do ciclo
 * que acabou de ser pago passa a valer.
 */
export async function acertarDepoisDoPagamento(organizacaoId: string): Promise<void> {
  const db = dbAdministrativo();
  const [organizacao, ativos] = await Promise.all([
    db.organizacao.findUnique({
      where: { id: organizacaoId },
      select: { plano: true, asaasAssinaturaId: true },
    }),
    db.usuario.count({ where: { organizacaoId, papel: "REPRESENTANTE", ativo: true } }),
  ]);
  if (!organizacao?.asaasAssinaturaId) return;

  const devido = valorMensal(organizacao.plano, ativos);
  const cobrado = await valorDaAssinatura(organizacao.asaasAssinaturaId);
  if (devido.equals(cobrado)) return;

  await atualizarValorAssinatura(organizacao.asaasAssinaturaId, devido, organizacao.plano);
}

/**
 * A redução nos 7 dias grátis: a primeira cobrança passa já a cobrar o que o
 * escritório tem agora. Fora do teste não faz nada — lá a redução espera a
 * fatura em aberto ser paga. Lança `ErroAsaas`.
 */
export async function reduzirNoTeste(organizacaoId: string): Promise<void> {
  const organizacao = await dbAdministrativo().organizacao.findUnique({
    where: { id: organizacaoId },
    select: { assinatura: true, testeAte: true },
  });
  if (!organizacao || !emTesteGratis(organizacao)) return;

  await acertarDepoisDoPagamento(organizacaoId);
}
