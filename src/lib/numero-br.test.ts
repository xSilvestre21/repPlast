/**
 * Testes da leitura de números digitados.
 *
 * O caso de "50.000" nasceu de um bug real: ao cadastrar uma faixa de comissão
 * de cinquenta mil reais, o sistema gravou cinquenta reais.
 */

import { describe, expect, it } from "vitest";

import { ErroDeCampo } from "./erro-formulario";
import {
  escreverNumeroBr,
  exigirNumero,
  exigirNumeroDe,
  lerNumeroBr,
  limparNumeroDigitado,
} from "./numero-br";

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
    expect(escreverNumeroBr(13.5, 0, 0)).toBe("14");
    expect(escreverNumeroBr(13.4, 0, 0)).toBe("13");
  });

  it("não corta a precisão de um preço que vai voltar ao servidor", () => {
    // O milheiro do item 1 do pedido 2253. Cortar para centavos aqui faria o
    // total do item fechar em 10.649,22 em vez de 10.649,23.
    expect(escreverNumeroBr(1774.872, 2, 6)).toBe("1.774,872");
    expect(lerNumeroBr(escreverNumeroBr(1774.872, 2, 6))).toBe(1774.872);
  });

  it("mantém o mínimo de casas em valores redondos", () => {
    expect(escreverNumeroBr(1134, 2, 6)).toBe("1.134,00");
    expect(lerNumeroBr(escreverNumeroBr(1134, 2, 6))).toBe(1134);
  });

  it("faz a ida e volta sem perder o valor", () => {
    // Sem casas fixas, para não arredondar. O caso de 50000 é o que garante
    // que "50.000" volte como cinquenta mil, e não como cinquenta.
    for (const valor of [13.5, 9.75, 50000, 0.08, 1774.872]) {
      expect(lerNumeroBr(escreverNumeroBr(valor))).toBe(valor);
    }
  });
});

describe("exigirNumero", () => {
  const dados = (valor: string) => {
    const formData = new FormData();
    formData.set("ipi", valor);
    return formData;
  };

  /** O erro lançado, para conferir campo e frase de uma vez. */
  function recusa(valor: string, opcoes: Parameters<typeof exigirNumeroDe>[3] = {}) {
    try {
      exigirNumeroDe(valor, "ipi", "o IPI", opcoes);
    } catch (erro) {
      if (erro instanceof ErroDeCampo) return erro;
      throw erro;
    }
    throw new Error("devia ter recusado");
  }

  it("lê o número no padrão brasileiro", () => {
    expect(exigirNumero(dados("12,5"), "ipi", "o IPI")).toBe(12.5);
  });

  it("vazio é null quando o campo é opcional, e recusa quando é obrigatório", () => {
    expect(exigirNumero(dados("  "), "ipi", "o IPI")).toBeNull();
    expect(recusa("", { obrigatorio: true }).message).toBe("Informe o IPI.");
  });

  it("texto que não é número é recusado — antes virava 0 sem aviso", () => {
    const erro = recusa("abc", { min: 0, max: 100 });

    expect(erro.campo).toBe("ipi");
    expect(erro.message).toMatch(/Não reconheci "abc"/);
  });

  it("fora da faixa diz qual é a faixa", () => {
    expect(recusa("150", { min: 0, max: 100 }).message).toBe("O IPI precisa ficar entre 0 e 100.");
    expect(recusa("-1", { min: 0 }).message).toMatch(/^O IPI não pode ficar abaixo de zero/);
  });

  it("inteiro recusa vírgula", () => {
    expect(recusa("10,5", { inteiro: true }).message).toMatch(/número inteiro/);
  });
});

describe("limparNumeroDigitado", () => {
  it("tira a letra e deixa o número: 20L vira 20", () => {
    expect(limparNumeroDigitado("20L", "decimal")).toBe("20");
    expect(limparNumeroDigitado("abc", "decimal")).toBe("");
  });

  it("guarda vírgula decimal e ponto de milhar", () => {
    expect(limparNumeroDigitado("1.250,50", "decimal")).toBe("1.250,50");
    expect(limparNumeroDigitado("0,08", "decimal")).toBe("0,08");
    expect(limparNumeroDigitado("13.5", "decimal")).toBe("13.5");
  });

  it("guarda o zero da frente: a sanfona 09 continua 09", () => {
    expect(limparNumeroDigitado("09", "decimal")).toBe("09");
  });

  it("fica só com a primeira vírgula", () => {
    expect(limparNumeroDigitado("1,2,3", "decimal")).toBe("1,23");
  });

  it("tira moeda, espaço e sinal: nenhum campo aceita negativo", () => {
    expect(limparNumeroDigitado("R$ 1.250,00", "decimal")).toBe("1.250,00");
    expect(limparNumeroDigitado("-5", "decimal")).toBe("5");
  });

  it("no inteiro, só dígitos", () => {
    expect(limparNumeroDigitado("12,5", "inteiro")).toBe("125");
    expect(limparNumeroDigitado("587x", "inteiro")).toBe("587");
  });

  it("o que a limpeza deixa, a leitura entende", () => {
    for (const texto of ["20L", "1.250,50kg", "0,08mm", "R$ 13,50"]) {
      expect(lerNumeroBr(limparNumeroDigitado(texto, "decimal"))).not.toBeNull();
    }
  });
});
