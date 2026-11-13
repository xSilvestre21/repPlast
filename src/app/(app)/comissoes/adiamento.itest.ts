/**
 * Testes de integração do pagamento que atrasou ("não pago" e "recebe em").
 *
 * O que se protege:
 *   - o dinheiro conta UMA vez: o pedido adiado soma só no mês em que a
 *     indústria paga, e no mês dele aparece (`adiadosDaCompetencia`) sem somar;
 *   - o "não pago" sem previsão não muda nada de mês, e aparece nos meses
 *     seguintes (`pendentesAnteriores`) até o acerto;
 *   - o acerto de quem estava atrasado diz o mês em que a indústria pagou;
 *   - a data de entrega salva sozinha, sem valor recebido — era o que não dava;
 *   - a parcela atrasa sozinha, sem levar as outras.
 *
 * As ações rodam com o papel restrito (`dbParaOrganizacao`), não como dono do
 * banco, que passaria por cima do RLS.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts adiamento.itest
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  adiadosDaCompetencia,
  pedidosDaCompetencia,
  pendentesAnteriores,
  resumirComissao,
} from "@/lib/comissao-consulta";
import { type Ator, dbAdministrativo, dbParaOrganizacao } from "@/lib/db";

import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();
const DONO: Ator = { usuarioId: "00000000-0000-0000-0000-000000000000", papel: "ADMIN" };

let org = "";
/** O pedido de agosto, de R$ 1.000 a 5%: R$ 50 de comissão. */
let pedidoId = "";
/** Outro, de setembro, que será parcelado. */
let parceladoId = "";

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

const {
  desmarcarNaoPago,
  marcarNaoPago,
  marcarParcelaNaoPaga,
  salvarAcerto,
  salvarAcertoParcela,
  salvarEntrega,
  salvarParcelas,
} = await import("./acoes");

