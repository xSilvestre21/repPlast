/**
 * Testes da leitura de números digitados.
 *
 * O caso de "50.000" nasceu de um bug real: ao cadastrar uma faixa de comissão
 * de cinquenta mil reais, o sistema gravou cinquenta reais.
 */

import { describe, expect, it } from "vitest";

import { escreverNumeroBr, lerNumeroBr } from "./numero-br";

describe("lerNumeroBr", () => {
  it("lê vírgula como separador decimal", () => {
    expect(lerNumeroBr("13,50")).toBe(13.5);
    expect(lerNumeroBr("0,08")).toBe(0.08);
    expect(lerNumeroBr("9,75")).toBe(9.75);
  });

  it("lê ponto como milhar quando a vírgula está presente", () => {
    expect(lerNumeroBr("1.234,56")).toBe(1234.56);
    expect(lerNumeroBr("1.234.567,89")).toBe(1234567.89);
  });

  it("lê agrupamento de milhar sem vírgula — o bug da faixa de comissão", () => {
    expect(lerNumeroBr("50.000")).toBe(50000);
    expect(lerNumeroBr("1.234.567")).toBe(1234567);
    expect(lerNumeroBr("9.999")).toBe(9999);
  });

  it("continua aceitando ponto decimal no padrão inglês", () => {
    expect(lerNumeroBr("13.5")).toBe(13.5);
    expect(lerNumeroBr("0.08")).toBe(0.08);
    expect(lerNumeroBr("1774.872")).toBe(1774.872);
  });

  it("lê inteiros e negativos", () => {
    expect(lerNumeroBr("99")).toBe(99);
    expect(lerNumeroBr("-12,5")).toBe(-12.5);
  });

  it("devolve null para entrada vazia ou inválida", () => {
    expect(lerNumeroBr("")).toBeNull();
    expect(lerNumeroBr("   ")).toBeNull();
    expect(lerNumeroBr("abc")).toBeNull();
    expect(lerNumeroBr("12abc")).toBeNull();
    expect(lerNumeroBr(null)).toBeNull();
    expect(lerNumeroBr(undefined)).toBeNull();
  });

  it("aceita número direto", () => {
    expect(lerNumeroBr(13.5)).toBe(13.5);
    expect(lerNumeroBr(Number.NaN)).toBeNull();
  });
});

describe("escreverNumeroBr", () => {
  it("escreve com vírgula decimal", () => {
    expect(escreverNumeroBr("13.5", 2)).toBe("13,50");
    expect(escreverNumeroBr("9.75")).toBe("9,75");
  });

  it("devolve vazio para valor ausente", () => {
    expect(escreverNumeroBr(null)).toBe("");
    expect(escreverNumeroBr("")).toBe("");
  });

  it("arredonda quando se pede um número fixo de casas", () => {
    expect(escreverNumeroBr(13.5, 0)).toBe("14");
    expect(escreverNumeroBr(13.4, 0)).toBe("13");
  });

  it("faz a ida e volta sem perder o valor", () => {
    // Sem casas fixas, para não arredondar. O caso de 50000 é o que garante
    // que "50.000" volte como cinquenta mil, e não como cinquenta.
    for (const valor of [13.5, 9.75, 50000, 0.08, 1774.872]) {
      expect(lerNumeroBr(escreverNumeroBr(valor))).toBe(valor);
    }
  });
});
