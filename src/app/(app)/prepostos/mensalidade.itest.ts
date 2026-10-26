/**
 * Testes de integração da mensalidade ao tirar e devolver o acesso do preposto.
 *
 * O que se protege é o "tira na véspera do vencimento": o Max cobre 3
 * prepostos e cada um a mais soma na mensalidade. Tirar o acesso do quarto não
 * baixa a fatura em aberto (só depois de paga — `lib/mensalidade.ts`);
 * devolver sobe na hora, mas compara com o que o Asaas cobra — inativar dois e
 * reativar um no mesmo ciclo não pode baixar a fatura.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts prepostos/mensalidade.itest
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";

import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();

let org = "";
let donoId = "";

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: org,
    usuarioId: donoId,
    papel: "ADMIN",
    ehAdmin: true,
    plano: "PLUS",
    db: dbParaOrganizacao(org, { usuarioId: donoId, papel: "ADMIN" }),
  }),
}));

/** `cobrado`: o valor que a assinatura tem no Asaas. */
const asaas = vi.hoisted(() => ({ falhar: false, cobrado: "238", chamadas: [] as unknown[][] }));
vi.mock("@/lib/asaas", async (original) => {
  const real = await original<typeof import("@/lib/asaas")>();
  return {
    ...real,
    valorDaAssinatura: async () => {
      if (asaas.falhar) throw new real.ErroAsaas("fora do ar", 503);
      const { default: Decimal } = await import("decimal.js");
      return new Decimal(asaas.cobrado);
    },
    atualizarValorAssinatura: async (...argumentos: unknown[]) => {
      if (asaas.falhar) throw new real.ErroAsaas("fora do ar", 503);
      asaas.chamadas.push(argumentos);
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { alternarAtivoPreposto } = await import("./acoes");

const prepostos: string[] = [];

async function ativo(id: string) {
  return (await admin.usuario.findUniqueOrThrow({ where: { id }, select: { ativo: true } })).ativo;
}

beforeAll(async () => {
  const o = await admin.organizacao.create({
    data: { nome: nomeDeTeste("Escritório da Mensalidade"), plano: "PLUS", asaasAssinaturaId: `sub_${Date.now()}` },
  });
  org = o.id;
  const dono = await admin.usuario.create({
    data: { organizacaoId: org, nome: "Renata", sobrenome: "Lima", email: `dono-${org}@exemplo.test`, senhaHash: "x" },
  });
  donoId = dono.id;
  // Quatro ativos: um além dos 3 inclusos — 189 + 49 = 238.
  for (let i = 0; i < 4; i++) {
    const preposto = await admin.usuario.create({
      data: {
        organizacaoId: org,
        nome: `Preposto ${i}`,
        email: `preposto-${i}-${org}@exemplo.test`,
        senhaHash: "x",
        papel: "REPRESENTANTE",
      },
    });
    prepostos.push(preposto.id);
  }
});

beforeEach(() => {
  asaas.falhar = false;
  asaas.cobrado = "238";
  asaas.chamadas = [];
});

afterAll(async () => {
  await admin.usuario.deleteMany({ where: { organizacaoId: org } });
  await admin.organizacao.deleteMany({ where: { id: org } });
});

describe("tirar e devolver o acesso", () => {
  it("tirar o acesso do quarto não baixa a fatura em aberto", async () => {
    const estado = await alternarAtivoPreposto(prepostos[3], {}, new FormData());

    expect(estado.erro).toBeUndefined();
    expect(await ativo(prepostos[3])).toBe(false);
    expect(asaas.chamadas).toHaveLength(0);
  });

  it("tirar mais um e devolver um, no mesmo ciclo, não mexe na fatura de 238", async () => {
    await alternarAtivoPreposto(prepostos[2], {}, new FormData());
    const estado = await alternarAtivoPreposto(prepostos[2], {}, new FormData());

    expect(estado.erro).toBeUndefined();
    expect(await ativo(prepostos[2])).toBe(true);
    expect(asaas.chamadas).toHaveLength(0);
  });

  it("depois que a fatura baixou, devolver o quarto sobe na hora", async () => {
    asaas.cobrado = "189";

    const estado = await alternarAtivoPreposto(prepostos[3], {}, new FormData());

    expect(estado.erro).toBeUndefined();
    expect(await ativo(prepostos[3])).toBe(true);
    expect(asaas.chamadas).toHaveLength(1);
    expect((asaas.chamadas[0] as unknown[])[1]?.toString()).toBe("238");
  });

  it("se o Asaas recusar, o preposto não volta", async () => {
    await alternarAtivoPreposto(prepostos[3], {}, new FormData());
    asaas.falhar = true;

    const estado = await alternarAtivoPreposto(prepostos[3], {}, new FormData());

    expect(estado.erro).toMatch(/não conseguimos acertar a mensalidade/);
    expect(await ativo(prepostos[3])).toBe(false);
  });
});
