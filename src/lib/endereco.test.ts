import { describe, expect, test } from "vitest";

import { enderecoCompleto } from "./endereco";

describe("enderecoCompleto", () => {
  test("rua, número e complemento numa linha", () => {
    expect(enderecoCompleto({ endereco: "Rua Alvares Cabral", numero: "1151", complemento: "Galpão F" })).toBe(
      "Rua Alvares Cabral, 1151 - Galpão F",
    );
  });

  test("sem complemento, só rua e número", () => {
    expect(enderecoCompleto({ endereco: "Rua D", numero: "400", complemento: null })).toBe("Rua D, 400");
  });

  test("sem número — o endereço que ficou inteiro na rua — sai como está", () => {
    expect(enderecoCompleto({ endereco: "Rodovia Comendador Pedro Monteleone, Km 172", numero: null, complemento: "" })).toBe(
      "Rodovia Comendador Pedro Monteleone, Km 172",
    );
  });

  test("sem rua, o que houver; nada, nulo", () => {
    expect(enderecoCompleto({ endereco: null, numero: "  ", complemento: "Sala 3" })).toBe("Sala 3");
    expect(enderecoCompleto({ endereco: null, numero: null, complemento: null })).toBeNull();
  });
});
