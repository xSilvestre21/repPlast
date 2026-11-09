/**
 * O cancelamento da assinatura pela própria tela — o que os Termos prometem,
 * sem precisar escrever para o suporte. Dois caminhos chegam aqui:
 *
 *   - em dia, pelas Configurações: o Asaas para de cobrar na hora (a fatura do
 *     próximo vencimento, já gerada, é apagada), e o escritório continua
 *     entrando até o fim do mês já pago — `acessoAte`, o próximo vencimento;
 *   - em atraso, pela tela `/assinatura`: o Asaas apaga também a mensalidade
 *     vencida, que deixa de ser devida, e o acesso, que já estava suspenso,
 *     fica encerrado. Não há mês pago para continuar.
 *
 * Depois disso, a tela `/assinatura` oferece assinar de novo, com tudo
 * guardado.
 *
 * A ordem protege o acesso já pago: a data é gravada ANTES de remover a
 * assinatura. O Asaas avisa a remoção pelo webhook (`SUBSCRIPTION_DELETED` →
 * CANCELADA); se esse aviso chegasse antes da data, o escritório perderia na
 * hora o resto do mês. Com a data já gravada, tanto faz quem chega primeiro.
 * E a data sozinha, numa assinatura que continuou ATIVA porque o Asaas recusou
 * a remoção, não muda nada (`acesso-assinatura.ts`).
 *
 * Grava pelo cliente administrativo: o trigger `cobranca_so_administrativa`
 * não deixa o papel da aplicação mexer na situação nem no prazo.
 */

import "server-only";

import { fimDoPeriodoPago } from "./acesso-assinatura";
import { ErroAsaas, proximoVencimento, removerAssinatura } from "./asaas";
import { dbAdministrativo } from "./db";
import { ErroParaUsuario } from "./erro-formulario";
import { CONTROLADOR } from "./lgpd";
import { emTesteGratis } from "./teste-gratis";

export async function cancelarAssinaturaDoEscritorio(organizacaoId: string): Promise<void> {
  const admin = dbAdministrativo();

  const organizacao = await admin.organizacao.findUniqueOrThrow({
    where: { id: organizacaoId },
    select: { assinatura: true, asaasAssinaturaId: true, testeAte: true },
  });
  if (organizacao.assinatura === "CANCELADA") {
    throw new ErroParaUsuario("A assinatura já está cancelada. Recarregue a página para ver a situação de agora.");
  }
  if (organizacao.assinatura === "AGUARDANDO_PAGAMENTO" || !organizacao.asaasAssinaturaId) {
    throw new ErroParaUsuario(
      "Este escritório não tem assinatura em andamento, e não há o que cancelar por aqui. " +
        `Para encerrar o uso, escreva para ${CONTROLADOR.email}.`,
    );
  }

  const emDia = organizacao.assinatura === "ATIVA";
  try {
    if (emDia) {
      /*
       * Nos 7 dias grátis, o acesso vai até a primeira cobrança, que o
       * cancelamento apaga — o `testeAte`. NÃO o próximo vencimento do Asaas:
       * nesse período ele já aponta a cobrança SEGUINTE (a primeira nasce com a
       * assinatura), e daria um mês de graça a mais.
       */
      const acessoAte =
        emTesteGratis(organizacao) && organizacao.testeAte
          ? organizacao.testeAte
          : fimDoPeriodoPago(await proximoVencimento(organizacao.asaasAssinaturaId));
      await admin.organizacao.update({ where: { id: organizacaoId }, data: { acessoAte } });
    }
    await removerAssinatura(organizacao.asaasAssinaturaId);
  } catch (erro) {
    if (!(erro instanceof ErroAsaas)) throw erro;
    throw new ErroParaUsuario(
      "Não conseguimos cancelar agora, e a assinatura continua como estava. Tente de novo em alguns minutos.",
    );
  }

  await admin.organizacao.update({
    where: { id: organizacaoId },
    // Em atraso não há mês pago: nenhum prazo, nem um que tenha sobrado de antes.
    data: emDia ? { assinatura: "CANCELADA" } : { assinatura: "CANCELADA", acessoAte: null },
  });
}
