/**
 * Teste de integração do número no topo das listas.
 *
 * O que se protege: a primeira fatia diz quantos batem AO TODO — não só os
 * vinte que cabem nela —, com a mesma regra da busca e do filtro; as fatias
 * seguintes não recontam; e o preposto conta só o que enxerga (o `count` passa
 * pelo mesmo RLS que a lista).
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts contagem-lista
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buscarClientes, POR_PAGINA } from "@/app/(app)/clientes/consulta";
import { buscarPedidos } from "@/app/(app)/pedidos/consulta";

import { nomeDeTeste } from "../../test/nome-de-teste";
import { dbAdministrativo, dbParaOrganizacao } from "./db";

const admin = dbAdministrativo();

let org = "";
let donoId = "";
let prepostoId = "";

const ATIVOS = POR_PAGINA + 5;

beforeAll(async () => {
  org = (await admin.organizacao.create({ data: { nome: nomeDeTeste("Contagem das listas"), plano: "PLUS" } })).id;
  const [dono, preposto, fornecedor] = await Promise.all([
    admin.usuario.create({ data: { organizacaoId: org, nome: "Dono", email: `dono-${org}@teste.local`, senhaHash: "x" } }),
    admin.usuario.create({
      data: { organizacaoId: org, nome: "Ana", email: `ana-${org}@teste.local`, senhaHash: "x", papel: "REPRESENTANTE" },
    }),
    admin.fornecedor.create({ data: { organizacaoId: org, nome: "QUALYPLAST" } }),
  ]);
  donoId = dono.id;
  prepostoId = preposto.id;

  // Mais do que cabe numa fatia, para o número não poder ser só "as linhas que vieram".
  await admin.cliente.createMany({
    data: [
      ...Array.from({ length: ATIVOS }, (_, i) => ({
        organizacaoId: org,
        apelido: `CLIENTE ${String(i).padStart(2, "0")}`,
        razaoSocial: i < 3 ? `Parafusos ${i} LTDA` : `Cliente ${i} LTDA`,
      })),
      { organizacaoId: org, apelido: "PARADO", razaoSocial: "Parafusos parados LTDA", ativo: false },
    ],
  });

  const cliente = await admin.cliente.findFirstOrThrow({ where: { organizacaoId: org }, select: { id: true } });
  await admin.pedido.createMany({
    data: [
      { organizacaoId: org, fornecedorId: fornecedor.id, clienteId: cliente.id, numero: 1 },
      { organizacaoId: org, fornecedorId: fornecedor.id, clienteId: cliente.id, numero: 2 },
      { organizacaoId: org, fornecedorId: fornecedor.id, clienteId: cliente.id, numero: 3, representanteId: prepostoId },
    ],
  });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

const comoDono = () => dbParaOrganizacao(org, { usuarioId: donoId, papel: "ADMIN" });

describe("quantos batem", () => {
  it("a primeira fatia conta todos, não só os que cabem nela", async () => {
    const fatia = await buscarClientes(comoDono(), org, { busca: "", situacao: "ativos", pagina: 0 });

    expect(fatia.linhas).toHaveLength(POR_PAGINA);
    expect(fatia.temMais).toBe(true);
    expect(fatia.quantos).toBe(ATIVOS);
  });

  it("as fatias seguintes não recontam", async () => {
    const fatia = await buscarClientes(comoDono(), org, { busca: "", situacao: "ativos", pagina: 1 });

    expect(fatia.linhas).toHaveLength(ATIVOS - POR_PAGINA);
    expect(fatia.quantos).toBeUndefined();
  });

  it("segue a busca e o filtro de situação", async () => {
    const buscar = (situacao: "ativos" | "inativos" | "todos") =>
      buscarClientes(comoDono(), org, { busca: "parafusos", situacao, pagina: 0 });

    expect((await buscar("ativos")).quantos).toBe(3);
    expect((await buscar("inativos")).quantos).toBe(1);
    expect((await buscar("todos")).quantos).toBe(4);
  });

  it("o preposto conta só os pedidos dele", async () => {
    const doDono = await buscarPedidos(comoDono(), org, true, { busca: "", status: "todos", pagina: 0 });
    const doPreposto = await buscarPedidos(
      dbParaOrganizacao(org, { usuarioId: prepostoId, papel: "REPRESENTANTE" }),
      org,
      false,
      { busca: "", status: "todos", pagina: 0 },
    );

    expect(doDono.quantos).toBe(3);
    expect(doPreposto.quantos).toBe(1);
  });
});
