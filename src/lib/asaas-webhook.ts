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

import { Prisma } from "@/generated/prisma/client";

import { assinaturaDoCliente } from "./asaas";
import { dbAdministrativo } from "./db";
import { acertarDepoisDoPagamento } from "./mensalidade";

/** Quanto o corpo do evento fica guardado — o bastante para investigar uma cobrança. */
const GUARDA_DO_CORPO_MS = 90 * 24 * 60 * 60 * 1000;

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

/**
 * O evento sem o que não deve ficar guardado. O cartão chega só com os 4
 * últimos dígitos e a bandeira, mas junto vem o `creditCardToken`, que cobra o
 * cartão de novo pela API: chave com "token" no nome sai, em qualquer nível.
 */
export function semSegredos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(semSegredos);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave]) => !/token/i.test(chave))
        .map(([chave, dentro]) => [chave, semSegredos(dentro)]),
    );
  }
  return valor;
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

  // O escritório pode não existir (evento de outro produto na mesma conta
  // Asaas), e isso não é erro. Achado antes da trava, para o registro do evento
  // já dizer de quem é — também o que não muda nada, como a cobrança criada.
  const alvo = onde
    ? await db.organizacao.findFirst({ where: onde, select: { id: true, asaasAssinaturaId: true } })
    : null;

  // O registro do evento é a trava: a chave primária faz a segunda entrega —
  // mesmo simultânea — falhar aqui, antes de mexer no escritório.
  try {
    await db.eventoAsaas.create({
      data: {
        id: evento.id,
        tipo: evento.event,
        corpo: semSegredos(corpo) as Prisma.InputJsonValue,
        organizacaoId: alvo?.id ?? null,
      },
    });
  } catch (erro) {
    if ((erro as { code?: string }).code === "P2002") return;
    throw erro;
  }

  // Melhor-esforço: o corpo que passou da guarda é apagado a cada evento que
  // chega. Falhar aqui não pode recusar o evento — o próximo tenta de novo.
  await db.eventoAsaas
    .updateMany({
      where: {
        recebidoEm: { lt: new Date(Date.now() - GUARDA_DO_CORPO_MS) },
        corpo: { not: Prisma.DbNull },
      },
      data: { corpo: Prisma.DbNull },
    })
    .catch((erro) => console.error("[asaas] não deu para apagar o corpo dos eventos antigos:", erro));

  try {
    if (!onde || !alvo || Object.keys(dados).length === 0) return;

    // Assinatura já gravada não é trocada por um evento de cliente — o
    // cliente pode ter mais de uma, e a do checkout pago é a que vale.
    if (alvo.asaasAssinaturaId && "asaasClienteId" in onde) delete dados.asaasAssinaturaId;

    await db.organizacao.update({ where: { id: alvo.id }, data: dados });

    /*
     * Fatura paga: a redução do ciclo (preposto inativado, volta ao Solo) passa
     * a valer nas seguintes — ver `mensalidade.ts`. Só no CONFIRMED: no cartão,
     * que é o único meio do checkout, ele chega no dia da cobrança, e o
     * RECEIVED só uns 30 dias depois, quando o dinheiro cai — perto do
     * vencimento seguinte, e baixaria a fatura que ainda vai ser cobrada.
     *
     * Melhor-esforço: se o Asaas falhar, o webhook não falha junto (o Asaas
     * suspende a fila depois de várias recusas), e a próxima fatura paga acerta.
     */
    if (evento.event === "PAYMENT_CONFIRMED") {
      await acertarDepoisDoPagamento(alvo.id).catch((erro) => {
        console.error(`[asaas] não deu para acertar a mensalidade de ${alvo.id}:`, erro);
      });
    }
  } catch (erro) {
    // Falhou depois da trava: solta, para a nova tentativa do Asaas valer.
    await db.eventoAsaas.delete({ where: { id: evento.id } }).catch(() => {});
    throw erro;
  }
}
