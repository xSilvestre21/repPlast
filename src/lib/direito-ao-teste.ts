/**
 * Quem ganha os 7 dias grátis (`teste-gratis.ts`): o primeiro escritório de
 * cada CPF/CNPJ. Sem isto, bastaria criar outra conta a cada semana.
 *
 * Fica fora do `acoes.ts` do cadastro para ser testado contra o banco
 * (`direito-ao-teste.itest.ts`), e usa o cliente administrativo porque a
 * pergunta atravessa escritórios — o RLS só deixaria ver o próprio.
 */

import "server-only";

import { dbAdministrativo } from "./db";

/**
 * Outro escritório com o mesmo CPF/CNPJ já passou do cadastro do cartão?
 *
 * Conta quem tem assinatura no Asaas ou já saiu de "aguardando pagamento" — em
 * teste, pagando, atrasado ou cancelado. O cadastro largado no checkout, que
 * nunca chegou a pôr o cartão, não gasta o teste de ninguém.
 */
export async function documentoJaTestou(documento: string, excetoOrganizacaoId?: string): Promise<boolean> {
  const outro = await dbAdministrativo().organizacao.findFirst({
    where: {
      cobrancaDocumento: documento,
      ...(excetoOrganizacaoId && { id: { not: excetoOrganizacaoId } }),
      OR: [{ asaasAssinaturaId: { not: null } }, { assinatura: { not: "AGUARDANDO_PAGAMENTO" } }],
    },
    select: { id: true },
  });

  return outro !== null;
}
