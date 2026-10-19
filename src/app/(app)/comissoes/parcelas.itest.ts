/**
 * Testes de integração do fechamento do faturamento nas parcelas.
 *
 * O que se protege: com o fechamento gravado no pedido, o pedido inteiro (ou
 * cada parcela) conta no mês em que a indústria paga — e a consulta do mês o
 * TRAZ, mesmo com a data dois meses antes. Sem fechamento, nada muda de mês. O
 * fechamento é do pedido: desfazer o parcelamento não o apaga. E o acerto
 * lançado errado se desfaz pelo botão.
 *
 * As ações rodam com o papel restrito (`dbParaOrganizacao`), não como dono do
 * banco, que passaria por cima do RLS.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts parcelas.itest
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { pedidosDaCompetencia } from "@/lib/comissao-consulta";
import { type Ator, dbAdministrativo, dbParaOrganizacao } from "@/lib/db";

import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();
const DONO: Ator = { usuarioId: "00000000-0000-0000-0000-000000000000", papel: "ADMIN" };

let org = "";
let pedidoId = "";

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: org,
    usuarioId: DONO.usuarioId,
    papel: "ADMIN",
    ehAdmin: true,
    plano: "PRO",
    db: dbParaOrganizacao(org, DONO),
  }),
  exigirAdmin: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { desfazerParcelas, salvarAcerto, salvarParcelas } = await import("./acoes");

beforeAll(async () => {
  const o = await admin.organizacao.create({
    data: { nome: nomeDeTeste("Escritório do Fechamento"), plano: "PLUS" },
  });
  org = o.id;

  const cliente = await admin.cliente.create({
    data: { organizacaoId: org, apelido: "CLI", razaoSocial: "Cliente LTDA" },
  });
  const fornecedor = await admin.fornecedor.create({
    data: { organizacaoId: org, nome: "INDUSTRIA", comissaoPercentual: "5", diaFechamentoComissao: 30 },
  });

  const pedido = await admin.pedido.create({
    data: {
      organizacaoId: org,
      fornecedorId: fornecedor.id,
      clienteId: cliente.id,
      numero: 1,
      status: "ENVIADO",
      prazoEntrega: new Date("2027-03-15T00:00:00.000Z"),
      subtotalSemIpi: "1000",
    },
  });
  pedidoId = pedido.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

function parcelas(campos: Record<string, string>, linhas: [string, string][]) {
  const formData = new FormData();
  for (const [nome, valor] of Object.entries(campos)) formData.set(nome, valor);
  for (const [vencimento, base] of linhas) {
    formData.append("vencimento", vencimento);
    formData.append("base", base);
  }
  return formData;
}

/** Os números das parcelas que contam no mês, como a tela de Comissões vê. */
async function noMes(competencia: string) {
  const itens = await pedidosDaCompetencia(dbParaOrganizacao(org, DONO), org, competencia);
  return itens.map((i) => i.parcela?.numero);
}

describe("fechamento do faturamento", () => {
  it("sem fechamento, cada parcela conta no mês do vencimento", async () => {
    const estado = await salvarParcelas(
      pedidoId,
      {},
      parcelas({ pagamento: "vencimento" }, [
        ["2027-04-10", "500,00"],
        ["2027-04-25", "500,00"],
      ]),
    );
    expect(estado.erro).toBeUndefined();

    expect(await noMes("2027-04")).toEqual([1, 2]);
    expect(await noMes("2027-05")).toEqual([]);
  });

  it("fechamento 20: até o dia 20 conta no mês seguinte, depois dele dois meses à frente", async () => {
    const estado = await salvarParcelas(
      pedidoId,
      {},
      parcelas({ pagamento: "seguinte", diaFechamentoComissao: "20" }, [
        ["2027-04-10", "500,00"],
        ["2027-04-25", "500,00"],
      ]),
    );
    expect(estado.erro).toBeUndefined();

    const pedido = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(pedido.diaFechamentoComissao).toBe(20);

    expect(await noMes("2027-04")).toEqual([]);
    expect(await noMes("2027-05")).toEqual([1]);
    // Vence em abril e conta em junho: a consulta de junho precisa buscá-la.
    expect(await noMes("2027-06")).toEqual([2]);
  });

  it("recusa o dia que não existe, embaixo do campo", async () => {
    const estado = await salvarParcelas(
      pedidoId,
      {},
      parcelas({ pagamento: "seguinte", diaFechamentoComissao: "40" }, [
        ["2027-04-10", "500,00"],
        ["2027-04-25", "500,00"],
      ]),
    );
    expect(estado.campo).toBe("diaFechamentoComissao");
    expect(estado.erro).toMatch(/entre 1 e 31/);

    const pedido = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(pedido.diaFechamentoComissao).toBe(20);
  });

  it("desfazer o parcelamento mantém o fechamento, que vale para o pedido inteiro", async () => {
    const estado = await desfazerParcelas(pedidoId, {}, new FormData());
    expect(estado.erro).toBeUndefined();

    const pedido = await admin.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      include: { parcelas: true },
    });
    expect(pedido.diaFechamentoComissao).toBe(20);
    expect(pedido.parcelas).toEqual([]);
    // Entregue em 15/03, fechamento 20: conta em abril, não em março.
    expect(await noMes("2027-03")).toEqual([]);
    expect(await noMes("2027-04")).toEqual([undefined]);
  });
});

function acerto(campos: Record<string, string>) {
  const formData = new FormData();
  for (const [nome, valor] of Object.entries(campos)) formData.set(nome, valor);
  return formData;
}

describe("acerto do pedido inteiro", () => {
  it("a exceção: no mês do vencimento, o pedido volta para o mês da entrega", async () => {
    const estado = await salvarAcerto(
      pedidoId,
      {},
      acerto({ valorRecebido: "", comissaoPercentualRecebido: "", entregueEm: "", pagamento: "vencimento" }),
    );
    expect(estado.erro).toBeUndefined();

    expect(await noMes("2027-03")).toEqual([undefined]);
    expect(await noMes("2027-04")).toEqual([]);
  });

  it("“desfazer acerto” apaga o valor e o %, sejam quais forem os campos", async () => {
    await salvarAcerto(
      pedidoId,
      {},
      acerto({
        valorRecebido: "1.000,00",
        comissaoPercentualRecebido: "50",
        entregueEm: "2027-03-16",
        pagamento: "seguinte",
        diaFechamentoComissao: "30",
      }),
    );
    let pedido = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(pedido.comissaoPercentualRecebido?.toString()).toBe("50");
    expect(pedido.diaFechamentoComissao).toBe(30);

    // O % errado continua no campo quando se clica em desfazer.
    const estado = await salvarAcerto(
      pedidoId,
      {},
      acerto({
        valorRecebido: "1.000,00",
        comissaoPercentualRecebido: "50",
        entregueEm: "2027-03-16",
        pagamento: "seguinte",
        diaFechamentoComissao: "30",
        desfazer: "sim",
      }),
    );
    expect(estado.erro).toBeUndefined();

    pedido = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(pedido.valorRecebido).toBeNull();
    expect(pedido.comissaoPercentualRecebido).toBeNull();
    expect(pedido.entregueEm?.toISOString().slice(0, 10)).toBe("2027-03-16");
  });
});
