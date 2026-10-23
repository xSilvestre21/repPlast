/**
 * Testes de integração da troca de plano e do perfil, em Configurações.
 *
 * O que se protege: Max → Solo com preposto ativo é recusado e nada muda; com
 * os prepostos inativos, passa; o Asaas é acertado ANTES de gravar — se ele
 * recusar, o plano fica o de antes; e o plano só se grava pelo caminho da
 * ação (o papel restrito, sozinho, é barrado pelo trigger da cobrança).
 *
 * As ações rodam com o papel restrito (`dbParaOrganizacao`), não como dono do
 * banco, que passaria por cima do RLS.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts plano.itest
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type Ator, dbAdministrativo, dbParaOrganizacao } from "@/lib/db";

import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();

let org = "";
let ator: Ator = { usuarioId: "", papel: "ADMIN" };

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: org,
    usuarioId: ator.usuarioId,
    papel: ator.papel,
    ehAdmin: ator.papel === "ADMIN",
    plano: "PLUS",
    db: dbParaOrganizacao(org, ator),
  }),
  // Como o de verdade: recusa quem não é administrador.
  exigirAdmin: async () => {
    const { ErroParaUsuario } = await import("@/lib/erro-formulario");
    if (ator.papel !== "ADMIN") throw new ErroParaUsuario("Só quem administra o escritório pode fazer isso.");
  },
}));

const asaas = vi.hoisted(() => ({ falhar: false, chamadas: [] as unknown[][] }));
vi.mock("@/lib/asaas", async (original) => {
  const real = await original<typeof import("@/lib/asaas")>();
  return {
    ...real,
    atualizarValorAssinatura: async (...argumentos: unknown[]) => {
      if (asaas.falhar) throw new real.ErroAsaas("fora do ar", 503);
      asaas.chamadas.push(argumentos);
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { salvarPerfil, trocarPlano } = await import("./acoes");

let prepostoId = "";
let donoId = "";

async function planoAgora() {
  return (await admin.organizacao.findUniqueOrThrow({ where: { id: org }, select: { plano: true } })).plano;
}

beforeAll(async () => {
  const o = await admin.organizacao.create({
    data: { nome: nomeDeTeste("Escritório do Plano"), plano: "PLUS", asaasAssinaturaId: `sub_${Date.now()}` },
  });
  org = o.id;
  const dono = await admin.usuario.create({
    data: { organizacaoId: org, nome: "Renata", sobrenome: "Lima", email: `dono-${org}@exemplo.test`, senhaHash: "x" },
  });
  ator = { usuarioId: dono.id, papel: "ADMIN" };
  donoId = dono.id;
  const preposto = await admin.usuario.create({
    data: {
      organizacaoId: org,
      nome: "Ana",
      email: `preposto-${org}@exemplo.test`,
      senhaHash: "x",
      papel: "REPRESENTANTE",
    },
  });
  prepostoId = preposto.id;
});

beforeEach(() => {
  asaas.falhar = false;
  asaas.chamadas = [];
  ator = { usuarioId: donoId, papel: "ADMIN" };
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

describe("trocarPlano", () => {
  it("recusa Max → Solo com preposto ativo, sem tocar no Asaas", async () => {
    const estado = await trocarPlano("PADRAO", {}, new FormData());

    expect(estado.erro).toMatch(/Inative o preposto ativo/);
    expect(await planoAgora()).toBe("PLUS");
    expect(asaas.chamadas).toHaveLength(0);
  });

  it("com os prepostos inativos, passa para o Solo e acerta a mensalidade", async () => {
    await admin.usuario.update({ where: { id: prepostoId }, data: { ativo: false } });

    const estado = await trocarPlano("PADRAO", {}, new FormData());

    expect(estado.erro).toBeUndefined();
    expect(await planoAgora()).toBe("PADRAO");
    expect(asaas.chamadas).toHaveLength(1);
    const [, valor, plano] = asaas.chamadas[0] as [string, { toString(): string }, string];
    expect(valor.toString()).toBe("79");
    expect(plano).toBe("PADRAO");
  });

  it("recusa trocar para o plano em que já está", async () => {
    const estado = await trocarPlano("PADRAO", {}, new FormData());
    expect(estado.erro).toMatch(/já está no plano Solo/);
  });

  it("se o Asaas recusar, o plano fica o de antes", async () => {
    asaas.falhar = true;

    const estado = await trocarPlano("PLUS", {}, new FormData());

    expect(estado.erro).toMatch(/Não conseguimos acertar a mensalidade/);
    expect(await planoAgora()).toBe("PADRAO");
  });

  it("volta ao Max", async () => {
    const estado = await trocarPlano("PLUS", {}, new FormData());

    expect(estado.erro).toBeUndefined();
    expect(await planoAgora()).toBe("PLUS");
    expect((asaas.chamadas[0] as unknown[])[1]?.toString()).toBe("189");
  });

  it("recusa plano que não existe (argumento adulterado)", async () => {
    const estado = await trocarPlano("OURO" as never, {}, new FormData());
    expect(estado.erro).toMatch(/qual plano/);
  });

  it("o preposto não troca o plano, nem montando a chamada à mão", async () => {
    ator = { usuarioId: prepostoId, papel: "REPRESENTANTE" };

    const estado = await trocarPlano("PADRAO", {}, new FormData());

    expect(estado.erro).toMatch(/administra/);
    expect(await planoAgora()).toBe("PLUS");
    expect(asaas.chamadas).toHaveLength(0);
  });

  it("o papel restrito, sozinho, não muda o plano", async () => {
    await expect(
      dbParaOrganizacao(org, ator).organizacao.update({ where: { id: org }, data: { plano: "PADRAO" } }),
    ).rejects.toThrow();
  });
});

describe("salvarPerfil", () => {
  it("corrige nome, sobrenome e telefone", async () => {
    const formData = new FormData();
    formData.set("nome", "  Renata ");
    formData.set("sobrenome", "Lima  Souza");
    formData.set("telefone", "11912345678");

    const estado = await salvarPerfil({}, formData);

    expect(estado.erro).toBeUndefined();
    const usuario = await admin.usuario.findUniqueOrThrow({
      where: { id: ator.usuarioId },
      select: { nome: true, sobrenome: true, telefone: true },
    });
    expect(usuario).toEqual({ nome: "Renata", sobrenome: "Lima Souza", telefone: "(11) 91234-5678" });
  });

  it("o preposto pode ficar só com o nome, e só mexe na própria linha", async () => {
    ator = { usuarioId: prepostoId, papel: "REPRESENTANTE" };
    const formData = new FormData();
    formData.set("nome", "Ana");
    formData.set("sobrenome", "");

    const estado = await salvarPerfil({}, formData);

    expect(estado.erro).toBeUndefined();
    const [preposto, dono] = await Promise.all([
      admin.usuario.findUniqueOrThrow({ where: { id: prepostoId }, select: { sobrenome: true } }),
      admin.usuario.findUniqueOrThrow({ where: { id: donoId }, select: { nome: true } }),
    ]);
    expect(preposto.sobrenome).toBeNull();
    expect(dono.nome).toBe("Renata");
  });

  it("exige o sobrenome do administrador — o pagamento pede o nome completo", async () => {
    const formData = new FormData();
    formData.set("nome", "Renata");
    formData.set("sobrenome", "");

    const estado = await salvarPerfil({}, formData);

    expect(estado.campo).toBe("sobrenome");
    expect(estado.erro).toMatch(/sobrenome/);
  });
});
