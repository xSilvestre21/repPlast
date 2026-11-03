/**
 * O cancelamento pela tela, contra o banco: em dia, o acesso vai até o fim do
 * mês pago; em atraso, termina na hora; e uma recusa do Asaas não muda nada.
 *
 * O Asaas não é chamado: o próximo vencimento é fixo, e a remoção só é
 * anotada (ou falha, quando o teste pede).
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const asaas = vi.hoisted(() => ({ removidas: [] as string[], falhar: false }));
vi.mock("./asaas", () => {
  class ErroAsaas extends Error {}
  return {
    ErroAsaas,
    proximoVencimento: async () => "2026-12-03",
    removerAssinatura: async (id: string) => {
      if (asaas.falhar) throw new ErroAsaas("Asaas respondeu 500");
      asaas.removidas.push(id);
    },
  };
});

import { cancelarAssinaturaDoEscritorio } from "./cancelamento";
import { dbAdministrativo } from "./db";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const criadas: string[] = [];

async function escritorio(assinatura: "ATIVA" | "ATRASADA" | "CANCELADA", assinaturaId: string | null) {
  const { id } = await admin.organizacao.create({
    data: {
      nome: `CANCELAMENTO ${assinatura} ${sufixo} ${criadas.length}`,
      assinatura,
      asaasAssinaturaId: assinaturaId,
    },
    select: { id: true },
  });
  criadas.push(id);
  return id;
}

async function situacao(id: string) {
  return admin.organizacao.findUniqueOrThrow({
    where: { id },
    select: { assinatura: true, acessoAte: true },
  });
}

beforeEach(() => {
  asaas.removidas = [];
  asaas.falhar = false;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: { in: criadas } } });
});

describe("cancelarAssinaturaDoEscritorio", () => {
  it("em dia: remove no Asaas e deixa entrar até o fim do mês pago", async () => {
    const id = await escritorio("ATIVA", `sub_dia_${sufixo}`);

    await cancelarAssinaturaDoEscritorio(id);

    expect(asaas.removidas).toEqual([`sub_dia_${sufixo}`]);
    expect(await situacao(id)).toEqual({
      assinatura: "CANCELADA",
      // A meia-noite de Brasília do vencimento de 03/12.
      acessoAte: new Date("2026-12-03T03:00:00.000Z"),
    });
  });

  it("em atraso: remove no Asaas, com a mensalidade vencida, e encerra na hora", async () => {
    const id = await escritorio("ATRASADA", `sub_atraso_${sufixo}`);
    // Um prazo que sobrou de um cancelamento antigo não pode virar acesso.
    await admin.organizacao.update({ where: { id }, data: { acessoAte: new Date("2099-01-01T00:00:00Z") } });

    await cancelarAssinaturaDoEscritorio(id);

    expect(asaas.removidas).toEqual([`sub_atraso_${sufixo}`]);
    expect(await situacao(id)).toEqual({ assinatura: "CANCELADA", acessoAte: null });
  });

  it("recusa o que não tem o que cancelar, sem chamar o Asaas", async () => {
    const cancelada = await escritorio("CANCELADA", `sub_ja_${sufixo}`);
    const semCobranca = await escritorio("ATIVA", null);

    await expect(cancelarAssinaturaDoEscritorio(cancelada)).rejects.toThrow(/já está cancelada/);
    await expect(cancelarAssinaturaDoEscritorio(semCobranca)).rejects.toThrow(/não há o que cancelar/);
    expect(asaas.removidas).toEqual([]);
  });

  it("o Asaas recusou: a assinatura continua como estava", async () => {
    const id = await escritorio("ATRASADA", `sub_falha_${sufixo}`);
    asaas.falhar = true;

    await expect(cancelarAssinaturaDoEscritorio(id)).rejects.toThrow(/continua como estava/);
    expect((await situacao(id)).assinatura).toBe("ATRASADA");
  });
});
