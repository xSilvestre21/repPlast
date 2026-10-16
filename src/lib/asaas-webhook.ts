/**
 * O que cada evento do Asaas faz com a assinatura do escritório.
 *
 * Mora fora da rota para poder ser testado contra o banco sem subir servidor
 * (`asaas-webhook.itest.ts`).
 *
 * Como os eventos se ligam ao escritório:
 *
 *   - `CHECKOUT_PAID` traz o id do checkout, que o cadastro gravou. É o
 *     primeiro elo, e o único que existe antes do pagamento.
 *   - Ele NÃO diz qual assinatura o checkout criou, e na prática chega até
 *     sem o cliente (`customer: null`). Quem fecha o elo é o
 *     `SUBSCRIPTION_CREATED`: a assinatura traz o checkout que a criou
 *     (`checkoutSession`), e por ele se acha o escritório. O caminho pelo
 *     cliente fica de reserva.
 *   - Os eventos de cobrança (`PAYMENT_*`) trazem a assinatura e o cliente.
 */

import "server-only";

import { timingSafeEqual } from "node:crypto";

import { assinaturaDoCliente } from "./asaas";
import { dbAdministrativo } from "./db";

type Situacao = "AGUARDANDO_PAGAMENTO" | "ATIVA" | "ATRASADA" | "CANCELADA";

interface EventoAsaas {
  id?: string;
  event?: string;
  checkout?: { id?: string; customer?: string | null };
  subscription?: { id?: string; customer?: string; checkoutSession?: string | null };
  payment?: { subscription?: string | null; customer?: string };
}

/** Comparação em tempo constante, como a assinatura da sessão. */
export function tokenDoWebhookConfere(recebido: string | null): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!esperado || !recebido) return false;

  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O que a cobrança diz sobre a situação. `null`: o evento não muda nada. */
function situacaoDoEvento(tipo: string): Situacao | null {
  switch (tipo) {
    case "CHECKOUT_PAID":
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return "ATIVA";
    case "PAYMENT_OVERDUE":
      return "ATRASADA";
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      return "CANCELADA";
    default:
      // CHECKOUT_EXPIRED/CANCELED: o escritório segue esperando o pagamento,
      // e `/assinatura` abre outro checkout.
      return null;
  }
}

/**
 * Processa um evento, uma vez só.
 *
 * A entrega é "pelo menos uma vez": o id do evento é gravado antes da
 * mudança, e uma repetição — ou duas entregas simultâneas — esbarra na chave
 * primária e não aplica nada de novo.
 */
export async function processarEventoAsaas(corpo: unknown): Promise<void> {
  const evento = (corpo ?? {}) as EventoAsaas;
  if (!evento.id || !evento.event) return;

  const db = dbAdministrativo();

  if (await db.eventoAsaas.findUnique({ where: { id: evento.id }, select: { id: true } })) return;

  const situacao = situacaoDoEvento(evento.event);
  const dados: {
    assinatura?: Situacao;
    asaasClienteId?: string;
    asaasAssinaturaId?: string;
  } = {};
  if (situacao) dados.assinatura = situacao;

  let onde: { asaasCheckoutId: string } | { asaasAssinaturaId: string } | { asaasClienteId: string } | null =
    null;

  if (evento.event === "CHECKOUT_PAID" && evento.checkout?.id) {
    onde = { asaasCheckoutId: evento.checkout.id };

    const cliente = evento.checkout.customer;
    if (cliente) {
      dados.asaasClienteId = cliente;
      // Consulta no Asaas é melhor-esforço: se falhar, o SUBSCRIPTION_CREATED
      // ou a primeira cobrança completam o elo.
      const assinatura = await assinaturaDoCliente(cliente).catch(() => null);
      if (assinatura) dados.asaasAssinaturaId = assinatura;
    }
  } else if (evento.event === "SUBSCRIPTION_CREATED" && evento.subscription?.checkoutSession) {
    // A assinatura do próprio checkout do cadastro: o elo mais firme que há,
    // e o único que não depende de o CHECKOUT_PAID ter trazido o cliente.
    onde = { asaasCheckoutId: evento.subscription.checkoutSession };
    if (evento.subscription.id) dados.asaasAssinaturaId = evento.subscription.id;
    if (evento.subscription.customer) dados.asaasClienteId = evento.subscription.customer;
  } else if (evento.event === "SUBSCRIPTION_CREATED" && evento.subscription?.customer) {
    onde = { asaasClienteId: evento.subscription.customer };
    if (evento.subscription.id) dados.asaasAssinaturaId = evento.subscription.id;
  } else if (evento.subscription?.id) {
    onde = { asaasAssinaturaId: evento.subscription.id };
  } else if (evento.payment?.subscription) {
    onde = { asaasAssinaturaId: evento.payment.subscription };
  }

  // Assinatura que ainda não está gravada (o evento chegou antes do elo):
  // tenta pelo cliente, e aproveita para gravar a assinatura.
  if (onde && "asaasAssinaturaId" in onde) {
    const existe = await db.organizacao.findUnique({ where: onde, select: { id: true } });
    const cliente = evento.payment?.customer ?? evento.subscription?.customer;
    if (!existe && cliente) {
      dados.asaasAssinaturaId = onde.asaasAssinaturaId;
      onde = { asaasClienteId: cliente };
    }
  }

  // O registro do evento é a trava: a chave primária faz a segunda entrega —
  // mesmo simultânea — falhar aqui, antes de mexer no escritório.
  try {
    await db.eventoAsaas.create({ data: { id: evento.id, tipo: evento.event } });
  } catch (erro) {
    if ((erro as { code?: string }).code === "P2002") return;
    throw erro;
  }

  try {
    if (!onde || Object.keys(dados).length === 0) return;

    // O escritório pode não existir (evento de outro produto na mesma conta
    // Asaas), e isso não é erro.
    const alvo = await db.organizacao.findFirst({
      where: onde,
      select: { id: true, asaasAssinaturaId: true },
    });
    if (!alvo) return;

    // Assinatura já gravada não é trocada por um evento de cliente — o
    // cliente pode ter mais de uma, e a do checkout pago é a que vale.
    if (alvo.asaasAssinaturaId && "asaasClienteId" in onde) delete dados.asaasAssinaturaId;

    await db.organizacao.update({ where: { id: alvo.id }, data: dados });
  } catch (erro) {
    // Falhou depois da trava: solta, para a nova tentativa do Asaas valer.
    await db.eventoAsaas.delete({ where: { id: evento.id } }).catch(() => {});
    throw erro;
  }
}
