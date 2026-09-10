/**
 * Testes do motor de preço.
 *
 * As fixtures NÃO são inventadas: são os itens dos pedidos 2253 (MARIOL) e
 * 2256 (LEMEPACK), emitidos pela QUALYPLAST, com os valores exatos que constam
 * nos PDFs em `referencia/`. Se um destes testes quebrar, o sistema passou a
 * calcular diferente do que a indústria recebeu na vida real.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { arredondarDinheiro, fatorEfetivo, precoMilheiroSaco, type Aditivo } from "./precificacao";
import { calcularTotaisPedido, totalItemBruto } from "./totais";
import { descricaoSaco, formatarNumero } from "./descricao";

const IPI_QUALYPLAST = 9.75;

/** Itens reais do pedido 2253 — MARIOL EMBALAGENS. */
const ITEM_2253_A = { larguraCm: 99, comprimentoCm: 166, espessuraMm: 0.08, fatorKg: 13.5 };
const ITEM_2253_B = { larguraCm: 105, comprimentoCm: 100, espessuraMm: 0.08, fatorKg: 13.5 };
/** Item real do pedido 2256 — LEMEPACK, com aditivo deslizante. */
const ITEM_2256 = { larguraCm: 77, comprimentoCm: 150, espessuraMm: 0.05, fatorKg: 15.6 };

const dinheiro = (v: Decimal) => arredondarDinheiro(v).toFixed(2);

describe("preço do milheiro — conferido contra pedidos reais", () => {
  it("item 1 do pedido 2253: 99x166x0,08 a fator 13,50", () => {
    expect(dinheiro(precoMilheiroSaco(ITEM_2253_A))).toBe("1774.87");
  });

  it("item 2 do pedido 2253: 105x100x0,08 a fator 13,50", () => {
    expect(dinheiro(precoMilheiroSaco(ITEM_2253_B))).toBe("1134.00");
  });

  it("item do pedido 2256: 77x150x0,05 a fator 15,60", () => {
    expect(dinheiro(precoMilheiroSaco(ITEM_2256))).toBe("900.90");
  });
});

describe("arredondamento — a armadilha de um centavo", () => {
  it("multiplica pelo preço cheio, não pelo preço já arredondado", () => {
    const precoCheio = precoMilheiroSaco(ITEM_2253_A);
    const totalCorreto = totalItemBruto({ precoUnitario: precoCheio, quantidade: 6 });

    // O que o PDF real traz.
    expect(dinheiro(totalCorreto)).toBe("10649.23");

    // O que sairia se alguém arredondasse antes de multiplicar.
    const totalErrado = new Decimal("1774.87").times(6);
    expect(totalErrado.toFixed(2)).toBe("10649.22");
  });
});

describe("pedido 2253 — fechamento completo", () => {
  const totais = calcularTotaisPedido(
    [
      { precoUnitario: precoMilheiroSaco(ITEM_2253_A), quantidade: 6 },
      { precoUnitario: precoMilheiroSaco(ITEM_2253_B), quantidade: 10 },
    ],
    IPI_QUALYPLAST,
  );

  it("totaliza cada item como no PDF", () => {
    expect(totais.itens[0].total.toFixed(2)).toBe("10649.23");
    expect(totais.itens[0].ipi.toFixed(2)).toBe("1038.30");
    expect(totais.itens[1].total.toFixed(2)).toBe("11340.00");
    expect(totais.itens[1].ipi.toFixed(2)).toBe("1105.65");
  });

  it("fecha subtotal, IPI e total geral como no PDF", () => {
    expect(totais.subtotalSemIpi.toFixed(2)).toBe("21989.23");
    expect(totais.ipi.toFixed(2)).toBe("2143.95");
    expect(totais.totalGeral.toFixed(2)).toBe("24133.18");
  });
});

