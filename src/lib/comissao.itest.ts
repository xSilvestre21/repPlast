/**
 * Testes de integração da apuração de comissão.
 *
 * O motor de cálculo já é coberto por `comissao.test.ts`. Aqui o que se testa é
 * a FIAÇÃO: se os pedidos certos entram na conta, se a faixa mensal é aplicada
 * sobre a soma do mês, e se cancelar tira o pedido da apuração.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { recalcularApuracao } from "./comissao-apuracao";
import { dbAdministrativo, dbParaOrganizacao } from "./db";

const admin = dbAdministrativo();

let organizacaoId = "";
let fornecedorId = "";
let clienteId = "";

const COMPETENCIA = "2026-05";
const NO_MES = new Date(2026, 4, 15, 12);
const MES_SEGUINTE = new Date(2026, 5, 2, 12);

/** Cria um pedido já enviado, com o subtotal informado. */
async function pedidoEnviado(opcoes: {
  numero: number;
  subtotal: string;
  enviadoEm?: Date;
  comissaoPercentual?: string;
  status?: "ENVIADO" | "CANCELADO";
}) {
  return admin.pedido.create({
    data: {
      organizacaoId,
      fornecedorId,
      clienteId,
      numero: opcoes.numero,
      status: opcoes.status ?? "ENVIADO",
      enviadoEm: opcoes.enviadoEm ?? NO_MES,
      subtotalSemIpi: opcoes.subtotal,
      pesoTotalKg: "100",
      comissaoPercentual: opcoes.comissaoPercentual ?? null,
    },
    select: { id: true },
  });
}

async function apuracaoDoMes() {
  const db = dbParaOrganizacao(organizacaoId);
  await recalcularApuracao(db, organizacaoId, fornecedorId, COMPETENCIA);

  return admin.comissaoApuracao.findFirst({
    where: { fornecedorId, competencia: COMPETENCIA },
  });
}

beforeEach(async () => {
  // Cada teste começa do zero: a apuração é do mês inteiro, e sobra de um
  // teste mudaria a faixa do seguinte.
  if (organizacaoId) await admin.organizacao.deleteMany({ where: { id: organizacaoId } });

  const organizacao = await admin.organizacao.create({ data: { nome: "Teste comissão" } });
  organizacaoId = organizacao.id;

  const fornecedor = await admin.fornecedor.create({
    data: {
      organizacaoId,
      nome: "Indústria com faixa",
      comissaoPercentual: "3",
      modoFaixa: "PROGRESSIVA",
      unidadeMeta: "REAIS",
      faixas: { create: [{ minimo: "50000", percentual: "4.5" }] },
    },
  });
  fornecedorId = fornecedor.id;

  const cliente = await admin.cliente.create({
    data: { organizacaoId, apelido: "CLI", razaoSocial: "Cliente LTDA" },
  });
  clienteId = cliente.id;
});

afterAll(async () => {
  if (organizacaoId) await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

describe("apuração mensal", () => {
  it("abaixo da faixa rende a comissão base", async () => {
    await pedidoEnviado({ numero: 1, subtotal: "21989.23" });

    const apuracao = await apuracaoDoMes();

    expect(apuracao?.baseReais.toString()).toBe("21989.23");
    expect(Number(apuracao?.percentualAplicado)).toBe(3);
    expect(apuracao?.valorComissao.toString()).toBe("659.68");
  });

  it("soma os pedidos do mês e aplica a faixa progressiva ao conjunto", async () => {
    // 3 × 21.989,23 = 65.967,69 — cruza a faixa de 50.000.
    await pedidoEnviado({ numero: 1, subtotal: "21989.23" });
    await pedidoEnviado({ numero: 2, subtotal: "21989.23" });
    await pedidoEnviado({ numero: 3, subtotal: "21989.23" });

    const apuracao = await apuracaoDoMes();

    expect(apuracao?.baseReais.toString()).toBe("65967.69");
    // 50.000 a 3% = 1.500 · 15.967,69 a 4,5% = 718,55.
    expect(apuracao?.valorComissao.toString()).toBe("2218.55");
  });

  it("ignora pedido de outro mês", async () => {
    await pedidoEnviado({ numero: 1, subtotal: "21989.23" });
    await pedidoEnviado({ numero: 2, subtotal: "40000", enviadoEm: MES_SEGUINTE });

    const apuracao = await apuracaoDoMes();

    expect(apuracao?.baseReais.toString()).toBe("21989.23");
  });

  it("cancelar tira o pedido da conta", async () => {
    await pedidoEnviado({ numero: 1, subtotal: "30000" });
    const cancelado = await pedidoEnviado({ numero: 2, subtotal: "30000" });

    const antes = await apuracaoDoMes();
    expect(antes?.baseReais.toString()).toBe("60000");

    await admin.pedido.update({
      where: { id: cancelado.id },
      data: { status: "CANCELADO", canceladoEm: new Date() },
    });

    const depois = await apuracaoDoMes();

    expect(depois?.baseReais.toString()).toBe("30000");
    // Sem o segundo pedido o mês volta para abaixo da faixa: 30.000 a 3%.
    expect(depois?.valorComissao.toString()).toBe("900");
  });

  it("pedido aberto ainda não conta", async () => {
    await pedidoEnviado({ numero: 1, subtotal: "30000" });

    await admin.pedido.create({
      data: {
        organizacaoId,
        fornecedorId,
        clienteId,
        numero: 2,
        status: "ABERTO",
        subtotalSemIpi: "90000",
      },
    });

    const apuracao = await apuracaoDoMes();

    expect(apuracao?.baseReais.toString()).toBe("30000");
  });
});

describe("percentual combinado no pedido", () => {
  it("rende o próprio percentual, mas continua contando para a faixa", async () => {
    // O pedido de exceção soma volume (é venda) e por isso empurra o mês para
    // cima da faixa — mas ele mesmo rende os 2% combinados.
    await pedidoEnviado({ numero: 1, subtotal: "40000", comissaoPercentual: "2" });
    await pedidoEnviado({ numero: 2, subtotal: "20000" });

    const apuracao = await apuracaoDoMes();

    expect(apuracao?.baseReais.toString()).toBe("60000");

    // Volume 60.000 na progressiva: (50.000×3 + 10.000×4,5) / 60.000 = 3,25%.
    // Exceção: 40.000 × 2% = 800. Regra da faixa: 20.000 × 3,25% = 650.
    expect(apuracao?.valorComissao.toString()).toBe("1450");
  });
});

describe("detalhamento por pedido", () => {
  it("gera um lançamento por pedido que conta", async () => {
    await pedidoEnviado({ numero: 1, subtotal: "10000" });
    await pedidoEnviado({ numero: 2, subtotal: "20000" });

    const apuracao = await apuracaoDoMes();

    const lancamentos = await admin.comissaoLancamento.findMany({
      where: { apuracaoId: apuracao!.id },
      orderBy: { base: "asc" },
    });

    expect(lancamentos).toHaveLength(2);
    expect(lancamentos.map((l) => l.base.toString())).toEqual(["10000", "20000"]);
    expect(lancamentos.every((l) => l.tipo === "LANCAMENTO")).toBe(true);
  });

  it("refaz os lançamentos a cada apuração, sem duplicar", async () => {
    await pedidoEnviado({ numero: 1, subtotal: "10000" });

    await apuracaoDoMes();
    const apuracao = await apuracaoDoMes();

    const lancamentos = await admin.comissaoLancamento.count({
      where: { apuracaoId: apuracao!.id },
    });

    expect(lancamentos).toBe(1);
  });
});
