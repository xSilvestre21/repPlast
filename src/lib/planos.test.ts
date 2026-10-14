/**
 * Testes da mensalidade. É o valor que vai para a cobrança no Asaas.
 */

import { describe, expect, it } from "vitest";

import { planoDaUrl, prepostosExtras, valorMensal } from "./planos";

describe("valorMensal", () => {
  it("Solo custa o preço base, sem preposto", () => {
    expect(valorMensal("PADRAO").toString()).toBe("79");
  });

  it("Solo ignora preposto que tenha sobrado de quando era Max", () => {
    expect(valorMensal("PADRAO", 4).toString()).toBe("79");
    expect(prepostosExtras("PADRAO", 4)).toBe(0);
  });

  it("Max cobre até 3 prepostos na mensalidade", () => {
    expect(valorMensal("PLUS", 0).toString()).toBe("189");
    expect(valorMensal("PLUS", 3).toString()).toBe("189");
  });

  it("Max cobra cada preposto além do terceiro", () => {
    expect(prepostosExtras("PLUS", 5)).toBe(2);
    expect(valorMensal("PLUS", 5).toString()).toBe("287");
  });
});

describe("planoDaUrl", () => {
  it("reconhece os dois planos", () => {
    expect(planoDaUrl("solo")?.codigo).toBe("PADRAO");
    expect(planoDaUrl("max")?.codigo).toBe("PLUS");
  });

  it("recusa o que não é plano", () => {
    expect(planoDaUrl("PLUS")).toBeNull();
    expect(planoDaUrl(undefined)).toBeNull();
  });
});
