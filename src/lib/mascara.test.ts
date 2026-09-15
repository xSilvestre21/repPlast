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

import {
  mascararCep,
  mascararDocumento,
  mascararTelefone,
  normalizarCep,
  normalizarDocumento,
  normalizarTelefone,
  somenteDigitos,
} from "./mascara";

describe("mascararDocumento", () => {
  it("monta o CNPJ", () => {
    expect(mascararDocumento("09507378000150")).toBe("09.507.378/0001-50");
    expect(mascararDocumento("10781464000136")).toBe("10.781.464/0001-36");
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
    expect(mascararDocumento("09.507.378/0001-50")).toBe("09.507.378/0001-50");
    expect(mascararDocumento("123.456.789-09")).toBe("123.456.789-09");
  });

  it("descarta o que passa de 14 dígitos", () => {
    expect(mascararDocumento("095073780001509999")).toBe("09.507.378/0001-50");
  });
});

describe("mascararTelefone", () => {
  it("monta o fixo com 10 dígitos", () => {
    expect(mascararTelefone("1733215900")).toBe("(17) 3321-5900");
    expect(mascararTelefone("1140431468")).toBe("(11) 4043-1468");
  });

  it("monta o celular com 11 dígitos", () => {
    expect(mascararTelefone("19996873399")).toBe("(19) 99687-3399");
    expect(mascararTelefone("15981160572")).toBe("(15) 98116-0572");
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
    expect(mascararTelefone("19996873399")).toBe("(19) 99687-3399");
  });

  it("ignora a pontuação já digitada", () => {
    expect(mascararTelefone("(17) 3321-5900")).toBe("(17) 3321-5900");
  });

  it("descarta o que passa de 11 dígitos", () => {
    expect(mascararTelefone("199968733990000")).toBe("(19) 99687-3399");
  });

  it("sai da frente quando começa com zero — nenhum DDD começa assim", () => {
    expect(mascararTelefone("0800 704 1234")).toBe("0800 704 1234");
    expect(mascararTelefone("0")).toBe("0");
  });
});

describe("mascararCep", () => {
  it("monta o CEP", () => {
    expect(mascararCep("14781160")).toBe("14781-160");
    expect(mascararCep("09991000")).toBe("09991-000");
  });

  it("acompanha a digitação", () => {
    expect(mascararCep("")).toBe("");
    expect(mascararCep("147")).toBe("147");
    expect(mascararCep("14781")).toBe("14781");
    expect(mascararCep("147811")).toBe("14781-1");
  });

  it("ignora a pontuação já digitada e descarta o que passa de 8 dígitos", () => {
    expect(mascararCep("14781-160")).toBe("14781-160");
    expect(mascararCep("147811609999")).toBe("14781-160");
  });
});

describe("normalizarCep", () => {
  it("grava sempre pontuado", () => {
    expect(normalizarCep("14781160")).toBe("14781-160");
    expect(normalizarCep("14781-160")).toBe("14781-160");
    expect(normalizarCep(" 14.781-160 ")).toBe("14781-160");
  });

  it("devolve null quando o campo veio vazio", () => {
    expect(normalizarCep("")).toBeNull();
    expect(normalizarCep("   ")).toBeNull();
  });

  it("recusa contagem que não fecha", () => {
    expect(() => normalizarCep("1478116")).toThrow(/8 dígitos/);
  });
});

describe("normalizarDocumento", () => {
  it("grava sempre pontuado, venha como vier", () => {
    expect(normalizarDocumento("09507378000150")).toBe("09.507.378/0001-50");
    expect(normalizarDocumento("09.507.378/0001-50")).toBe("09.507.378/0001-50");
    expect(normalizarDocumento("  09 507 378 0001 50 ")).toBe("09.507.378/0001-50");
  });

  it("aceita CPF", () => {
    expect(normalizarDocumento("12345678909")).toBe("123.456.789-09");
  });

  it("devolve null quando o campo veio vazio", () => {
    expect(normalizarDocumento("")).toBeNull();
    expect(normalizarDocumento("   ")).toBeNull();
  });

  it("recusa contagem que não fecha — o documento sai impresso no pedido", () => {
    expect(() => normalizarDocumento("0950737800015")).toThrow(/CNPJ|CPF/);
    expect(() => normalizarDocumento("123456789")).toThrow(/CNPJ|CPF/);
  });
});

describe("normalizarTelefone", () => {
  it("padroniza fixo e celular", () => {
    expect(normalizarTelefone("1733215900")).toBe("(17) 3321-5900");
    expect(normalizarTelefone("19996873399")).toBe("(19) 99687-3399");
  });

  it("devolve null quando o campo veio vazio", () => {
    expect(normalizarTelefone("")).toBeNull();
    expect(normalizarTelefone("   ")).toBeNull();
  });

  it("preserva o que não cabe na máscara em vez de remontar errado", () => {
    expect(normalizarTelefone("0800 704 1234")).toBe("0800 704 1234");
    expect(normalizarTelefone("(17) 3321-5900 ramal 12")).toBe("(17) 3321-5900 ramal 12");
    expect(normalizarTelefone("+1 555 0100")).toBe("+1 555 0100");
  });
});

describe("somenteDigitos", () => {
  it("tira tudo que não é dígito", () => {
    expect(somenteDigitos("09.507.378/0001-50")).toBe("09507378000150");
    expect(somenteDigitos("(17) 3321-5900")).toBe("1733215900");
    expect(somenteDigitos("nenhum")).toBe("");
  });
});
