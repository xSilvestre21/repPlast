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
    // Um pedido sem IPI é um pedido com todas as linhas isentas: o interruptor
    // do pedido saiu, e quem decide é cada item.
    const totais = calcularTotaisPedido(
      [{ precoUnitario: precoMilheiroSaco(ITEM_2253_B), quantidade: 10, comIpi: false }],
      IPI_QUALYPLAST,
    );

    expect(totais.ipi.toFixed(2)).toBe("0.00");
    expect(totais.totalGeral.toFixed(2)).toBe("11340.00");
  });
});

describe("IPI por item — um item isento no meio de um pedido tributado", () => {
  /** Duas linhas iguais: só a segunda é isenta, então o IPI é o de uma só. */
  const DUAS_LINHAS = [
    { precoUnitario: precoMilheiroSaco(ITEM_2253_B), quantidade: 10, comIpi: true },
    { precoUnitario: precoMilheiroSaco(ITEM_2253_B), quantidade: 10, comIpi: false },
  ];

  it("cobra IPI só da linha tributada", () => {
    const totais = calcularTotaisPedido(DUAS_LINHAS, IPI_QUALYPLAST);

    expect(totais.itens[0].ipi.toFixed(2)).toBe("1105.65");
    expect(totais.itens[1].ipi.toFixed(2)).toBe("0.00");
    // O IPI do pedido é o da primeira linha, e mais nada.
    expect(totais.ipi.toFixed(2)).toBe("1105.65");
  });

  it("o subtotal ignora a isenção — ela só muda o imposto", () => {
    const totais = calcularTotaisPedido(DUAS_LINHAS, IPI_QUALYPLAST);

    expect(totais.subtotalSemIpi.toFixed(2)).toBe("22680.00");
    expect(totais.totalGeral.toFixed(2)).toBe("23785.65");
  });

  it("item sem a marca é tributado, que é o padrão de quem não opina", () => {
    const semMarca = calcularTotaisPedido(
      [{ precoUnitario: precoMilheiroSaco(ITEM_2253_B), quantidade: 10 }],
      IPI_QUALYPLAST,
    );
    const comMarca = calcularTotaisPedido(
      [{ precoUnitario: precoMilheiroSaco(ITEM_2253_B), quantidade: 10, comIpi: true }],
      IPI_QUALYPLAST,
    );

    expect(semMarca.ipi.toFixed(2)).toBe(comMarca.ipi.toFixed(2));
  });

  it("todas as linhas isentas zeram o IPI do pedido", () => {
    const totais = calcularTotaisPedido(
      DUAS_LINHAS.map((l) => ({ ...l, comIpi: false })),
      IPI_QUALYPLAST,
    );

    expect(totais.ipi.toFixed(2)).toBe("0.00");
    expect(totais.totalGeral.toFixed(2)).toBe("22680.00");
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

/**
 * Pedidos da ERIPACK. Servem para dois propósitos: confirmar que o IPI é mesmo
 * uma configuração por fornecedor (15% aqui, contra 9,75% da QUALYPLAST) e que
 * a totalização funciona para as famílias de preço de tabela, sem fórmula.
 */
const IPI_ERIPACK = 15;

describe("pedido 133 — fita, preço de tabela por caixa", () => {
  it("fecha como no PDF", () => {
    const totais = calcularTotaisPedido(
      [{ precoUnitario: "368.76", quantidade: 5 }],
      IPI_ERIPACK,
    );

    expect(totais.subtotalSemIpi.toFixed(2)).toBe("1843.80");
    expect(totais.ipi.toFixed(2)).toBe("276.57");
    expect(totais.totalGeral.toFixed(2)).toBe("2120.37");
  });
});

describe("pedido 146 — stretch, preço por quilo", () => {
  it("fecha como no PDF, com dois itens do mesmo preço", () => {
    const totais = calcularTotaisPedido(
      [
        { precoUnitario: "17.40", quantidade: 750 },
        { precoUnitario: "17.40", quantidade: 250 },
      ],
      IPI_ERIPACK,
    );

    expect(totais.itens[0].total.toFixed(2)).toBe("13050.00");
    expect(totais.itens[0].ipi.toFixed(2)).toBe("1957.50");
    expect(totais.itens[1].total.toFixed(2)).toBe("4350.00");
    expect(totais.itens[1].ipi.toFixed(2)).toBe("652.50");

    expect(totais.subtotalSemIpi.toFixed(2)).toBe("17400.00");
    expect(totais.ipi.toFixed(2)).toBe("2610.00");
    expect(totais.totalGeral.toFixed(2)).toBe("20010.00");
  });
});

