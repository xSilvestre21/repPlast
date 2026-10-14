/**
 * Testes de integração do webhook do Asaas e da trava da cobrança.
 *
 * O que se protege aqui é dinheiro e acesso: um pagamento confirmado tem de
 * liberar o escritório certo, uma entrega repetida não pode aplicar nada de
 * novo, e o próprio escritório não pode se marcar como pago.
 *
 * O Asaas não é chamado: a consulta de assinatura por cliente é trocada por
 * uma resposta fixa.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./asaas", () => ({
  assinaturaDoCliente: vi.fn(async () => "sub_teste_checkout"),
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
        create: { nome: "Dona", email: `webhook-${sufixo}@teste.local`, senhaHash: "x" },
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
      evento("CHECKOUT_PAID", { checkout: { id: checkoutId, customer: clienteId } }),
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
      evento("PAYMENT_OVERDUE", { payment: { subscription: "sub_teste_checkout" } }),
    );
    await processarEventoAsaas(pago);

    expect((await situacao()).assinatura).toBe("ATRASADA");
  });

  it("evento de outro escritório não mexe neste", async () => {
    await processarEventoAsaas(
      evento("SUBSCRIPTION_DELETED", { subscription: { id: "sub_de_ninguem" } }),
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

describe("trava da cobrança", () => {
  it("o próprio escritório não consegue se marcar como pago", async () => {
    const db = dbParaOrganizacao(organizacaoId, { usuarioId: adminUsuarioId, papel: "ADMIN" });

    await expect(
      db.organizacao.update({ where: { id: organizacaoId }, data: { assinatura: "ATIVA" } }),
    ).rejects.toThrow();
    await expect(
      db.organizacao.update({ where: { id: organizacaoId }, data: { plano: "PADRAO" } }),
    ).rejects.toThrow();

    expect((await situacao()).assinatura).toBe("CANCELADA");
  });

  it("o resto da organização continua editável pelo escritório", async () => {
    const db = dbParaOrganizacao(organizacaoId, { usuarioId: adminUsuarioId, papel: "ADMIN" });

    await db.organizacao.update({
      where: { id: organizacaoId },
      data: { proximoNumeroOrcamento: { increment: 1 } },
    });
  });
});
