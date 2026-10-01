/**
 * Testes do parcelamento do recebimento.
 *
 * Os casos de prazo são os que estão gravados de verdade no cadastro importado
 * do SICOV — é com eles que o editor abre preenchido.
 */

import { describe, expect, it } from "vitest";

import {
  dividirIgual,
  lerPrazoEmDias,
  problemaNasParcelas,
  restanteDaBase,
  somarDias,
} from "./parcelas";

describe("lerPrazoEmDias", () => {
  it("lê o prazo como ele aparece no cadastro", () => {
    expect(lerPrazoEmDias("28/35/42")).toEqual([28, 35, 42]);
    expect(lerPrazoEmDias("35/42/49/56")).toEqual([35, 42, 49, 56]);
    expect(lerPrazoEmDias("28 dias")).toEqual([28]);
    expect(lerPrazoEmDias("28/35/42 cheque")).toEqual([28, 35, 42]);
    expect(lerPrazoEmDias("28/35/42 (Cheques)")).toEqual([28, 35, 42]);
    expect(lerPrazoEmDias("0/20")).toEqual([0, 20]);
  });

  it("à vista é uma parcela no dia da entrega", () => {
    expect(lerPrazoEmDias("À VISTA")).toEqual([0]);
    expect(lerPrazoEmDias("A vista")).toEqual([0]);
  });

  it("não inventa dias onde o prazo não é lista de dias", () => {
    expect(lerPrazoEmDias("Antecipado")).toBeNull();
    expect(lerPrazoEmDias("50% antecipado e 50% à vista")).toBeNull();
    expect(lerPrazoEmDias("42/28")).toBeNull();
    expect(lerPrazoEmDias("")).toBeNull();
    expect(lerPrazoEmDias(null)).toBeNull();
  });
});

describe("somarDias", () => {
  it("conta a partir da entrega, como o SICOV", () => {
    // O #142: entrega em 27/07, prazo 28/35/42.
    expect([28, 35, 42].map((d) => somarDias("2026-07-27", d))).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
    ]);
  });

  it("vira o mês e o ano sem escorregar pelo fuso", () => {
    expect(somarDias("2026-10-10", 20)).toBe("2026-10-30");
    expect(somarDias("2026-12-20", 15)).toBe("2027-01-04");
  });
});

describe("dividirIgual", () => {
  it("divide em partes iguais", () => {
    expect(dividirIgual("9765", 3)).toEqual(["3255.00", "3255.00", "3255.00"]);
  });

  it("os centavos que sobram vão para a última, e a soma fecha", () => {
    expect(dividirIgual("100", 3)).toEqual(["33.33", "33.33", "33.34"]);
    expect(dividirIgual("0.05", 2)).toEqual(["0.02", "0.03"]);
  });
});

describe("restanteDaBase", () => {
  it("põe para frente o que se tirou das anteriores", () => {
    expect(restanteDaBase("9765", ["2000", "3255"]).toFixed(2)).toBe("4510.00");
  });

  it("fica negativo quando as anteriores já passaram da venda", () => {
    expect(restanteDaBase("100", ["80", "30"]).isNegative()).toBe(true);
  });
});

describe("problemaNasParcelas", () => {
  const parcelas = [
    { vencimento: "2026-10-10", base: "60" },
    { vencimento: "2026-10-30", base: "40" },
  ];

  it("aceita parcelas que fecham com a venda no centavo", () => {
    expect(problemaNasParcelas("100", parcelas)).toBeNull();
  });

  it("recusa soma diferente da venda, dizendo quanto", () => {
    expect(problemaNasParcelas("100.01", parcelas)).toMatch(/faltam R\$ 0,01/);
    expect(problemaNasParcelas("99", parcelas)).toMatch(/passam da venda em R\$ 1,00/);
  });

  it("recusa parcela sem data, sem valor ou sozinha", () => {
    expect(problemaNasParcelas("100", [parcelas[0], { vencimento: "", base: "40" }])).toMatch(
      /data da parcela 2/,
    );
    expect(problemaNasParcelas("60", [parcelas[0], { vencimento: "2026-10-30", base: "0" }])).toMatch(
      /parcela 2 precisa ter valor/,
    );
    expect(problemaNasParcelas("60", [parcelas[0]])).toMatch(/duas vezes/);
  });
});
