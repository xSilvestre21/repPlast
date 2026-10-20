/**
 * Testes das máscaras.
 *
 * O que mais importa aqui são os estados INTERMEDIÁRIOS: a máscara é aplicada a
 * cada tecla, então "16" e "163" precisam sair certos tanto quanto o número
 * completo. Máscara que só acerta no fim faz a pontuação piscar enquanto se
 * digita.
 *
 * Os valores completos são os que já estão gravados nos clientes cadastrados —
 * é o formato que o PDF do pedido imprime.
 */

import { describe, expect, it } from "vitest";

import { lerNumeroBr } from "./numero-br";
import {
  mascararCep,
  mascararDocumento,
  mascararMoeda,
  mascararTelefone,
  normalizarCep,
  normalizarDocumento,
  normalizarTelefone,
  somenteDigitos,
} from "./mascara";

describe("mascararDocumento", () => {
  it("monta o CNPJ", () => {
    expect(mascararDocumento("12345678000195")).toBe("12.345.678/0001-95");
    expect(mascararDocumento("11444777000161")).toBe("11.444.777/0001-61");
  });

  it("monta o CPF", () => {
    expect(mascararDocumento("12345678909")).toBe("123.456.789-09");
  });

  it("vira CNPJ quando passa de 11 dígitos", () => {
    expect(mascararDocumento("12345678901")).toBe("123.456.789-01");
    expect(mascararDocumento("123456789012")).toBe("12.345.678/9012");
  });

  it("acompanha a digitação sem pendurar pontuação no fim", () => {
    expect(mascararDocumento("")).toBe("");
    expect(mascararDocumento("0")).toBe("0");
    expect(mascararDocumento("095")).toBe("095");
    expect(mascararDocumento("0950")).toBe("095.0");
    expect(mascararDocumento("095073")).toBe("095.073");
    expect(mascararDocumento("0950737")).toBe("095.073.7");
  });

  it("ignora a pontuação já digitada — colar um valor formatado não duplica nada", () => {
    expect(mascararDocumento("12.345.678/0001-95")).toBe("12.345.678/0001-95");
    expect(mascararDocumento("123.456.789-09")).toBe("123.456.789-09");
  });

  it("descarta o que passa de 14 dígitos", () => {
    expect(mascararDocumento("123456780001959999")).toBe("12.345.678/0001-95");
  });
});

describe("mascararTelefone", () => {
  it("monta o fixo com 10 dígitos", () => {
    expect(mascararTelefone("1134567890")).toBe("(11) 3456-7890");
    expect(mascararTelefone("1145678901")).toBe("(11) 4567-8901");
  });

  it("monta o celular com 11 dígitos", () => {
    expect(mascararTelefone("11912345678")).toBe("(11) 91234-5678");
    expect(mascararTelefone("15987654321")).toBe("(15) 98765-4321");
  });

  it("acompanha a digitação", () => {
    expect(mascararTelefone("")).toBe("");
    expect(mascararTelefone("1")).toBe("(1");
    expect(mascararTelefone("17")).toBe("(17");
    expect(mascararTelefone("173")).toBe("(17) 3");
    expect(mascararTelefone("1733")).toBe("(17) 33");
    expect(mascararTelefone("173321")).toBe("(17) 3321");
    expect(mascararTelefone("1733215")).toBe("(17) 3321-5");
  });

  it("move o corte quando o 11º dígito chega", () => {
    expect(mascararTelefone("1999687339")).toBe("(19) 9968-7339");
    expect(mascararTelefone("11912345678")).toBe("(11) 91234-5678");
  });

  it("ignora a pontuação já digitada", () => {
    expect(mascararTelefone("(11) 3456-7890")).toBe("(11) 3456-7890");
  });

  it("descarta o que passa de 11 dígitos", () => {
    expect(mascararTelefone("119123456780000")).toBe("(11) 91234-5678");
  });

  it("sai da frente quando começa com zero — nenhum DDD começa assim", () => {
    expect(mascararTelefone("0800 704 1234")).toBe("0800 704 1234");
    expect(mascararTelefone("0")).toBe("0");
  });
});

describe("mascararCep", () => {
  it("monta o CEP", () => {
    expect(mascararCep("12345678")).toBe("12345-678");
    expect(mascararCep("01234000")).toBe("01234-000");
  });

  it("acompanha a digitação", () => {
    expect(mascararCep("")).toBe("");
    expect(mascararCep("147")).toBe("147");
    expect(mascararCep("14781")).toBe("14781");
    expect(mascararCep("147811")).toBe("14781-1");
  });

  it("ignora a pontuação já digitada e descarta o que passa de 8 dígitos", () => {
    expect(mascararCep("12345-678")).toBe("12345-678");
    expect(mascararCep("123456789999")).toBe("12345-678");
  });
});

