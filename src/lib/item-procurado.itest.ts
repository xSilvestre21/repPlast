/**
 * Teste de integração da busca de pedidos e orçamentos pelo PRODUTO.
 *
 * O que se protege: cada palavra tem de estar no MESMO item, em qualquer
 * ordem; o código da indústria e o do cliente também valem; a linha traz o
 * item que fez o documento aparecer (e nenhum, quando ele apareceu pelo
 * cliente); a linha de proposta feita na conta, sem produto, é achada; e o
 * preposto continua sem enxergar o pedido de outro — buscar pelo item não
 * abre porta que o RLS fecha.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts item-procurado
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buscarOrcamentos } from "@/app/(app)/orcamentos/consulta";
import { buscarPedidos } from "@/app/(app)/pedidos/consulta";

import { nomeDeTeste } from "../../test/nome-de-teste";
import { dbAdministrativo, dbParaOrganizacao, type DbOrganizacao } from "./db";

const admin = dbAdministrativo();

let org = "";
let fornecedorId = "";
let clienteId = "";
let donoId = "";
let prepostoId = "";

/** Um item com o que o banco exige; só a descrição e os códigos importam aqui. */
function item(ordem: number, descricao: string, extra: { codigoFornecedor?: string } = {}) {
  return {
    ordem,
    familia: "SACO" as const,
    descricao,
    unidade: "MIL" as const,
    quantidade: "10",
    precoUnitario: "1134",
    totalSemIpi: "11340",
    valorIpi: "0",
    total: "11340",
    ...extra,
  };
}

let numero = 500;
async function pedido(itens: ReturnType<typeof item>[], dados: { representanteId?: string } = {}) {
  return admin.pedido.create({
    data: { organizacaoId: org, fornecedorId, clienteId, numero: numero++, ...dados, itens: { create: itens } },
    select: { id: true, numero: true },
  });
}

async function buscar(texto: string, quem: "admin" | "preposto" = "admin") {
  const db: DbOrganizacao =
    quem === "admin"
      ? dbParaOrganizacao(org, { usuarioId: donoId, papel: "ADMIN" })
      : dbParaOrganizacao(org, { usuarioId: prepostoId, papel: "REPRESENTANTE" });
  return (await buscarPedidos(db, org, quem === "admin", { busca: texto, status: "todos", pagina: 0 })).linhas;
}

let comPead: { id: string; numero: number };
let comFita: { id: string; numero: number };
let doPreposto: { id: string; numero: number };

beforeAll(async () => {
  org = (await admin.organizacao.create({ data: { nome: nomeDeTeste("Busca por item"), plano: "PLUS" } })).id;
  const [fornecedor, cliente, dono, preposto] = await Promise.all([
    admin.fornecedor.create({ data: { organizacaoId: org, nome: "QUALYPLAST" } }),
    admin.cliente.create({ data: { organizacaoId: org, apelido: "MARIOL", razaoSocial: "Mariol LTDA" } }),
    admin.usuario.create({ data: { organizacaoId: org, nome: "Dono", email: `dono-${org}@teste.local`, senhaHash: "x" } }),
    admin.usuario.create({
      data: { organizacaoId: org, nome: "Ana", email: `ana-${org}@teste.local`, senhaHash: "x", papel: "REPRESENTANTE" },
    }),
  ]);
  fornecedorId = fornecedor.id;
  clienteId = cliente.id;
  donoId = dono.id;
  prepostoId = preposto.id;

  comPead = await pedido([
    item(1, "77x150x0,05 SF 09 PEAD C/ DESLIZANTE"),
    item(2, "105x100x0,08 SF 15 PEAD", { codigoFornecedor: "3353" }),
  ]);
  comFita = await pedido([item(1, "Fita adesiva 45x100 transparente")]);
  doPreposto = await pedido([item(1, "105x100x0,08 SF 15 PEAD")], { representanteId: prepostoId });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

describe("busca de pedidos pelo item", () => {
  it("acha pelo que está na descrição, do mais recente para o mais antigo", async () => {
    const linhas = await buscar("pead");
    expect(linhas.map((l) => l.numero)).toEqual([doPreposto.numero, comPead.numero]);
  });

  it("cada palavra no MESMO item, em qualquer ordem", async () => {
    const linhas = await buscar("105 pead");
    expect(linhas.map((l) => l.id)).toContain(comPead.id);
    // A linha mostra o item que bateu — o segundo, não o primeiro do pedido.
    expect(linhas.find((l) => l.id === comPead.id)?.itemAchado).toEqual({
      descricao: "105x100x0,08 SF 15 PEAD",
      quantidade: "10 MIL",
      preco: expect.stringMatching(/1\.134,00/),
    });

    // "deslizante" está num item e "105" no outro: palavras em itens diferentes não valem.
    expect((await buscar("deslizante 105")).map((l) => l.id)).not.toContain(comPead.id);
    expect(await buscar("pead 999")).toEqual([]);
  });

  it("acha pelo código da indústria", async () => {
    const linhas = await buscar("3353");
    expect(linhas.map((l) => l.id)).toEqual([comPead.id]);
  });

  it("a fita, sem maiúscula", async () => {
    const linhas = await buscar("FITA TRANSPARENTE");
    expect(linhas.map((l) => l.id)).toEqual([comFita.id]);
    expect(linhas[0].itemAchado?.descricao).toBe("Fita adesiva 45x100 transparente");
  });

  it("achado pelo cliente, a linha não inventa item", async () => {
    const linhas = await buscar("mariol");
    expect(linhas).toHaveLength(3);
    for (const linha of linhas) expect(linha.itemAchado).toBeNull();
  });

  it("sem busca, nenhuma linha traz item", async () => {
    const linhas = await buscar("");
    expect(linhas.every((l) => l.itemAchado === null)).toBe(true);
  });

  it("o preposto só acha, pelo item, os pedidos dele", async () => {
    const linhas = await buscar("pead", "preposto");
    expect(linhas.map((l) => l.id)).toEqual([doPreposto.id]);
  });
});

describe("busca de orçamentos pelo item", () => {
  it("acha a linha de proposta feita na conta, sem produto", async () => {
    const orcamento = await admin.orcamento.create({
      data: {
        organizacaoId: org,
        fornecedorId,
        clienteAvulsoNome: "QUEM PEDIU PREÇO",
        numero: 900,
        criadoPorId: donoId,
        itens: { create: [item(1, "90x160x0,06 SF PEBD canela")] },
      },
      select: { id: true },
    });

    const db = dbParaOrganizacao(org, { usuarioId: donoId, papel: "ADMIN" });
    const { linhas } = await buscarOrcamentos(db, org, true, { busca: "canela 90x160", status: "todos", pagina: 0 });

    expect(linhas.map((l) => l.id)).toEqual([orcamento.id]);
    expect(linhas[0].itemAchado).toMatchObject({ descricao: "90x160x0,06 SF PEBD canela", quantidade: "10 MIL" });
  });
});
