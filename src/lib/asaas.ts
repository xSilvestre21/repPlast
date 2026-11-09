/**
 * Cobrança da assinatura pelo Asaas.
 *
 * Um `fetch` fino em vez de SDK: são poucas chamadas, e o SDK oficial é PHP. O
 * pagamento acontece na página do próprio Asaas (Checkout), então o cartão
 * nunca passa por aqui — o sistema só abre o checkout e escuta o webhook
 * (`app/api/asaas/webhook/route.ts`).
 *
 * Nenhuma mensagem do Asaas chega à tela: quem chama recebe `ErroAsaas` e
 * troca por uma frase em português. O texto original vai só para o log.
 */

import "server-only";

import Decimal from "decimal.js";

import { PLANOS, type CodigoPlano } from "./planos";
import { DIAS_DE_TESTE, escreverDia, hojeEmBrasilia } from "./teste-gratis";

export class ErroAsaas extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
    /**
     * Os campos que o Asaas recusou ("name", "phone"…), tirados de "O campo
     * name é inválido." — é o que deixa quem chama pôr a frase embaixo do
     * campo certo do formulário.
     */
    readonly campos: string[] = [],
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
  // O checkout recusa "localhost" nas URLs de volta ("O campo successUrl é
  // inválido"); 127.0.0.1 passa. Dito aqui, o log aponta o conserto.
  if (new URL(app).hostname === "localhost") {
    throw new ErroAsaas(
      'APP_URL usa "localhost", que o Asaas recusa nas URLs de volta. No desenvolvimento, use ' +
        'APP_URL="http://127.0.0.1:3000" e abra o sistema por esse endereço.',
    );
  }
  return { url, chave, app };
}

/**
 * As variáveis do Asaas estão no `.env`? O cadastro pergunta ANTES de criar a
 * conta: sem isto, cada tentativa num servidor sem configuração deixava um
 * escritório "aguardando pagamento" que nunca teria como pagar.
 */
export function pagamentoConfigurado(): boolean {
  try {
    configuracao();
    return true;
  } catch (erro) {
    console.error(`[asaas] ${(erro as Error).message}`);
    return false;
  }
}

async function chamar<T>(caminho: string, init: { method: "GET" | "POST" | "DELETE"; corpo?: unknown }): Promise<T> {
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
    const campos = [...corpo.matchAll(/O campo (\w+)/g)].map((m) => m[1]);
    throw new ErroAsaas(`Asaas respondeu ${resposta.status} em ${caminho}`, resposta.status, campos);
  }

  return (await resposta.json()) as T;
}

export interface ClienteCobranca {
  nome: string;
  email: string;
  /** Sem pontuação; o CNPJ alfanumérico tem letras. */
  cpfCnpj: string;
  /** Só dígitos. */
  cep: string;
  /** Só dígitos, com DDD. O checkout recusa sem telefone. */
  telefone?: string;
  /** "Rua Alfa". Ausentes nos escritórios de antes de o cadastro pedir. */
  endereco?: string;
  numero?: string;
  complemento?: string;
  /** O checkout recusa sem bairro (`province`). */
  bairro?: string;
}

/**
 * Abre a página de pagamento da assinatura mensal.
 *
 * Sem teste, a primeira cobrança vence hoje: a pessoa paga antes de usar. Com
 * os 7 dias grátis (`lib/teste-gratis.ts`), vence em `primeiraCobranca`: o
 * cartão é cadastrado e validado agora, e nada é cobrado até lá — a própria
 * página do Asaas diz isso, no item. Daí em diante o Asaas cobra o cartão todo
 * mês. O checkout vence em 1 hora — quem demorar mais pede outro em `/assinatura`.
 */
