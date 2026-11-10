import { describe, expect, test } from "vitest";

import { casaComBusca, chaveDaLinha } from "./busca";

const linha = { numero: 2253, cliente: "Panificadora Conceição", preposto: "Davi Rocha" };

describe("casaComBusca", () => {
  test("sem nada digitado, tudo casa", () => {
    expect(casaComBusca(linha, "")).toBe(true);
    expect(casaComBusca(linha, "   ")).toBe(true);
  });

  test("o número inteiro acha, com ou sem #", () => {
    expect(casaComBusca(linha, "2253")).toBe(true);
    expect(casaComBusca(linha, "#2253")).toBe(true);
    expect(casaComBusca(linha, " # 2253 ")).toBe(true);
  });

  test("um pedaço do número também acha: não é preciso digitar tudo", () => {
    expect(casaComBusca({ ...linha, numero: 2224 }, "22")).toBe(true);
    expect(casaComBusca({ ...linha, numero: 2224 }, "#22")).toBe(true);
    expect(casaComBusca({ ...linha, numero: 2224 }, "224")).toBe(true);
    expect(casaComBusca({ ...linha, numero: 2224 }, "23")).toBe(false);
  });

  test("número e cliente juntos: os dois têm de bater", () => {
    expect(casaComBusca(linha, "22 conceicao")).toBe(true);
    expect(casaComBusca(linha, "22 orion")).toBe(false);
  });

  test("o cliente casa sem acento, sem caixa e por pedaço", () => {
    expect(casaComBusca(linha, "conceicao")).toBe(true);
    expect(casaComBusca(linha, "PANIF")).toBe(true);
    expect(casaComBusca(linha, "padaria")).toBe(false);
  });

  test("vários termos: todos têm de aparecer, em qualquer ordem", () => {
    expect(casaComBusca(linha, "conceição panificadora")).toBe(true);
    expect(casaComBusca(linha, "conceição padaria")).toBe(false);
  });

  test("o preposto também é procurado, quando a linha o tem", () => {
    expect(casaComBusca(linha, "davi")).toBe(true);
    expect(casaComBusca({ ...linha, preposto: null }, "davi")).toBe(false);
  });

  test("cliente com número no nome continua achável pelo número digitado", () => {
    expect(casaComBusca({ numero: 8, cliente: "PLAST 2000", preposto: null }, "2000")).toBe(true);
  });
});

describe("chaveDaLinha", () => {
  test("o pedido inteiro e cada parcela têm chaves diferentes", () => {
    expect(chaveDaLinha("p1", null)).toBe("p1:");
    expect(chaveDaLinha("p1", 2)).toBe("p1:2");
    expect(chaveDaLinha("p1", 2)).not.toBe(chaveDaLinha("p1", 3));
  });
});
