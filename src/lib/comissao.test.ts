/**
 * Testes da comissão e da meta pessoal.
 *
 * Os valores partem do pedido real 2253: base R$ 21.989,23 e 3% da QUALYPLAST.
 */

import { describe, expect, it } from "vitest";

import {
  comissaoDoPedido,
  competenciaDe,
  deslocarCompetencia,
  intervaloDaCompetencia,
  progressoDaMeta,
  somarComissao,
} from "./comissao";

describe("comissão de um pedido", () => {
  it("aplica o percentual sobre a base do pedido real", () => {
    expect(comissaoDoPedido("21989.23", 3).toFixed(2)).toBe("659.68");
  });

  it("arredonda em centavos", () => {
    // 21.989,23 × 3% = 659,6769.
    expect(comissaoDoPedido("21989.23", 3).toString()).toBe("659.68");
  });

  it("aceita percentual fracionário", () => {
    expect(comissaoDoPedido(10000, "3.5").toFixed(2)).toBe("350.00");
  });

  it("percentual zero não gera comissão", () => {
    expect(comissaoDoPedido("21989.23", 0).toFixed(2)).toBe("0.00");
  });
});

describe("soma de vários pedidos", () => {
  it("cada pedido rende o próprio percentual", () => {
    const resumo = somarComissao([
      { base: "20000", percentual: 3 },
      { base: "10000", percentual: 5 },
    ]);

    expect(resumo.base.toFixed(2)).toBe("30000.00");
    // 600 + 500.
    expect(resumo.valor.toFixed(2)).toBe("1100.00");
  });

  it("o percentual médio reflete a mistura", () => {
    const resumo = somarComissao([
      { base: "20000", percentual: 3 },
      { base: "10000", percentual: 5 },
    ]);

    // 1.100 sobre 30.000 = 3,6667%.
    expect(resumo.percentualMedio.toFixed(4)).toBe("3.6667");
  });

  it("com percentual único o médio é o próprio percentual", () => {
    const resumo = somarComissao([
      { base: "10000", percentual: 3 },
      { base: "30000", percentual: 3 },
    ]);

    expect(resumo.percentualMedio.toFixed(2)).toBe("3.00");
  });

  it("mês sem pedido não quebra a divisão", () => {
    const resumo = somarComissao([]);

    expect(resumo.base.toFixed(2)).toBe("0.00");
    expect(resumo.valor.toFixed(2)).toBe("0.00");
    expect(resumo.percentualMedio.toFixed(2)).toBe("0.00");
  });
});

describe("meta pessoal", () => {
  it("mede o progresso rumo à meta", () => {
    const progresso = progressoDaMeta("8000", "2000");

    expect(progresso?.percentual).toBe(25);
    expect(progresso?.batida).toBe(false);
    expect(progresso?.falta.toFixed(2)).toBe("6000.00");
  });

  it("bate exatamente no valor da meta", () => {
    const progresso = progressoDaMeta("8000", "8000");

    expect(progresso?.batida).toBe(true);
    expect(progresso?.percentual).toBe(100);
    expect(progresso?.falta.toFixed(2)).toBe("0.00");
  });

  it("passar da meta não estoura a barra nem gera falta negativa", () => {
    const progresso = progressoDaMeta("8000", "12000");

    expect(progresso?.batida).toBe(true);
    expect(progresso?.percentual).toBe(100);
    expect(progresso?.falta.toFixed(2)).toBe("0.00");
  });

  it("sem meta definida não há progresso a mostrar", () => {
    expect(progressoDaMeta(null, "5000")).toBeNull();
    expect(progressoDaMeta(undefined, "5000")).toBeNull();
    expect(progressoDaMeta("", "5000")).toBeNull();
  });

  it("meta zero ou negativa é tratada como ausente", () => {
    expect(progressoDaMeta(0, "5000")).toBeNull();
    expect(progressoDaMeta(-100, "5000")).toBeNull();
  });
});

describe("competência", () => {
  it("formata como AAAA-MM", () => {
    expect(competenciaDe(new Date(2026, 8, 10))).toBe("2026-09");
    expect(competenciaDe(new Date(2026, 11, 31))).toBe("2026-12");
  });

  it("o intervalo cobre o mês e para no primeiro dia do seguinte", () => {
    const { de, ate } = intervaloDaCompetencia("2026-09");

    expect(de.getMonth()).toBe(8);
    expect(de.getDate()).toBe(1);
    expect(ate.getMonth()).toBe(9);
    expect(ate.getDate()).toBe(1);
  });

  it("anda meses virando o ano", () => {
    expect(deslocarCompetencia("2026-01", -1)).toBe("2025-12");
    expect(deslocarCompetencia("2026-12", 1)).toBe("2027-01");
    expect(deslocarCompetencia("2026-09", 3)).toBe("2026-12");
  });
});