beforeAll(async () => {
  const o = await admin.organizacao.create({
    data: { nome: nomeDeTeste("Escritório do Atraso"), plano: "PLUS" },
  });
  org = o.id;

  const cliente = await admin.cliente.create({
    data: { organizacaoId: org, apelido: "CLI", razaoSocial: "Cliente LTDA" },
  });
  const fornecedor = await admin.fornecedor.create({
    data: { organizacaoId: org, nome: "INDUSTRIA", comissaoPercentual: "5" },
  });

  const base = {
    organizacaoId: org,
    fornecedorId: fornecedor.id,
    clienteId: cliente.id,
    status: "ENVIADO" as const,
    comissaoPercentual: "5",
    subtotalSemIpi: "1000",
  };
  pedidoId = (
    await admin.pedido.create({
      data: { ...base, numero: 1, prazoEntrega: new Date("2027-08-10T00:00:00.000Z") },
    })
  ).id;
  parceladoId = (
    await admin.pedido.create({
      data: { ...base, numero: 2, prazoEntrega: new Date("2027-09-01T00:00:00.000Z") },
    })
  ).id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

function form(campos: Record<string, string>) {
  const formData = new FormData();
  for (const [nome, valor] of Object.entries(campos)) formData.set(nome, valor);
  return formData;
}

const db = () => dbParaOrganizacao(org, DONO);

/** Os pedidos (e parcelas) que SOMAM no mês: "1", "2/1"… */
async function somam(competencia: string) {
  const itens = await pedidosDaCompetencia(db(), org, competencia);
  return itens.map((i) => (i.parcela ? `${i.numero}/${i.parcela.numero}` : `${i.numero}`));
}

async function previsto(competencia: string) {
  return resumirComissao(await pedidosDaCompetencia(db(), org, competencia)).valor.toFixed(2);
}

async function aparecemAdiados(competencia: string) {
  const itens = await adiadosDaCompetencia(db(), org, competencia);
  return itens.map((i) => (i.parcela ? `${i.numero}/${i.parcela.numero}` : `${i.numero}`));
}

async function pendentes(competencia: string) {
  const itens = await pendentesAnteriores(db(), org, competencia);
  return itens.map((i) => (i.parcela ? `${i.numero}/${i.parcela.numero}` : `${i.numero}`));
}

describe("a data de entrega", () => {
  it("salva sozinha, sem valor recebido", async () => {
    const estado = await salvarEntrega(pedidoId, {}, form({ entregueEm: "2027-08-12" }));
    expect(estado.erro).toBeUndefined();

    const pedido = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(pedido.entregueEm?.toISOString().slice(0, 10)).toBe("2027-08-12");
    expect(pedido.valorRecebido).toBeNull();
  });

  it("recusa a data que não existe, embaixo do campo", async () => {
    const estado = await salvarEntrega(pedidoId, {}, form({ entregueEm: "2027-02-31" }));
    expect(estado.campo).toBe("entregueEm");
  });
});

describe("não pago, sem previsão", () => {
  it("fica no mês dele, somando, e aparece nos meses seguintes como pendente", async () => {
    const estado = await marcarNaoPago(pedidoId, {}, form({ quando: "sem-previsao" }));
    expect(estado.erro).toBeUndefined();

    expect(await somam("2027-08")).toEqual(["1"]);
    expect(await previsto("2027-08")).toBe("50.00");
    // No próprio mês não é "de meses anteriores"; nos seguintes, sim.
    expect(await pendentes("2027-08")).toEqual([]);
    expect(await pendentes("2027-09")).toEqual(["1"]);
    expect(await pendentes("2027-11")).toEqual(["1"]);
    // E não soma em nenhum deles.
    expect(await somam("2027-11")).toEqual([]);
  });
});

describe("recebe em outro mês", () => {
  it("recusa o próprio mês e os anteriores, no campo do mês", async () => {
    const estado = await marcarNaoPago(pedidoId, {}, form({ quando: "mes", mes: "2027-08" }));
    expect(estado.campo).toBe("mes");
    expect(estado.erro).toMatch(/depois de agosto de 2027/);
  });

  it("soma só no mês em que a indústria paga, e continua à vista no mês dele", async () => {
    const estado = await marcarNaoPago(pedidoId, {}, form({ quando: "mes", mes: "2027-11" }));
    expect(estado.erro).toBeUndefined();

    // Agosto: aparece, não soma.
    expect(await somam("2027-08")).toEqual([]);
    expect(await previsto("2027-08")).toBe("0.00");
    expect(await aparecemAdiados("2027-08")).toEqual(["1"]);

    // Novembro: três meses depois da entrega, fora do recuo da consulta — e vem.
    expect(await somam("2027-11")).toEqual(["1"]);
    expect(await previsto("2027-11")).toBe("50.00");
    expect(await aparecemAdiados("2027-11")).toEqual([]);

    // Nos meses do meio, nada; e deixou de ser pendente sem previsão.
    // (setembro tem o outro pedido da massa; outubro, nenhum.)
    expect(await somam("2027-10")).toEqual([]);
    expect(await pendentes("2027-12")).toEqual([]);
  });

  it("o acerto conta no mês adiado, e desfazê-lo não desfaz o adiamento", async () => {
    let estado = await salvarAcerto(
      pedidoId,
      {},
      form({ valorRecebido: "1.000,00", comissaoPercentualRecebido: "5", pagamento: "vencimento" }),
    );
    expect(estado.erro).toBeUndefined();

    const novembro = resumirComissao(await pedidosDaCompetencia(db(), org, "2027-11"));
    expect(novembro.recebido.toFixed(2)).toBe("50.00");
    expect(resumirComissao(await pedidosDaCompetencia(db(), org, "2027-08")).recebido.toFixed(2)).toBe("0.00");

    // Com acerto lançado, não se marca "não pago" por cima.
    estado = await marcarNaoPago(pedidoId, {}, form({ quando: "sem-previsao" }));
    expect(estado.erro).toMatch(/Desfazer acerto/);

    estado = await salvarAcerto(pedidoId, {}, form({ desfazer: "sim", pagamento: "vencimento" }));
    expect(estado.erro).toBeUndefined();
    expect(await somam("2027-11")).toEqual(["1"]);
  });

  it("“em que mês a indústria pagou?”: o acerto leva a comissão para o mês escolhido", async () => {
    await marcarNaoPago(pedidoId, {}, form({ quando: "sem-previsao" }));

    const estado = await salvarAcerto(
      pedidoId,
      {},
      form({
        valorRecebido: "1.000,00",
        comissaoPercentualRecebido: "5",
        pagamento: "vencimento",
        contaEm: "2027-10",
      }),
    );
    expect(estado.erro).toBeUndefined();

    const pedido = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    expect(pedido.comissaoNaoPaga).toBe(false);
    expect(pedido.comissaoAdiadaPara).toBe("2027-10");
    expect(await somam("2027-10")).toEqual(["1"]);
    expect(await pendentes("2027-12")).toEqual([]);
  });

  it("pagou no próprio mês do pedido: o adiamento sai", async () => {
    const estado = await salvarAcerto(
      pedidoId,
      {},
      form({
        valorRecebido: "1.000,00",
        comissaoPercentualRecebido: "5",
        pagamento: "vencimento",
        contaEm: "2027-08",
      }),
    );
    expect(estado.erro).toBeUndefined();
    expect(await somam("2027-08")).toEqual(["1"]);
    expect(await aparecemAdiados("2027-08")).toEqual([]);
  });

  it("desmarcar volta a comissão para o mês dela, mesmo com acerto", async () => {
    await salvarAcerto(
      pedidoId,
      {},
      form({
        valorRecebido: "1.000,00",
        comissaoPercentualRecebido: "5",
        pagamento: "vencimento",
        contaEm: "2027-12",
      }),
    );
    expect(await somam("2027-12")).toEqual(["1"]);

    const estado = await desmarcarNaoPago(pedidoId, {}, new FormData());
    expect(estado.erro).toBeUndefined();
    expect(await somam("2027-08")).toEqual(["1"]);
    expect(await somam("2027-12")).toEqual([]);
  });
});

describe("a parcela que atrasa", () => {
  let parcelas: { id: string; numero: number }[] = [];

  beforeAll(async () => {
    // O pedido inteiro estava marcado: parcelar tira a marca dele.
    await marcarNaoPago(parceladoId, {}, form({ quando: "mes", mes: "2028-01" }));

    const formData = form({ pagamento: "vencimento" });
    for (const [vencimento, base] of [
      ["2027-10-05", "500,00"],
      ["2027-11-05", "500,00"],
    ]) {
      formData.append("vencimento", vencimento);
      formData.append("base", base);
    }
    const estado = await salvarParcelas(parceladoId, {}, formData);
    expect(estado.erro).toBeUndefined();

    parcelas = await admin.parcelaRecebimento.findMany({
      where: { pedidoId: parceladoId },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true },
    });
  });

  it("parcelar tira o adiamento do pedido inteiro", async () => {
    const pedido = await admin.pedido.findUniqueOrThrow({ where: { id: parceladoId } });
    expect(pedido.comissaoAdiadaPara).toBeNull();
    expect(await somam("2027-10")).toContain("2/1");
    expect(await somam("2028-01")).toEqual([]);
  });

  it("não se marca o pedido parcelado inteiro: é na parcela", async () => {
    const estado = await marcarNaoPago(parceladoId, {}, form({ quando: "sem-previsao" }));
    expect(estado.erro).toMatch(/parcela que atrasou/);
  });

  it("adiada, só ela muda de mês; a outra fica", async () => {
    const estado = await marcarParcelaNaoPaga(parcelas[0].id, {}, form({ quando: "mes", mes: "2027-12" }));
    expect(estado.erro).toBeUndefined();

    expect(await somam("2027-10")).not.toContain("2/1");
    expect(await aparecemAdiados("2027-10")).toEqual(["2/1"]);
    expect(await somam("2027-11")).toEqual(["2/2"]);
    expect(await somam("2027-12")).toEqual(["2/1"]);
  });

  it("sem previsão, a parcela fica pendente nos meses seguintes ao dela", async () => {
    const estado = await marcarParcelaNaoPaga(parcelas[1].id, {}, form({ quando: "sem-previsao" }));
    expect(estado.erro).toBeUndefined();

    expect(await pendentes("2027-11")).toEqual([]);
    expect(await pendentes("2027-12")).toEqual(["2/2"]);
  });

  it("o acerto da parcela diz o mês em que a indústria pagou", async () => {
    const estado = await salvarAcertoParcela(
      parcelas[1].id,
      {},
      form({ valorRecebido: "500,00", comissaoPercentualRecebido: "5", contaEm: "2028-02" }),
    );
    expect(estado.erro).toBeUndefined();

    expect(await somam("2028-02")).toEqual(["2/2"]);
    expect(await pendentes("2028-03")).toEqual([]);
  });

  it("a data nova que alcança o mês adiado desfaz o adiamento da parcela", async () => {
    // A parcela 1 estava adiada para dezembro; a data dela passa a ser em dezembro.
    const formData = form({ pagamento: "vencimento" });
    for (const [vencimento, base] of [
      ["2027-12-05", "500,00"],
      ["2027-11-05", "500,00"],
    ]) {
      formData.append("vencimento", vencimento);
      formData.append("base", base);
    }
    const estado = await salvarParcelas(parceladoId, {}, formData);
    expect(estado.erro).toBeUndefined();

    const primeira = await admin.parcelaRecebimento.findUniqueOrThrow({ where: { id: parcelas[0].id } });
    expect(primeira.comissaoAdiadaPara).toBeNull();
    expect(await aparecemAdiados("2027-10")).toEqual([]);
    expect(await somam("2027-12")).toEqual(["2/1"]);
  });
});
