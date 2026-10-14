/**
 * Cobrança da assinatura pelo Asaas.
 *
 * Um `fetch` fino em vez de SDK: são três chamadas, e o SDK oficial é PHP. O
 * pagamento acontece na página do próprio Asaas (Checkout), então o cartão
 * nunca passa por aqui — o sistema só abre o checkout e escuta o webhook
 * (`app/api/asaas/webhook/route.ts`).
 *
 * Nenhuma mensagem do Asaas chega à tela: quem chama recebe `ErroAsaas` e
 * troca por uma frase em português. O texto original vai só para o log.
 */

import "server-only";

import type Decimal from "decimal.js";

import { PLANOS, type CodigoPlano } from "./planos";

export class ErroAsaas extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
  ) {
    super(mensagem);
    this.name = "ErroAsaas";
  }
}

function configuracao() {
  const url = process.env.ASAAS_URL?.trim().replace(/\/+$/, "");
  const chave = process.env.ASAAS_API_KEY?.trim();
  const app = process.env.APP_URL?.trim().replace(/\/+$/, "");

  if (!url || !chave || !app) {
    throw new ErroAsaas(
      "ASAAS_URL, ASAAS_API_KEY ou APP_URL ausente no .env — sem elas não há como abrir o pagamento.",
    );
  }
  return { url, chave, app };
}

async function chamar<T>(caminho: string, init: { method: "GET" | "POST"; corpo?: unknown }): Promise<T> {
  const { url, chave } = configuracao();

  const resposta = await fetch(`${url}${caminho}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "RepPlast",
      access_token: chave,
    },
    body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
    cache: "no-store",
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    console.error(`[asaas] ${init.method} ${caminho} → ${resposta.status}`, corpo);
    throw new ErroAsaas(`Asaas respondeu ${resposta.status} em ${caminho}`, resposta.status);
  }

  return (await resposta.json()) as T;
}

/** "2026-10-14 00:00:00" no fuso de Brasília — o formato que o checkout pede. */
function hojeNoBrasil(): string {
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `${data} 00:00:00`;
}

export interface ClienteCobranca {
  nome: string;
  email: string;
  /** Só dígitos. */
  cpfCnpj: string;
  /** Só dígitos. */
  cep: string;
}

/**
 * Abre a página de pagamento da assinatura mensal.
 *
 * A primeira cobrança vence hoje: a pessoa paga antes de usar, e o Asaas segue
 * cobrando o cartão todo mês a partir daí. O checkout vence em 1 hora — quem
 * demorar mais pede outro em `/assinatura`.
 */
export async function criarCheckout(plano: CodigoPlano, cliente: ClienteCobranca) {
  const { app } = configuracao();
  const dados = PLANOS[plano];

  const checkout = await chamar<{ id: string; url?: string; link?: string }>("/v3/checkout", {
    method: "POST",
    corpo: {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      callback: {
        successUrl: `${app}/assinatura?status=pago`,
        cancelUrl: `${app}/assinatura`,
        expiredUrl: `${app}/assinatura`,
      },
      items: [
        {
          name: `RepPlast ${dados.nome}`,
          description: dados.publico,
          quantity: 1,
          value: dados.precoMensal.toNumber(),
        },
      ],
      customerData: {
        name: cliente.nome,
        email: cliente.email,
        cpfCnpj: cliente.cpfCnpj,
        postalCode: cliente.cep,
      },
      subscription: {
        cycle: "MONTHLY",
        nextDueDate: hojeNoBrasil(),
      },
    },
  });

  const link = checkout.url ?? checkout.link;
  if (!link) throw new ErroAsaas("O checkout voltou sem link de pagamento.");

  return { id: checkout.id, url: link };
}

/** A assinatura ativa mais recente do cliente — o checkout pago não diz qual criou. */
export async function assinaturaDoCliente(clienteId: string): Promise<string | null> {
  const lista = await chamar<{ data: { id: string; status: string; deleted?: boolean }[] }>(
    `/v3/subscriptions?customer=${encodeURIComponent(clienteId)}&status=ACTIVE`,
    { method: "GET" },
  );

  return lista.data.find((a) => !a.deleted)?.id ?? null;
}

/**
 * Troca o valor da mensalidade — preposto além dos inclusos no Max.
 *
 * `updatePendingPayments` leva o valor novo também à cobrança já gerada e
 * ainda não paga, para o mês corrente não sair com o valor velho.
 */
export async function atualizarValorAssinatura(assinaturaId: string, valor: Decimal): Promise<void> {
  await chamar(`/v3/subscriptions/${encodeURIComponent(assinaturaId)}`, {
    method: "POST",
    corpo: { value: valor.toNumber(), updatePendingPayments: true },
  });
}
