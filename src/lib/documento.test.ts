import { describe, expect, it } from "vitest";

import { cnpjValido, cpfValido, documentoSemPontuacao, problemaNoDocumento } from "./documento";

describe("cpfValido", () => {
  it("aceita CPF com os verificadores certos", () => {
    expect(cpfValido("12345678909")).toBe(true);
  });

  it("recusa verificador errado e os de dígito repetido", () => {
    expect(cpfValido("12345678900")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ numérico", () => {
    expect(cnpjValido("09507378000150")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("aceita o CNPJ alfanumérico do exemplo da Receita", () => {
    expect(cnpjValido("12ABC34501DE35")).toBe(true);
  });

  it("recusa verificador errado, letra no verificador e repetidos", () => {
    expect(cnpjValido("09507378000151")).toBe(false);
    expect(cnpjValido("12ABC34501DE3A")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });
});

describe("problemaNoDocumento", () => {
  it("aceita CPF e CNPJ válidos, com ou sem pontuação", () => {
    expect(problemaNoDocumento(documentoSemPontuacao("123.456.789-09"))).toBeNull();
    expect(problemaNoDocumento(documentoSemPontuacao("12.abc.345/01de-35"))).toBeNull();
  });

  it("diz qual dos dois não confere", () => {
    expect(problemaNoDocumento("12345678900")).toMatch(/Este CPF não existe/);
    expect(problemaNoDocumento("09507378000151")).toMatch(/Este CNPJ não existe/);
  });

  it("conta os caracteres quando o tamanho não fecha", () => {
    expect(problemaNoDocumento("1234567")).toMatch(/foram digitados 7 caracteres/);
    expect(problemaNoDocumento("")).toMatch(/Informe o CPF ou o CNPJ/);
  });
});
