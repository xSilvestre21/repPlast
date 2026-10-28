/**
 * Testes de integração do webhook do Asaas e da trava da cobrança.
 *
 * O que se protege aqui é dinheiro e acesso: um pagamento confirmado tem de
 * liberar o escritório certo, uma entrega repetida não pode aplicar nada de
 * novo, e o próprio escritório não pode se marcar como pago.
 *
 * O Asaas não é chamado: a consulta de assinatura por cliente e o valor da
 * assinatura são respostas fixas, e a troca de valor só é anotada.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** `cobrado`: o valor que a assinatura tem no Asaas. */
const asaas = vi.hoisted(() => ({ cobrado: "189", chamadas: [] as unknown[][] }));
vi.mock("./asaas", () => ({
  assinaturaDoCliente: vi.fn(async () => "sub_teste_checkout"),
  valorDaAssinatura: async () => {
    const { default: Decimal } = await import("decimal.js");
    return new Decimal(asaas.cobrado);
  },
  atualizarValorAssinatura: async (...argumentos: unknown[]) => {
    asaas.chamadas.push(argumentos);
  },
}));

import { processarEventoAsaas, tokenDoWebhookConfere } from "./asaas-webhook";
import { dbAdministrativo, dbParaOrganizacao } from "./db";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);

let organizacaoId = "";
let adminUsuarioId = "";
const checkoutId = `chk_${sufixo}`;
const clienteId = `cus_${sufixo}`;
const eventos: string[] = [];

function evento(tipo: string, extra: Record<string, unknown>) {
  const id = `evt_${sufixo}_${eventos.length}`;
  eventos.push(id);
  return { id, event: tipo, ...extra };
}

async function situacao() {
  return admin.organizacao.findUniqueOrThrow({
    where: { id: organizacaoId },
    select: { assinatura: true, asaasClienteId: true, asaasAssinaturaId: true },
  });
}

beforeAll(async () => {
  const organizacao = await admin.organizacao.create({
    data: {
      nome: `WEBHOOK ${sufixo}`,
      plano: "PLUS",
      assinatura: "AGUARDANDO_PAGAMENTO",
      asaasCheckoutId: checkoutId,
      usuarios: {
        create: {
          nome: "Dona",
          email: `webhook-${sufixo}@teste.local`,
          senhaHash: "x",
        },
      },
    },
    select: { id: true, usuarios: { select: { id: true } } },
  });
  organizacaoId = organizacao.id;
  adminUsuarioId = organizacao.usuarios[0].id;
});

