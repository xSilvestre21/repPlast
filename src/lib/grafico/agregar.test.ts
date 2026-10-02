/**
 * As agregações dos gráficos — e a promessa principal: o mês aqui é o mês da
 * tela de Comissões, centavo a centavo.
 */

import { describe, expect, it } from "vitest";

import { resumirComissao, type PedidoDaComissao } from "@/lib/comissao-consulta";

import {
  acumular,
  doPreposto,
  gradeClienteMes,
  industriaCliente,
  kpisDoMes,
  mesesAte,
  noPeriodo,
  porCliente,
  reais,
  somaPorMes,
} from "./agregar";
import type { ItemGrafico } from "./base";
import { centavos, itemDoGrafico } from "./item";

const MARIA = { id: "u1", nome: "Maria", papel: "REPRESENTANTE" };

function pedido(dados: Partial<PedidoDaComissao> & { id: string }): PedidoDaComissao {
  return {
    numero: 1,
    status: "ENVIADO",
    motivoCancelamento: null,
    criadoEm: new Date("2026-09-03T12:00:00Z"),
    enviadoEm: null,
    prazoEntrega: null,
    entregueEm: null,
    subtotalSemIpi: "1000",
    comissaoPercentual: "5",
    comissaoPercentualPreposto: null,
    representante: null,
    valorRecebido: null,
    comissaoPercentualRecebido: null,
    cliente: { id: "c1", apelido: "ALBRAS" },
    fornecedor: { id: "f1", nome: "QUALYPLAST", comissaoPercentual: "5" },
    prazoPagamento: null,
    competencia: "2026-10",
    parcela: null,
    vendaDoPedido: "1000",
    parcelasDoPedido: [],
    ...dados,
  };
}

/** Um mês com pedido da casa, de preposto, acertado a menos e sem acerto. */
const PEDIDOS: PedidoDaComissao[] = [
  pedido({ id: "p1", subtotalSemIpi: "21989.23" }),
  pedido({
    id: "p2",
    subtotalSemIpi: "1234.57",
    comissaoPercentual: "3.75",
    comissaoPercentualPreposto: "33.33",
    representante: MARIA,
    valorRecebido: "1200.01",
    comissaoPercentualRecebido: "3.5",
    cliente: { id: "c2", apelido: "JVC" },
  }),
  pedido({
    id: "p3",
    subtotalSemIpi: "987.65",
    comissaoPercentualPreposto: "50",
    representante: MARIA,
    fornecedor: { id: "f2", nome: "LEMEPACK", comissaoPercentual: "4" },
    comissaoPercentual: "4",
  }),
];

const ADMIN = { ehAdmin: true, comPreposto: true };
const PREPOSTO = { ehAdmin: false, comPreposto: false };

describe("paridade com a tela de Comissões", () => {
  it("o administrador vê o líquido do escritório, igual às caixas de lá", () => {
    const k = kpisDoMes(
      PEDIDOS.map((p) => itemDoGrafico(p, ADMIN)),
      "2026-10",
    );
    const r = resumirComissao(PEDIDOS);

    expect(k.previsto).toBe(centavos(r.previstoDoEscritorio));
    expect(k.recebido).toBe(centavos(r.recebidoDoEscritorio));
    expect(k.aAcertar).toBe(centavos(r.aAcertarDoEscritorio));
    expect(k.diferenca).toBe(centavos(r.diferencaDoEscritorio));
  });

  it("o preposto vê a fatia dele, igual às caixas da tela dele", () => {
    const k = kpisDoMes(
      PEDIDOS.map((p) => itemDoGrafico(p, PREPOSTO)),
      "2026-10",
    );
    const r = resumirComissao(PEDIDOS);

    expect(k.previsto).toBe(centavos(r.previstoDoPreposto));
    expect(k.recebido).toBe(centavos(r.recebidoDoPreposto));
    expect(k.aAcertar).toBe(centavos(r.aAcertarDoPreposto));
    expect(k.diferenca).toBe(centavos(r.diferencaDoPreposto));
  });

  it("o item do preposto não carrega o bruto do escritório nem o id do preposto", () => {
    const item = itemDoGrafico(PEDIDOS[1], PREPOSTO);

    expect(item.bruto).toBeNull();
    expect(item.brutoRecebido).toBeNull();
    expect(item.prepostoId).toBeNull();
  });

  it("fatia do preposto mais o líquido do escritório dão o bruto", () => {
    for (const p of PEDIDOS) {
      const item = itemDoGrafico(p, ADMIN);
      expect(doPreposto(item, "previsto", "fatia") + item.previsto).toBe(item.bruto);
    }
  });

  it("a comissão gerada pelo preposto é o bruto do pedido dele, e zero no da casa", () => {
    const [casa, dele] = PEDIDOS.map((p) => itemDoGrafico(p, ADMIN));

    expect(doPreposto(casa, "previsto", "gerada")).toBe(0);
    expect(doPreposto(dele, "previsto", "gerada")).toBe(dele.bruto);
  });
});