describe("pedido 2256 — fechamento completo", () => {
  const totais = calcularTotaisPedido(
    [{ precoUnitario: precoMilheiroSaco(ITEM_2256), quantidade: 6 }],
    IPI_QUALYPLAST,
  );

  it("fecha subtotal, IPI e total geral como no PDF", () => {
    expect(totais.subtotalSemIpi.toFixed(2)).toBe("5405.40");
    expect(totais.ipi.toFixed(2)).toBe("527.03");
    expect(totais.totalGeral.toFixed(2)).toBe("5932.43");
  });
});

describe("pedidos sem IPI", () => {
  it("zera o IPI e mantém o total igual ao subtotal", () => {
    const totais = calcularTotaisPedido(
      [{ precoUnitario: precoMilheiroSaco(ITEM_2253_B), quantidade: 10 }],
      IPI_QUALYPLAST,
      false,
    );

    expect(totais.ipi.toFixed(2)).toBe("0.00");
    expect(totais.totalGeral.toFixed(2)).toBe("11340.00");
  });
});

describe("aditivos", () => {
  const deslizantePorKg: Aditivo = {
    nome: "Deslizante",
    sufixoDescricao: "C/ DESLIZANTE",
    tipo: "POR_KG",
    valor: 2,
  };

  it("soma valor absoluto ao fator kg — exemplo do usuário: 13,50 + 2,00 = 15,50", () => {
    expect(fatorEfetivo(13.5, [deslizantePorKg]).toFixed(2)).toBe("15.50");
  });

  it("reproduz o item 2256 partindo do fator base 13,50 mais aditivo de 2,10", () => {
    const preco = precoMilheiroSaco({
      larguraCm: 77,
      comprimentoCm: 150,
      espessuraMm: 0.05,
      fatorKg: 13.5,
      aditivos: [{ ...deslizantePorKg, valor: 2.1 }],
    });

    expect(dinheiro(preco)).toBe("900.90");
  });

  it("aditivo por milheiro entra depois da fórmula, não no fator", () => {
    const porMilheiro: Aditivo = {
      nome: "Impressão",
      sufixoDescricao: "C/ IMPRESSAO",
      tipo: "POR_MILHEIRO",
      valor: 100,
    };

    const semAditivo = precoMilheiroSaco(ITEM_2253_B);
    const comAditivo = precoMilheiroSaco({ ...ITEM_2253_B, aditivos: [porMilheiro] });

    expect(comAditivo.minus(semAditivo).toFixed(2)).toBe("100.00");
  });

  it("ignora aditivos por milheiro no cálculo do fator efetivo", () => {
    const porMilheiro: Aditivo = {
      nome: "Impressão",
      sufixoDescricao: "C/ IMPRESSAO",
      tipo: "POR_MILHEIRO",
      valor: 100,
    };

    expect(fatorEfetivo(13.5, [porMilheiro]).toFixed(2)).toBe("13.50");
  });
});

describe("descrição gerada", () => {
  it("monta as três descrições exatamente como saem nos PDFs reais", () => {
    expect(
      descricaoSaco({ larguraCm: 99, comprimentoCm: 166, espessuraMm: 0.08, sanfona: "13,50", material: "PEAD" }),
    ).toBe("99x166x0,08 SF 13,50 PEAD");

    expect(
      descricaoSaco({ larguraCm: 105, comprimentoCm: 100, espessuraMm: 0.08, sanfona: "15", material: "PEAD" }),
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

  it("omite a sanfona quando o saco não tem", () => {
    expect(
      descricaoSaco({ larguraCm: 40, comprimentoCm: 60, espessuraMm: 0.1, material: "PEBD" }),
    ).toBe("40x60x0,10 PEBD");
  });

  it("mantém as casas decimais da espessura fina", () => {
    expect(formatarNumero(0.006, 2)).toBe("0,006");
    expect(formatarNumero(0.08, 2)).toBe("0,08");
    expect(formatarNumero(99)).toBe("99");
  });
});
