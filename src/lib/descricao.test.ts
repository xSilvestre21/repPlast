/**
 * Testes do gerador de descrição impressa.
 *
 * Todas as fixtures vêm de pedidos reais, em `referencia/`:
 *
 *   2253 / 2256  QUALYPLAST — sacos plásticos
 *   133          ERIPACK    — fita adesiva
 *   146          ERIPACK    — film stretch
 *
 * A descrição é o que o cliente e a indústria leem no papel. Se ela sair
 * diferente do que a indústria está acostumada a receber, o pedido gera
 * dúvida — por isso vale testar contra o texto exato dos pedidos reais.
 */

import { describe, expect, it } from "vitest";

import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "./descricao";

describe("saco plástico — pedidos 2253 e 2256", () => {
  it("monta as três descrições exatamente como saem nos PDFs", () => {
    expect(
      descricaoSaco({
        larguraCm: 99,
        comprimentoCm: 166,
        espessuraMm: 0.08,
        sanfona: "13,50",
        material: "PEAD",
      }),
    ).toBe("99x166x0,08 SF 13,50 PEAD");

    expect(
      descricaoSaco({
        larguraCm: 105,
        comprimentoCm: 100,
        espessuraMm: 0.08,
        sanfona: "15",
        material: "PEAD",
      }),
    ).toBe("105x100x0,08 SF 15 PEAD");

    expect(
      descricaoSaco({
        larguraCm: 77,
        comprimentoCm: 150,
        espessuraMm: 0.05,
        sanfona: "09",
        material: "PEAD",
        adicionais: ["C/ DESLIZANTE"],
      }),
    ).toBe("77x150x0,05 SF 09 PEAD C/ DESLIZANTE");
  });

  it("preserva o zero à esquerda da sanfona, porque é texto digitado", () => {
    const descricao = descricaoSaco({
      larguraCm: 77,
      comprimentoCm: 150,
      espessuraMm: 0.05,
      sanfona: "09",
      material: "PEAD",
    });

    expect(descricao).toContain("SF 09");
  });

  it("saco sem sanfona sai com S/SF, não em silêncio", () => {
    // Quem produz precisa saber que é sem sanfona — a ausência do texto seria
    // lida como campo esquecido. É o que o sistema anterior imprimia.
    expect(
      descricaoSaco({ larguraCm: 40, comprimentoCm: 60, espessuraMm: 0.1, material: "PEBD" }),
    ).toBe("40x60x0,10 S/SF PEBD");
  });

  it("a sanfona sai como foi digitada, com o zero à esquerda", () => {
    // No acervo o mesmo valor aparece como "09" e como "9": é texto digitado,
    // não número formatado, e regravá-lo como número perderia o zero.
    expect(
      descricaoSaco({
        larguraCm: 77,
        comprimentoCm: 110,
        espessuraMm: 0.05,
        sanfona: "09",
        material: "PEAD",
      }),
    ).toBe("77x110x0,05 SF 09 PEAD");
  });
});

describe("fita — pedido 133 da ERIPACK", () => {
  it("reproduz a descrição do pedido real", () => {
    expect(
      descricaoFita({
        material: "Fita adesiva",
        larguraMm: 45,
        metragemM: 100,
        complemento: "transparente",
      }),
    ).toBe("Fita adesiva 45x100 transparente");
  });

  it("não coloca sufixo de unidade nas medidas", () => {
    // O pedido real traz "45x100", e não "45mm x 100m".
    const descricao = descricaoFita({ material: "Fita adesiva", larguraMm: 45, metragemM: 100 });

    expect(descricao).toBe("Fita adesiva 45x100");
    expect(descricao).not.toContain("mm");
  });

  it("omite as partes ausentes", () => {
    expect(descricaoFita({ material: "Fita crepe" })).toBe("Fita crepe");
    expect(descricaoFita({ larguraMm: 48 })).toBe("48");
  });
});

describe("stretch e bobina — pedido 146 da ERIPACK", () => {
  it("reproduz as duas descrições do pedido real", () => {
    expect(
      descricaoRolo({
        material: "FILM STRETCH",
        larguraMm: 500,
        micragem: 25,
        complemento: "BOBINA 4KG PESO LÍQUIDO",
      }),
    ).toBe("FILM STRETCH 500X25 BOBINA 4KG PESO LÍQUIDO");

    expect(
      descricaoRolo({
        material: "FILM STRETCH",
        larguraMm: 500,
        micragem: 25,
        complemento: "BOBINAS 2KG PESO LÍQUIDO",
      }),
    ).toBe("FILM STRETCH 500X25 BOBINAS 2KG PESO LÍQUIDO");
  });

  it("usa X maiúsculo entre as medidas, como a indústria imprime", () => {
    expect(descricaoRolo({ material: "FILM STRETCH", larguraMm: 500, micragem: 25 })).toBe(
      "FILM STRETCH 500X25",
    );
  });

  it("acrescenta os sufixos de aditivo ao fim", () => {
    expect(
      descricaoRolo({
        material: "FILM STRETCH",
        larguraMm: 500,
        adicionais: ["C/ IMPRESSAO"],
      }),
    ).toBe("FILM STRETCH 500 C/ IMPRESSAO");
  });
});

describe("formatarNumero", () => {
  it("mantém as casas decimais da espessura fina", () => {
    expect(formatarNumero(0.006, 2)).toBe("0,006");
    expect(formatarNumero(0.08, 2)).toBe("0,08");
    expect(formatarNumero(99)).toBe("99");
  });
});
