/**
 * Testes de integração do pedido de amostra.
 *
 * O que se protege é a promessa feita ao representante: a amostra vai para a
 * indústria sem preço e fica fora de tudo que mede venda — comissão, metas e
 * gráficos (que saem todos de `pedidosDaCompetencia`/`pedidosDoIntervalo`), os
 * cancelados da apuração e a última compra do cliente. E que o preço zero é
 * garantido no servidor, não só escondido na tela.
 *
 * As consultas rodam com o papel restrito; as ações, com a sessão simulada pelo
 * cliente administrativo, como em `orcamentos/avulso.itest.ts`.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts amostra.itest
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { type Ator, dbAdministrativo, dbParaOrganizacao } from "@/lib/db";

import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();
const sessao = { organizacaoId: "", usuarioId: "" };

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: sessao.organizacaoId,
    usuarioId: sessao.usuarioId,
    papel: "ADMIN",
    ehAdmin: true,
    plano: "PADRAO",
    db: admin,
  }),
  exigirAdmin: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { adicionarItem, alternarAmostra } = await import("./acoes");
const { salvarAcerto, salvarParcelas } = await import("../comissoes/acoes");
const { canceladosDaCompetencia, pedidosDaCompetencia, pedidosDoIntervalo } = await import(
  "@/lib/comissao-consulta"
);
const { clientesComUltimaCompra } = await import("../graficos/consultas");

let dono: Ator = { usuarioId: "", papel: "ADMIN" };
let clienteId = "";
let fornecedorId = "";
let produtoId = "";
let vendaId = "";
let amostraEnviadaId = "";
let amostraAbertaId = "";

const ENTREGA = new Date("2026-09-15T00:00:00.000Z");

function formulario(campos: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [campo, valor] of Object.entries(campos)) formData.set(campo, valor);
  return formData;
}

beforeAll(async () => {
  const organizacao = await admin.organizacao.create({ data: { nome: nomeDeTeste("Escritório da Amostra") } });
  sessao.organizacaoId = organizacao.id;
  const usuario = await admin.usuario.create({
    data: {
      organizacaoId: organizacao.id,
      nome: "Dono",
      email: `dono-${organizacao.id}@teste.local`,
      senhaHash: "x",
      papel: "ADMIN",
    },
  });
  sessao.usuarioId = usuario.id;
  dono = { usuarioId: usuario.id, papel: "ADMIN" };

  // Só a amostra compra deste cliente: se ela contasse como compra, ele
  // apareceria em `clientesComUltimaCompra`.
  const [cliente, soAmostra] = await Promise.all([
    admin.cliente.create({ data: { organizacaoId: organizacao.id, apelido: "COMPRADOR", razaoSocial: "Comprador LTDA" } }),
    admin.cliente.create({ data: { organizacaoId: organizacao.id, apelido: "SO-AMOSTRA", razaoSocial: "Só Amostra LTDA" } }),
  ]);
  clienteId = cliente.id;

  const fornecedor = await admin.fornecedor.create({
    data: { organizacaoId: organizacao.id, nome: "INDUSTRIA", comissaoPercentual: "5" },
  });
  fornecedorId = fornecedor.id;

  const produto = await admin.produto.create({
    data: {
      organizacaoId: organizacao.id,
      fornecedorId,
      clienteId,
      familia: "STRETCH",
      descricao: "STRETCH 50CM",
      precoKg: "10",
    },
  });
  produtoId = produto.id;

  const base = {
    organizacaoId: organizacao.id,
    fornecedorId,
    status: "ENVIADO" as const,
    prazoEntrega: ENTREGA,
    enviadoEm: ENTREGA,
    emElaboracao: false,
  };

  const venda = await admin.pedido.create({
    data: { ...base, clienteId, numero: 1, subtotalSemIpi: "1000", totalGeral: "1000" },
  });
  vendaId = venda.id;

  const amostraEnviada = await admin.pedido.create({
    data: { ...base, clienteId: soAmostra.id, numero: 2, amostra: true },
  });
  amostraEnviadaId = amostraEnviada.id;

  await admin.pedido.create({
    data: { ...base, clienteId, numero: 3, amostra: true, status: "CANCELADO", canceladoEm: ENTREGA },
  });

  const amostraAberta = await admin.pedido.create({
    data: { ...base, clienteId, numero: 4, amostra: true, status: "ABERTO", enviadoEm: null },
  });
  amostraAbertaId = amostraAberta.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: sessao.organizacaoId } });
});

describe("a amostra fica fora do que mede venda", () => {
  it("não entra na apuração do mês nem na janela dos gráficos", async () => {
    const db = dbParaOrganizacao(sessao.organizacaoId, dono);

    const doMes = await pedidosDaCompetencia(db, sessao.organizacaoId, "2026-09");
    const daJanela = await pedidosDoIntervalo(db, sessao.organizacaoId, "2026-07", "2026-10");

    expect(doMes.map((p) => p.numero)).toEqual([1]);
    expect(daJanela.map((p) => p.numero)).toEqual([1]);
  });

  it("a amostra cancelada não aparece entre os cancelados da apuração", async () => {
    const db = dbParaOrganizacao(sessao.organizacaoId, dono);
    expect(await canceladosDaCompetencia(db, sessao.organizacaoId, "2026-09")).toHaveLength(0);
  });

  it("o cliente que só recebeu amostra não conta como comprador", async () => {
    const db = dbParaOrganizacao(sessao.organizacaoId, dono);
    const clientes = await clientesComUltimaCompra(db, sessao.organizacaoId);
    expect(clientes.map((c) => c.apelido)).toEqual(["COMPRADOR"]);
  });
});

describe("o preço da amostra é zero no servidor", () => {
  it("o item entra zerado mesmo com preço digitado", async () => {
    const estado = await adicionarItem(
      amostraAbertaId,
      {},
      formulario({ produtoId, unidade: "KG", quantidade: "5", precoUnitario: "12,50" }),
    );

    expect(estado.erro).toBeUndefined();
    const pedido = await admin.pedido.findUniqueOrThrow({
      where: { id: amostraAbertaId },
      select: { totalGeral: true, itens: { select: { precoUnitario: true } } },
    });
    expect(pedido.itens.map((i) => i.precoUnitario.toString())).toEqual(["0"]);
    expect(pedido.totalGeral.toString()).toBe("0");
  });

  it("desligar a amostra recalcula o preço pelo cadastro, e ligar de novo zera", async () => {
    expect((await alternarAmostra(amostraAbertaId, {}, new FormData())).erro).toBeUndefined();
    const venda = await admin.pedido.findUniqueOrThrow({
      where: { id: amostraAbertaId },
      select: { amostra: true, totalGeral: true, itens: { select: { precoUnitario: true } } },
    });
    expect(venda.amostra).toBe(false);
    expect(venda.itens.map((i) => Number(i.precoUnitario))).toEqual([10]);
    expect(Number(venda.totalGeral)).toBeGreaterThan(0);

    expect((await alternarAmostra(amostraAbertaId, {}, new FormData())).erro).toBeUndefined();
    const amostra = await admin.pedido.findUniqueOrThrow({
      where: { id: amostraAbertaId },
      select: { amostra: true, totalGeral: true, itens: { select: { precoUnitario: true } } },
    });
    expect(amostra.amostra).toBe(true);
    expect(amostra.itens.map((i) => i.precoUnitario.toString())).toEqual(["0"]);
    expect(amostra.totalGeral.toString()).toBe("0");
  });

  it("a amostra enviada está travada como qualquer pedido", async () => {
    const estado = await alternarAmostra(amostraEnviadaId, {}, new FormData());
    expect(estado.erro).toMatch(/já foi enviado/);
  });
});

describe("a amostra não tem comissão a lançar", () => {
  it("recusa o acerto", async () => {
    const estado = await salvarAcerto(
      amostraEnviadaId,
      {},
      formulario({ valorRecebido: "100", comissaoPercentualRecebido: "5" }),
    );
    expect(estado.erro).toMatch(/amostra não tem comissão/);
  });

  it("recusa o parcelamento", async () => {
    const formData = formulario({ vencimento: "2026-10-15", base: "0" });
    const estado = await salvarParcelas(amostraEnviadaId, {}, formData);
    expect(estado.erro).toMatch(/amostra não tem comissão/);
  });

  it("a venda continua aceitando o acerto", async () => {
    const estado = await salvarAcerto(
      vendaId,
      {},
      formulario({ valorRecebido: "1000", comissaoPercentualRecebido: "5" }),
    );
    expect(estado.erro).toBeUndefined();
  });
});
