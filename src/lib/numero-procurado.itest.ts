/**
 * Teste de integração da busca de pedidos e orçamentos pelo NÚMERO.
 *
 * O que se protege: um pedaço do número acha o documento ("22" acha o #2224);
 * o número vem antes do resto — o exato no topo, depois os pedaços, e só então
 * o que a busca achou pelas medidas do item —; a rolagem continua a mesma lista
 * de uma camada para a outra, sem pular nem repetir linha; e o preposto não
 * acha pelo número o pedido de outro.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts numero-procurado
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buscarOrcamentos } from "@/app/(app)/orcamentos/consulta";
import { buscarPedidos, POR_PAGINA } from "@/app/(app)/pedidos/consulta";

import { nomeDeTeste } from "../../test/nome-de-teste";
import { dbAdministrativo, dbParaOrganizacao, type DbOrganizacao } from "./db";

const admin = dbAdministrativo();

let org = "";
let fornecedorId = "";
let clienteId = "";
let donoId = "";
let prepostoId = "";

function item(descricao: string) {
  return {
    ordem: 1,
    familia: "SACO" as const,
    descricao,
    unidade: "MIL" as const,
    quantidade: "10",
    precoUnitario: "100",
    totalSemIpi: "1000",
    valorIpi: "0",
    total: "1000",
  };
}

/** Um pedido por vez, para cada um nascer depois do anterior. */
async function pedido(numero: number, descricao = "Saco 40x60 PEBD", dados: { representanteId?: string } = {}) {
  await admin.pedido.create({
    data: { organizacaoId: org, fornecedorId, clienteId, numero, ...dados, itens: { create: [item(descricao)] } },
  });
}

function db(quem: "admin" | "preposto"): DbOrganizacao {
  return quem === "admin"
    ? dbParaOrganizacao(org, { usuarioId: donoId, papel: "ADMIN" })
    : dbParaOrganizacao(org, { usuarioId: prepostoId, papel: "REPRESENTANTE" });
}

function buscar(texto: string, { quem = "admin", pagina = 0 }: { quem?: "admin" | "preposto"; pagina?: number } = {}) {
  return buscarPedidos(db(quem), org, quem === "admin", { busca: texto, status: "todos", pagina });
}

const numeros = (fatia: { linhas: { numero: number }[] }) => fatia.linhas.map((l) => l.numero);

beforeAll(async () => {
  org = (await admin.organizacao.create({ data: { nome: nomeDeTeste("Busca por número"), plano: "PLUS" } })).id;
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

  // Do mais antigo para o mais novo.
  await pedido(22);
  await pedido(2224);
  await pedido(1220);
  await pedido(57, "Saco 22x30 PEAD"); // só a medida tem 22
  await pedido(300);
  await pedido(4422, "Saco 40x60 PEBD", { representanteId: prepostoId });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

describe("busca de pedidos pelo número", () => {
  it("um pedaço acha: o exato no topo, depois os pedaços, e só então a medida", async () => {
    const fatia = await buscar("22");

    expect(numeros(fatia)).toEqual([22, 4422, 1220, 2224, 57]);
    expect(fatia.quantos).toBe(5);
    // O #57 apareceu pela medida, e a linha diz qual item.
    expect(fatia.linhas.at(-1)?.itemAchado?.descricao).toBe("Saco 22x30 PEAD");
  });

  it("com o # da tela, os mesmos números — e a medida não vem, porque # é número", async () => {
    expect(numeros(await buscar("#22"))).toEqual([22, 4422, 1220, 2224]);
  });

  it("sem número exato, os pedaços vêm na frente do mesmo jeito", async () => {
    expect(numeros(await buscar("224"))).toEqual([2224]);
    expect(numeros(await buscar("2"))).toEqual([4422, 1220, 2224, 22, 57]);
  });

  it("o preposto acha pelo número só o pedido dele", async () => {
    expect(numeros(await buscar("22", { quem: "preposto" }))).toEqual([4422]);
  });

  it("rolar continua a lista de uma camada para a outra", async () => {
    // 21 pedidos com 55 no número — mais que uma fatia —, o #55 e uma medida 55.
    await pedido(55);
    await admin.pedido.createMany({
      data: Array.from({ length: 21 }, (_, i) => ({ organizacaoId: org, fornecedorId, clienteId, numero: 5500 + i })),
    });
    await pedido(81, "Saco 55x100 PEBD");

    const primeira = await buscar("55");
    const segunda = await buscar("55", { pagina: 1 });

    const pedacos = Array.from({ length: 21 }, (_, i) => 5520 - i);
    expect(primeira.quantos).toBe(23);
    expect(primeira.temMais).toBe(true);
    expect(numeros(primeira)).toEqual([55, ...pedacos.slice(0, POR_PAGINA - 1)]);
    expect(segunda.temMais).toBe(false);
    expect(numeros(segunda)).toEqual([...pedacos.slice(POR_PAGINA - 1), 81]);
  });
});

describe("busca de orçamentos pelo número", () => {
  it("um pedaço acha, com o exato no topo e a medida por último", async () => {
    const orcamento = (numero: number, descricao = "Saco 40x60 PEBD") =>
      admin.orcamento.create({
        data: {
          organizacaoId: org,
          fornecedorId,
          clienteId,
          numero,
          criadoPorId: donoId,
          itens: { create: [item(descricao)] },
        },
      });
    await orcamento(22);
    await orcamento(2224);
    await orcamento(57, "Saco 22x30 PEAD");
    await orcamento(300);

    const fatia = await buscarOrcamentos(db("admin"), org, true, { busca: "22", status: "todos", pagina: 0 });

    expect(numeros(fatia)).toEqual([22, 2224, 57]);
    expect(fatia.quantos).toBe(3);
  });
});