describe("períodos", () => {
  it("os n meses que terminam no mês, virando o ano", () => {
    expect(mesesAte("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("filtra pelos meses do período", () => {
    const lista = [{ competencia: "2026-09" }, { competencia: "2026-10" }];
    expect(noPeriodo(lista, ["2026-10"])).toHaveLength(1);
  });

  it("mês sem item é zero, não buraco", () => {
    const lista = [{ competencia: "2026-08", v: 5 }];
    expect(somaPorMes(lista, ["2026-08", "2026-09"], (i) => i.v)).toEqual([5, 0]);
  });

  it("acumula a série", () => {
    expect(acumular([1, 2, 3])).toEqual([1, 3, 6]);
  });
});

describe("rankings e hierarquia", () => {
  const itens = PEDIDOS.map((p) => itemDoGrafico(p, ADMIN));

  it("por cliente, do maior para o menor, contando pedidos", () => {
    const ranking = porCliente(itens, "previsto");

    expect(ranking[0].rotulo).toBe("ALBRAS");
    expect(ranking.map((f) => f.valor)).toEqual(
      [...ranking.map((f) => f.valor)].sort((a, b) => b - a),
    );
    expect(ranking.reduce((acc, f) => acc + f.pedidos, 0)).toBe(3);
  });

  it("recebido conta zero para quem não tem acerto", () => {
    const ranking = porCliente(itens, "recebido");
    expect(ranking.find((f) => f.rotulo === "ALBRAS")?.valor).toBe(0);
  });

  it("o sunburst soma nos anéis de fora o mesmo que no de dentro", () => {
    for (const industria of industriaCliente(itens, "previsto")) {
      const filhos = industria.children!.reduce((acc, c) => acc + c.value, 0);
      expect(filhos).toBe(industria.value);
    }
  });
});

describe("mapa de calor cliente × mês", () => {
  const item = (cliente: string, competencia: string, previsto: number): ItemGrafico => ({
    pedidoId: `${cliente}-${competencia}`,
    numero: 1,
    competencia,
    clienteId: cliente,
    cliente,
    fornecedorId: "f",
    fornecedor: "F",
    prepostoId: null,
    previsto,
    recebido: null,
    bruto: null,
    brutoRecebido: null,
  });

  it("uma célula por cliente e mês, com zero onde não comprou", () => {
    const grade = gradeClienteMes(
      [item("A", "2026-09", 500), item("B", "2026-10", 100)],
      ["2026-09", "2026-10"],
      "previsto",
      10,
    );

    expect(grade.linhas.map((l) => l.rotulo)).toEqual(["A", "B"]);
    expect(grade.celulas).toContainEqual([1, 0, 0]);
    expect(grade.celulas).toHaveLength(4);
    expect(grade.maximo).toBe(500);
  });

  it("corta nos maiores", () => {
    const grade = gradeClienteMes(
      [item("A", "2026-10", 1), item("B", "2026-10", 2), item("C", "2026-10", 3)],
      ["2026-10"],
      "previsto",
      2,
    );

    expect(grade.linhas.map((l) => l.rotulo)).toEqual(["C", "B"]);
  });
});

describe("centavos", () => {
  it("convertem ida e volta sem erro de ponto flutuante", () => {
    expect(centavos("0.1")).toBe(10);
    expect(centavos("659.68")).toBe(65968);
    expect(reais(65968)).toBe(659.68);
  });
});