export async function criarCheckout(
  plano: CodigoPlano,
  cliente: ClienteCobranca,
  /** A mensalidade, quando não é a do plano puro: o Max com prepostos além dos inclusos. */
  valor: Decimal = PLANOS[plano].precoMensal,
  /** "2026-11-16": com os 7 dias grátis, o dia da primeira cobrança. Ausente, é hoje. */
  primeiraCobranca?: string,
) {
  const { app } = configuracao();
  const dados = PLANOS[plano];
  const item = primeiraCobranca
    ? {
        name: `RepPlast ${dados.nome} — ${DIAS_DE_TESTE} dias grátis`,
        description:
          `Nada é cobrado hoje. A primeira mensalidade é em ${escreverDia(primeiraCobranca)}; ` +
          "cancele antes e não paga nada.",
      }
    : { name: `RepPlast ${dados.nome}`, description: dados.publico };

  // `/v3/checkouts`, no plural: o singular de antes passou a responder 404.
  const checkout = await chamar<{ id: string; url?: string; link?: string }>("/v3/checkouts", {
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
          ...item,
          quantity: 1,
          value: valor.toNumber(),
        },
      ],
      customerData: {
        name: cliente.nome,
        email: cliente.email,
        cpfCnpj: cliente.cpfCnpj,
        phone: cliente.telefone,
        postalCode: cliente.cep,
        address: cliente.endereco,
        addressNumber: cliente.numero,
        complement: cliente.complemento,
        province: cliente.bairro,
      },
      subscription: {
        cycle: "MONTHLY",
        // "2026-10-14 00:00:00", no calendário de Brasília — o formato que o checkout pede.
        nextDueDate: `${primeiraCobranca ?? hojeEmBrasilia()} 00:00:00`,
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

/** O valor que a assinatura cobra hoje — o que vai nas próximas faturas. */
export async function valorDaAssinatura(assinaturaId: string): Promise<Decimal> {
  const assinatura = await chamar<{ value: number }>(`/v3/subscriptions/${encodeURIComponent(assinaturaId)}`, {
    method: "GET",
  });

  return new Decimal(assinatura.value);
}

/**
 * Troca o valor da mensalidade. Quem decide quando subir e quando descer é
 * `mensalidade.ts`; aqui é só a chamada. O `plano` vai junto quando o plano
 * mudou, para a fatura dizer "RepPlast Max" e não o nome do plano de antes.
 *
 * `updatePendingPayments` leva o valor novo também às cobranças já geradas e
 * ainda não pagas — e o Asaas gera cada cobrança 40 dias antes do vencimento,
 * então a do próximo vencimento sempre já existe.
 */
export async function atualizarValorAssinatura(
  assinaturaId: string,
  valor: Decimal,
  plano?: CodigoPlano,
): Promise<void> {
  await chamar(`/v3/subscriptions/${encodeURIComponent(assinaturaId)}`, {
    method: "POST",
    corpo: {
      value: valor.toNumber(),
      updatePendingPayments: true,
      ...(plano && { description: `RepPlast ${PLANOS[plano].nome}` }),
    },
  });
}

/** O próximo vencimento da assinatura, como o Asaas escreve: "2026-12-03". */
export async function proximoVencimento(assinaturaId: string): Promise<string> {
  const assinatura = await chamar<{ nextDueDate: string }>(`/v3/subscriptions/${encodeURIComponent(assinaturaId)}`, {
    method: "GET",
  });

  return assinatura.nextDueDate;
}

/**
 * Remove a assinatura: o Asaas para de gerar cobranças e apaga as pendentes e
 * as em atraso — inclusive a do próximo vencimento, já gerada (ele gera 40 dias
 * antes). As pagas ficam. Não tem volta: assinar de novo é outro checkout.
 */
export async function removerAssinatura(assinaturaId: string): Promise<void> {
  await chamar(`/v3/subscriptions/${encodeURIComponent(assinaturaId)}`, { method: "DELETE" });
}

/**
 * A página de pagamento da mensalidade em atraso mais antiga, ou `null` se não
 * há nenhuma. É a fatura do próprio Asaas (`invoiceUrl`), onde dá para pagar
 * com outro cartão — e paga, ela libera o escritório pela assinatura que ele já
 * tem, sem criar outra.
 */
export async function faturaEmAtraso(assinaturaId: string): Promise<string | null> {
  const lista = await chamar<{ data: { dueDate: string; invoiceUrl?: string | null }[] }>(
    `/v3/subscriptions/${encodeURIComponent(assinaturaId)}/payments?status=OVERDUE`,
    { method: "GET" },
  );

  const maisAntiga = lista.data
    .filter((cobranca) => cobranca.invoiceUrl)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return maisAntiga?.invoiceUrl ?? null;
}
