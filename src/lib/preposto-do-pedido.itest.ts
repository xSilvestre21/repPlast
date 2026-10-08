/**
 * Com quem a comissão de um pedido novo se divide.
 *
 * O caso que motivou: o administrador lança o pedido para o cliente do
 * preposto, e o pedido sumia da comissão dele — nascia do escritório.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbAdministrativo } from "./db";
import { prepostoDoNovoPedido } from "./preposto-do-pedido";

const admin = dbAdministrativo();

let organizacaoId = "";
let adminId = "";
let ana = "";
let bruno = "";
let soDaAna = "";
let dosDois = "";
let semPreposto = "";

beforeAll(async () => {
  const org = await admin.organizacao.create({
    data: { nome: "Teste preposto do pedido", plano: "PLUS" },
  });
  organizacaoId = org.id;

  const usuario = (nome: string, papel: "ADMIN" | "REPRESENTANTE", comissao?: string) =>
    admin.usuario.create({
      data: {
        organizacaoId,
        nome,
        email: `${nome.toLowerCase()}-${organizacaoId}@exemplo.test`,
        senhaHash: "x",
        papel,
        comissaoPercentualPadrao: comissao,
      },
    });
  const cliente = (apelido: string) =>
    admin.cliente.create({ data: { organizacaoId, apelido, razaoSocial: `${apelido} LTDA` } });

  const [a, b, c, d, e, f] = await Promise.all([
    usuario("Dona", "ADMIN"),
    usuario("Ana", "REPRESENTANTE", "40"),
    usuario("Bruno", "REPRESENTANTE", "25"),
    cliente("SO-ANA"),
    cliente("DOS-DOIS"),
    cliente("SEM"),
  ]);
  [adminId, ana, bruno, soDaAna, dosDois, semPreposto] = [a.id, b.id, c.id, d.id, e.id, f.id];

  await admin.clientePreposto.createMany({
    data: [
      { clienteId: soDaAna, usuarioId: ana },
      { clienteId: dosDois, usuarioId: ana },
      { clienteId: dosDois, usuarioId: bruno },
    ],
  });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

const peloAdmin = (clienteId: string, representanteId?: string | null) =>
  prepostoDoNovoPedido(admin, {
    organizacaoId,
    clienteId,
    usuarioId: adminId,
    ehAdmin: true,
    representanteId,
  });

describe("preposto de um pedido novo", () => {
  it("o pedido do administrador para cliente de um preposto credita ele", async () => {
    const r = await peloAdmin(soDaAna);
    expect(r.representanteId).toBe(ana);
    expect(Number(r.comissaoPercentualPreposto)).toBe(40);
  });

  it("cliente com vários prepostos nasce do escritório, para escolher no cabeçalho", async () => {
    expect(await peloAdmin(dosDois)).toEqual({
      representanteId: null,
      comissaoPercentualPreposto: null,
    });
  });

  it("cliente sem preposto é do escritório", async () => {
    expect((await peloAdmin(semPreposto)).representanteId).toBeNull();
  });

  it("o preposto que lança é o próprio, com a fatia dele", async () => {
    const r = await prepostoDoNovoPedido(admin, {
      organizacaoId,
      clienteId: dosDois,
      usuarioId: bruno,
      ehAdmin: false,
    });
    expect(r.representanteId).toBe(bruno);
    expect(Number(r.comissaoPercentualPreposto)).toBe(25);
  });

  it("a proposta cotada por um preposto credita ele, mesmo convertida pelo administrador", async () => {
    const r = await peloAdmin(dosDois, bruno);
    expect(r.representanteId).toBe(bruno);
    expect(Number(r.comissaoPercentualPreposto)).toBe(25);
  });
});
