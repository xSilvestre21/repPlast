import { describe, expect, it } from "vitest";

import { faixasDoPrefixo, type Faixa } from "./prefixo-medida";

const casa = (faixas: Faixa[] | null, valor: number) =>
  (faixas ?? []).some((f) => valor >= f.gte && valor < f.lt);

describe("faixasDoPrefixo", () => {
  it("o 1 do comprimento acha 1, 15, 110 e 160, e não 90 nem 2", () => {
    const faixas = faixasDoPrefixo("1");
    for (const valor of [1, 1.5, 15, 110, 160, 1000]) expect(casa(faixas, valor)).toBe(true);
    for (const valor of [2, 90, 0.5, 210]) expect(casa(faixas, valor)).toBe(false);
  });

  it("cada dígito a mais estreita", () => {
    const faixas = faixasDoPrefixo("11");
    expect(casa(faixas, 110)).toBe(true);
    expect(casa(faixas, 11)).toBe(true);
    expect(casa(faixas, 15)).toBe(false);
    expect(casa(faixas, 160)).toBe(false);
  });

  it("depois da vírgula a parte inteira fecha", () => {
    const faixas = faixasDoPrefixo("0,05");
    expect(casa(faixas, 0.05)).toBe(true);
    expect(casa(faixas, 0.055)).toBe(true);
    expect(casa(faixas, 0.06)).toBe(false);
    expect(casa(faixas, 0.5)).toBe(false);
  });

  it("vírgula sem casa ainda é a parte inteira inteira", () => {
    const faixas = faixasDoPrefixo("0,");
    expect(casa(faixas, 0.08)).toBe(true);
    expect(casa(faixas, 1)).toBe(false);
  });

  it("aceita ponto como decimal, como a medida exata", () => {
    expect(faixasDoPrefixo("0.05")).toEqual(faixasDoPrefixo("0,05"));
  });

  it("texto que não começa número nenhum não filtra", () => {
    expect(faixasDoPrefixo("abc")).toBeNull();
    expect(faixasDoPrefixo("")).toBeNull();
    expect(faixasDoPrefixo(",5")).toBeNull();
  });
});