afterAll(async () => {
  await admin.eventoAsaas.deleteMany({ where: { id: { in: eventos } } });
  await admin.usuario.deleteMany({ where: { organizacaoId } });
  await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

describe("token do webhook", () => {
  it("recusa token ausente ou diferente", () => {
    process.env.ASAAS_WEBHOOK_TOKEN = "token-certo-do-teste";

    expect(tokenDoWebhookConfere(null)).toBe(false);
    expect(tokenDoWebhookConfere("token-errado-do-teste")).toBe(false);
    expect(tokenDoWebhookConfere("token-certo-do-teste")).toBe(true);
  });
});

describe("processarEventoAsaas", () => {
  it("CHECKOUT_PAID libera o escritório do checkout e grava cliente e assinatura", async () => {
    await processarEventoAsaas(
      evento("CHECKOUT_PAID", {
        checkout: { id: checkoutId, customer: clienteId },
      }),
    );

    expect(await situacao()).toEqual({
      assinatura: "ATIVA",
      asaasClienteId: clienteId,
      asaasAssinaturaId: "sub_teste_checkout",
    });
  });

  it("PAYMENT_OVERDUE da assinatura suspende", async () => {
    await processarEventoAsaas(
      evento("PAYMENT_OVERDUE", {
        payment: { subscription: "sub_teste_checkout", customer: clienteId },
      }),
    );

    expect((await situacao()).assinatura).toBe("ATRASADA");
  });

  it("evento repetido não é aplicado de novo", async () => {
    const pago = evento("PAYMENT_RECEIVED", {
      payment: { subscription: "sub_teste_checkout", customer: clienteId },
    });

    await processarEventoAsaas(pago);
    expect((await situacao()).assinatura).toBe("ATIVA");

    // Atrasa por outro evento, e a reentrega do pagamento antigo não reativa.
    await processarEventoAsaas(
      evento("PAYMENT_OVERDUE", {
        payment: { subscription: "sub_teste_checkout" },
      }),
    );
    await processarEventoAsaas(pago);

    expect((await situacao()).assinatura).toBe("ATRASADA");
  });

  it("evento de outro escritório não mexe neste", async () => {
    await processarEventoAsaas(
      evento("SUBSCRIPTION_DELETED", {
        subscription: { id: "sub_de_ninguem" },
      }),
    );

    expect((await situacao()).assinatura).toBe("ATRASADA");
  });

  it("SUBSCRIPTION_DELETED cancela", async () => {
    await processarEventoAsaas(
      evento("SUBSCRIPTION_DELETED", {
        subscription: { id: "sub_teste_checkout", customer: clienteId },
      }),
    );

    expect((await situacao()).assinatura).toBe("CANCELADA");
  });
});

/*
 * O registro de cada evento: o que ele dizia e de quem era. Sem isso, os
 * eventos de 21/10 eram só id e tipo, e não deu para saber de quem eram.
 */
describe("registro do evento", () => {
  const DIA_MS = 24 * 60 * 60 * 1000;

  it("guarda o corpo sem o token do cartão, e o escritório do evento", async () => {
    const criada = evento("PAYMENT_CREATED", {
      payment: {
        subscription: "sub_teste_checkout",
        customer: clienteId,
        value: 189,
        creditCard: { creditCardNumber: "8829", creditCardBrand: "MASTERCARD", creditCardToken: "tok_secreto" },
      },
    });
    await processarEventoAsaas(criada);

    const registro = await admin.eventoAsaas.findUniqueOrThrow({ where: { id: criada.id } });
    expect(registro.organizacaoId).toBe(organizacaoId);
    expect(registro.corpo).toMatchObject({
      event: "PAYMENT_CREATED",
      payment: { value: 189, creditCard: { creditCardNumber: "8829", creditCardBrand: "MASTERCARD" } },
    });
    expect(JSON.stringify(registro.corpo)).not.toContain("tok_secreto");
    // Cobrança criada não muda a situação: só fica registrada.
    expect((await situacao()).assinatura).toBe("CANCELADA");
  });

  it("evento que não é de escritório nenhum fica registrado, sem escritório", async () => {
    const alheio = evento("PAYMENT_CREATED", { payment: { subscription: "sub_de_ninguem" } });
    await processarEventoAsaas(alheio);

    const registro = await admin.eventoAsaas.findUniqueOrThrow({ where: { id: alheio.id } });
    expect(registro.organizacaoId).toBeNull();
    expect(registro.corpo).toMatchObject({ id: alheio.id });
  });

  it("o corpo de mais de 90 dias é apagado; a linha fica, e segura a repetição", async () => {
    const antigo = evento("PAYMENT_CREATED", { payment: { subscription: "sub_teste_checkout" } });
    await admin.eventoAsaas.create({
      data: {
        id: antigo.id,
        tipo: antigo.event,
        corpo: antigo,
        organizacaoId,
        recebidoEm: new Date(Date.now() - 91 * DIA_MS),
      },
    });

    const novo = evento("PAYMENT_CREATED", { payment: { subscription: "sub_teste_checkout" } });
    await processarEventoAsaas(novo);

    expect((await admin.eventoAsaas.findUniqueOrThrow({ where: { id: antigo.id } })).corpo).toBeNull();
    expect((await admin.eventoAsaas.findUniqueOrThrow({ where: { id: novo.id } })).corpo).not.toBeNull();
  });
});

describe("trava da cobrança", () => {
  it("o próprio escritório não consegue se marcar como pago", async () => {
    const db = dbParaOrganizacao(organizacaoId, {
      usuarioId: adminUsuarioId,
      papel: "ADMIN",
    });

    await expect(
      db.organizacao.update({
        where: { id: organizacaoId },
        data: { assinatura: "ATIVA" },
      }),
    ).rejects.toThrow();
    await expect(
      db.organizacao.update({
        where: { id: organizacaoId },
        data: { plano: "PADRAO" },
      }),
    ).rejects.toThrow();

    expect((await situacao()).assinatura).toBe("CANCELADA");
  });

  it("o resto da organização continua editável pelo escritório", async () => {
    const db = dbParaOrganizacao(organizacaoId, {
      usuarioId: adminUsuarioId,
      papel: "ADMIN",
    });

    await db.organizacao.update({
      where: { id: organizacaoId },
      data: { proximoNumeroOrcamento: { increment: 1 } },
    });
  });
});

describe("CHECKOUT_PAID sem cliente", () => {
  // Como o sandbox entrega hoje: o checkout pago chega com `customer: null`, e
  // só a assinatura criada diz quem é o cliente — e de qual checkout veio.
  const outroCheckout = `chk2_${sufixo}`;
  let outraOrganizacaoId = "";

  beforeAll(async () => {
    const organizacao = await admin.organizacao.create({
      data: {
        nome: `WEBHOOK SEM CLIENTE ${sufixo}`,
        plano: "PADRAO",
        assinatura: "AGUARDANDO_PAGAMENTO",
        asaasCheckoutId: outroCheckout,
        usuarios: {
          create: {
            nome: "Dono",
            email: `webhook2-${sufixo}@teste.local`,
            senhaHash: "x",
          },
        },
      },
      select: { id: true },
    });
    outraOrganizacaoId = organizacao.id;
  });

  afterAll(async () => {
    await admin.usuario.deleteMany({
      where: { organizacaoId: outraOrganizacaoId },
    });
    await admin.organizacao.deleteMany({ where: { id: outraOrganizacaoId } });
  });

  it("SUBSCRIPTION_CREATED liga assinatura e cliente pelo checkout que a criou", async () => {
    await processarEventoAsaas(
      evento("CHECKOUT_PAID", {
        checkout: { id: outroCheckout, customer: null },
      }),
    );
    await processarEventoAsaas(
      evento("SUBSCRIPTION_CREATED", {
        subscription: {
          id: `sub2_${sufixo}`,
          customer: `cus2_${sufixo}`,
          checkoutSession: outroCheckout,
        },
      }),
    );

    expect(
      await admin.organizacao.findUniqueOrThrow({
        where: { id: outraOrganizacaoId },
        select: {
          assinatura: true,
          asaasClienteId: true,
          asaasAssinaturaId: true,
        },
      }),
    ).toEqual({
      assinatura: "ATIVA",
      asaasClienteId: `cus2_${sufixo}`,
      asaasAssinaturaId: `sub2_${sufixo}`,
    });
  });
});

describe("mensalidade depois do pagamento", () => {
  it("PAYMENT_CONFIRMED leva às próximas faturas a redução do ciclo pago", async () => {
    // Max sem preposto ativo deve 189; a fatura paga ainda era a de 4 prepostos.
    asaas.cobrado = "238";
    asaas.chamadas = [];

    await processarEventoAsaas(
      evento("PAYMENT_CONFIRMED", {
        payment: { subscription: "sub_teste_checkout", customer: clienteId },
      }),
    );

    expect(asaas.chamadas).toHaveLength(1);
    const [assinatura, valor, plano] = asaas.chamadas[0] as [string, { toString(): string }, string];
    expect(assinatura).toBe("sub_teste_checkout");
    expect(valor.toString()).toBe("189");
    expect(plano).toBe("PLUS");
  });

  it("PAYMENT_RECEIVED não mexe no valor — no cartão, chega perto do vencimento seguinte", async () => {
    asaas.cobrado = "238";
    asaas.chamadas = [];

    await processarEventoAsaas(
      evento("PAYMENT_RECEIVED", {
        payment: { subscription: "sub_teste_checkout", customer: clienteId },
      }),
    );

    expect(asaas.chamadas).toHaveLength(0);
  });

  it("PAYMENT_CONFIRMED com a fatura já no valor certo não chama o Asaas", async () => {
    asaas.cobrado = "189";
    asaas.chamadas = [];

    await processarEventoAsaas(
      evento("PAYMENT_CONFIRMED", {
        payment: { subscription: "sub_teste_checkout", customer: clienteId },
      }),
    );

    expect(asaas.chamadas).toHaveLength(0);
  });
});
