import { describe, expect, it } from "vitest";

import { emFrase, quantos } from "./quantos";

describe("quantos", () => {
  it("escreve singular e plural", () => {
    expect(quantos(1, "contato", "contatos")).toBe("1 contato");
    expect(quantos(3, "contato", "contatos")).toBe("3 contatos");
    expect(quantos(0, "contato", "contatos")).toBe("0 contatos");
  });
});

describe("emFrase", () => {
  it("emenda com vírgula e o último com “e”", () => {
    expect(emFrase([])).toBe("");
    expect(emFrase(["o logo"])).toBe("o logo");
    expect(emFrase(["2 contatos", "o logo"])).toBe("2 contatos e o logo");
    expect(emFrase(["2 contatos", "3 materiais", "o logo"])).toBe("2 contatos, 3 materiais e o logo");
  });
});
