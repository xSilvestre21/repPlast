import { describe, expect, test } from "vitest";

import { PAGAMENTO_VAZIO, textoDoPagamento } from "./dados-pagamento";

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
