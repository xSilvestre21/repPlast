import { describe, expect, it, test } from "vitest";

import {
  PAGAMENTO_VAZIO,
  chaveCabeNaMascara,
  mascaraDaChavePix,
  normalizarChavePix,
  textoDoPagamento,
} from "./dados-pagamento";

const COMPLETO = {
  tipoChavePix: "CNPJ",
  chavePix: "12.345.678/0001-95",
  banco: "Itaú",
  agencia: "1234",
  conta: "56789-0",
  tipoConta: "CORRENTE",
  favorecido: "INDÚSTRIA EXEMPLO LTDA",
  documento: "12.345.678/0001-95",
  observacoes: "Boleto: pedir ao financeiro@exemplo.com.br",
};

describe("textoDoPagamento", () => {
  test("tudo preenchido: PIX, banco, favorecido e observações, uma coisa por linha", () => {
    expect(textoDoPagamento(COMPLETO)).toBe(
      [
        "PIX (CNPJ): 12.345.678/0001-95",
        "Banco: Itaú · Agência: 1234 · Conta corrente: 56789-0",
        "Favorecido: INDÚSTRIA EXEMPLO LTDA · CNPJ: 12.345.678/0001-95",
        "Boleto: pedir ao financeiro@exemplo.com.br",
      ].join("\n"),
    );
  });

  test("só o PIX, sem o tipo da chave", () => {
    expect(textoDoPagamento({ ...PAGAMENTO_VAZIO, chavePix: " financeiro@exemplo.com.br " })).toBe(
      "PIX: financeiro@exemplo.com.br",
    );
  });

  test("conta sem tipo sai como Conta; poupança com o nome", () => {
    expect(textoDoPagamento({ ...PAGAMENTO_VAZIO, banco: "Caixa", conta: "1-2" })).toBe("Banco: Caixa · Conta: 1-2");
    expect(textoDoPagamento({ ...PAGAMENTO_VAZIO, conta: "1-2", tipoConta: "POUPANCA" })).toBe("Poupança: 1-2");
  });

  test("CPF pelo número de dígitos", () => {
    expect(textoDoPagamento({ ...PAGAMENTO_VAZIO, favorecido: "João", documento: "123.456.789-09" })).toBe(
      "Favorecido: João · CPF: 123.456.789-09",
    );
  });

  test("nada preenchido, texto vazio", () => {
    expect(textoDoPagamento(PAGAMENTO_VAZIO)).toBe("");
  });
});

describe("normalizarChavePix", () => {
  it("CPF e CNPJ saem pontuados; o celular, como telefone", () => {
    expect(normalizarChavePix("CNPJ", "12345678000195")).toBe("12.345.678/0001-95");
    expect(normalizarChavePix("CPF", "123.456.789-09")).toBe("123.456.789-09");
    expect(normalizarChavePix("CELULAR", "11912345678")).toBe("(11) 91234-5678");
    expect(normalizarChavePix("CELULAR", "+55 11 91234-5678")).toBe("(11) 91234-5678");
  });

  it("e-mail e chave aleatória em minúsculas; sem tipo, como veio", () => {
    expect(normalizarChavePix("EMAIL", " Financeiro@Industria.com.br ")).toBe("financeiro@industria.com.br");
    expect(normalizarChavePix("ALEATORIA", "123E4567-E89B-12D3-A456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
    expect(normalizarChavePix(null, "qualquer coisa")).toBe("qualquer coisa");
  });

  it("vazia é null, com ou sem tipo", () => {
    expect(normalizarChavePix("CNPJ", "  ")).toBeNull();
    expect(normalizarChavePix(null, null)).toBeNull();
  });

  it.each([
    ["CNPJ", "123.456.789-09", /CNPJ: são 14 números/],
    ["CPF", "12.345.678/0001-95", /CPF: são 11 números/],
    ["CNPJ", "financeiro@industria.com.br", /CNPJ/],
    ["CELULAR", "(11) 3456-7890", /celular/],
    ["EMAIL", "financeiro.industria.com.br", /e-mail/],
    ["ALEATORIA", "abc", /32 letras e números/],
  ])("recusa a chave que não é do tipo: %s %s", (tipo, chave, frase) => {
    expect(() => normalizarChavePix(tipo, chave)).toThrow(frase);
  });
});

describe("mascaraDaChavePix", () => {
  it("pontua CPF, CNPJ e celular enquanto se digita; o resto fica como escrito", () => {
    expect(mascaraDaChavePix("CNPJ")?.("12345678")).toBe("12.345.678");
    expect(mascaraDaChavePix("CELULAR")?.("1191234")).toBe("(11) 9123-4");
    expect(mascaraDaChavePix("EMAIL")).toBeNull();
    expect(mascaraDaChavePix("")).toBeNull();
  });

  it("só remascara o que é número", () => {
    expect(chaveCabeNaMascara("12.345.678/0001-95")).toBe(true);
    expect(chaveCabeNaMascara("financeiro@industria.com.br")).toBe(false);
    expect(chaveCabeNaMascara("")).toBe(false);
  });
});