describe("mascararMoeda", () => {
  it("entra pela direita como centavos, tecla a tecla", () => {
    expect(["5", "50", "500", "5000", "50000", "500000"].map(mascararMoeda)).toEqual([
      "0,05",
      "0,50",
      "5,00",
      "50,00",
      "500,00",
      "5.000,00",
    ]);
  });

  it("agrupa o milhar", () => {
    expect(mascararMoeda("123456789")).toBe("1.234.567,89");
    expect(mascararMoeda("2000000")).toBe("20.000,00");
  });

  it("reaplicada sobre o próprio resultado, não muda", () => {
    expect(mascararMoeda("20.000,00")).toBe("20.000,00");
    expect(mascararMoeda("0,05")).toBe("0,05");
  });

  it("acompanha o apagar", () => {
    // "5,00" com o último dígito apagado chega como "5,0".
    expect(mascararMoeda("5,0")).toBe("0,50");
    expect(mascararMoeda("0,0")).toBe("");
  });

  it("só zeros, ou nada, é campo vazio", () => {
    expect(mascararMoeda("")).toBe("");
    expect(mascararMoeda("000")).toBe("");
    expect(mascararMoeda("R$ ")).toBe("");
  });

  it("sai num formato que o servidor lê de volta", () => {
    expect(lerNumeroBr(mascararMoeda("123456"))).toBe(1234.56);
    expect(lerNumeroBr(mascararMoeda("2000000"))).toBe(20000);
  });
});

describe("normalizarCep", () => {
  it("grava sempre pontuado", () => {
    expect(normalizarCep("12345678")).toBe("12345-678");
    expect(normalizarCep("12345-678")).toBe("12345-678");
    expect(normalizarCep(" 12.345-678 ")).toBe("12345-678");
  });

  it("devolve null quando o campo veio vazio", () => {
    expect(normalizarCep("")).toBeNull();
    expect(normalizarCep("   ")).toBeNull();
  });

  it("recusa contagem que não fecha", () => {
    expect(() => normalizarCep("1478116")).toThrow(/8 números/);
  });
});

describe("normalizarDocumento", () => {
  it("grava sempre pontuado, venha como vier", () => {
    expect(normalizarDocumento("12345678000195")).toBe("12.345.678/0001-95");
    expect(normalizarDocumento("12.345.678/0001-95")).toBe("12.345.678/0001-95");
    expect(normalizarDocumento("  12 345 678 0001 95 ")).toBe("12.345.678/0001-95");
  });

  it("aceita CPF", () => {
    expect(normalizarDocumento("12345678909")).toBe("123.456.789-09");
  });

  it("devolve null quando o campo veio vazio", () => {
    expect(normalizarDocumento("")).toBeNull();
    expect(normalizarDocumento("   ")).toBeNull();
  });

  it("recusa contagem que não fecha — o documento sai impresso no pedido", () => {
    expect(() => normalizarDocumento("1234567800019")).toThrow(/CNPJ|CPF/);
    expect(() => normalizarDocumento("123456789")).toThrow(/CNPJ|CPF/);
  });
});

describe("normalizarTelefone", () => {
  it("padroniza fixo e celular", () => {
    expect(normalizarTelefone("1134567890")).toBe("(11) 3456-7890");
    expect(normalizarTelefone("11912345678")).toBe("(11) 91234-5678");
  });

  it("devolve null quando o campo veio vazio", () => {
    expect(normalizarTelefone("")).toBeNull();
    expect(normalizarTelefone("   ")).toBeNull();
  });

  it("preserva o que não cabe na máscara em vez de remontar errado", () => {
    expect(normalizarTelefone("0800 704 1234")).toBe("0800 704 1234");
    expect(normalizarTelefone("(11) 3456-7890 ramal 12")).toBe("(11) 3456-7890 ramal 12");
    expect(normalizarTelefone("+1 555 0100")).toBe("+1 555 0100");
  });
});

describe("somenteDigitos", () => {
  it("tira tudo que não é dígito", () => {
    expect(somenteDigitos("12.345.678/0001-95")).toBe("12345678000195");
    expect(somenteDigitos("(11) 3456-7890")).toBe("1134567890");
    expect(somenteDigitos("nenhum")).toBe("");
  });
});
