/**
 * De onde a numeração de pedidos de uma indústria continua.
 *
 * O caso que motivou: quem assina vindo de outro sistema já está no pedido
 * 2256 com a indústria, e o próximo daqui precisa sair 2257 — sem nunca
 * repetir um número que já existe nela.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbAdministrativo } from "./db";
import { definirUltimoNumeroPedido, lerUltimoNumeroPedido } from "./numeracao-pedido";
import { nomeDeTeste } from "../../test/nome-de-teste";

const admin = dbAdministrativo();

let organizacaoId = "";
let clienteId = "";

beforeAll(async () => {
  const org = await admin.organizacao.create({ data: { nome: nomeDeTeste("Teste numeração de pedidos") } });
  organizacaoId = org.id;
  const cliente = await admin.cliente.create({
    data: { organizacaoId, apelido: "CLIENTE", razaoSocial: "CLIENTE LTDA" },
  });
  clienteId = cliente.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

/** Indústria cujo último pedido emitido é `ultimo`, com pedidos já lançados. */
async function industria(ultimo: number, pedidos: number[] = []) {
  const f = await admin.fornecedor.create({
    data: { organizacaoId, nome: `IND ${Math.random()}`, proximoNumeroPedido: ultimo + 1 },
  });
  for (const numero of pedidos) {
    await admin.pedido.create({ data: { organizacaoId, clienteId, fornecedorId: f.id, numero } });
  }
  return f.id;
}

const contador = async (fornecedorId: string) =>
  (await admin.fornecedor.findUniqueOrThrow({ where: { id: fornecedorId } })).proximoNumeroPedido;

const definir = (fornecedorId: string, ultimoVisto: number, novoUltimo: number) =>
  definirUltimoNumeroPedido(admin, { organizacaoId, fornecedorId, ultimoVisto, novoUltimo });

describe("último pedido emitido da indústria", () => {
  it("avançar continua dali: o próximo pedido sai com o número + 1", async () => {
    const id = await industria(10, [9, 10]);
    expect(await definir(id, 10, 2256)).toEqual({});
    expect(await contador(id)).toBe(2257);
  });

  it("voltar para trás de pedido existente é recusado, citando o maior", async () => {
    const id = await industria(2256, [2254, 2256]);
    const { erro } = await definir(id, 2256, 2250);
    expect(erro).toContain("Já existem 2 pedidos");
    expect(erro).toContain("nº 2.256");
    expect(erro).toContain("2.256 ou um número maior");
    expect(await contador(id)).toBe(2257);
  });

  it("voltar acima de todos os pedidos existentes é aceito", async () => {
    const id = await industria(500, [100]);
    expect(await definir(id, 500, 100)).toEqual({});
    expect(await contador(id)).toBe(101);
  });

  it("o mesmo número em outra indústria não conflita", async () => {
    await industria(2256, [2256]);
    const id = await industria(10);
    expect(await definir(id, 10, 2255)).toEqual({});
    expect(await contador(id)).toBe(2256);
  });

  it("pedido lançado enquanto se editava: nada é gravado", async () => {
    const id = await industria(10);
    await admin.fornecedor.update({ where: { id }, data: { proximoNumeroPedido: { increment: 1 } } });
    const { erro } = await definir(id, 10, 500);
    expect(erro).toContain("o último agora é o nº 11");
    expect(await contador(id)).toBe(12);
  });

  it("número inválido é recusado", async () => {
    const id = await industria(10);
    expect((await definir(id, 10, -1)).erro).toBeDefined();
    expect(() => lerUltimoNumeroPedido("12a")).toThrow();
    expect(() => lerUltimoNumeroPedido("1,5")).toThrow();
    expect(lerUltimoNumeroPedido("2.256")).toBe(2256);
    expect(lerUltimoNumeroPedido("")).toBe(0);
  });
});
