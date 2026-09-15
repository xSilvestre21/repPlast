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

import {
  DENSIDADE_PADRAO,
  arredondarDinheiro,
  faltaParaOMinimo,
  fatorEfetivo,
  precoDaFaixa,
  pesoMilheiroKg,
  precoMilheiroSaco,
  type Aditivo,
} from "./precificacao";
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

describe("densidade do material", () => {
  /*
   * A densidade substituiu o divisor 10 que era constante no motor. Estes
   * testes guardam as duas pontas dessa troca: que 0,1 reproduz o divisor
   * antigo (e portanto o pedido real), e que um material com outra densidade
   * muda o preço na proporção certa.
   */
  it("0,1 é o divisor 10 de antes — o pedido 2253 continua igual", () => {
    expect(DENSIDADE_PADRAO.toNumber()).toBe(0.1);
    expect(dinheiro(precoMilheiroSaco({ ...ITEM_2253_A, densidade: 0.1 }))).toBe("1774.87");
  });

  it("produto sem densidade cai no padrão, e não em zero", () => {
    expect(dinheiro(precoMilheiroSaco({ ...ITEM_2253_A, densidade: null }))).toBe("1774.87");
    expect(dinheiro(precoMilheiroSaco({ ...ITEM_2253_A, densidade: undefined }))).toBe("1774.87");
  });

  it("densidade maior encarece na proporção", () => {
    const padrao = precoMilheiroSaco(ITEM_2253_A);
    const dobro = precoMilheiroSaco({ ...ITEM_2253_A, densidade: 0.2 });

    expect(dobro.dividedBy(padrao).toNumber()).toBe(2);
  });

  it("peso do milheiro é medidas × densidade", () => {
    // 99 × 166 × 0,08 = 1.314,72; × 0,1 = 131,472
    expect(pesoMilheiroKg(ITEM_2253_A).toNumber()).toBe(131.472);
    expect(pesoMilheiroKg(ITEM_2253_A, 0.2).toNumber()).toBe(262.944);
  });

  it("o preço continua sendo o peso vezes o fator", () => {
    const peso = pesoMilheiroKg(ITEM_2253_A, 0.1);

    expect(dinheiro(peso.times(ITEM_2253_A.fatorKg))).toBe("1774.87");
  });
});

describe("piso de preço do material", () => {
  const medidas = {
    larguraCm: ITEM_2253_A.larguraCm,
    comprimentoCm: ITEM_2253_A.comprimentoCm,
    espessuraMm: ITEM_2253_A.espessuraMm,
  };

  it("devolve null quando o fator está no piso ou acima", () => {
    expect(faltaParaOMinimo(medidas, 0.1, 13.5, 12)).toBeNull();
    expect(faltaParaOMinimo(medidas, 0.1, 12, 12)).toBeNull();
  });

  it("mede a diferença em cima do peso do milheiro", () => {
    // peso 131,472 kg × (12,00 − 11,00) = 131,472
    expect(faltaParaOMinimo(medidas, 0.1, 11, 12)?.toNumber()).toBe(131.472);
    // 131,472 kg × (13,50 − 11,00) = 328,68
    expect(faltaParaOMinimo(medidas, 0.1, 11, 13.5)?.toNumber()).toBe(328.68);
  });

  it("acompanha a densidade, porque é ela que dá o peso", () => {
    expect(faltaParaOMinimo(medidas, 0.2, 11, 12)?.toNumber()).toBe(262.944);
    // Sem densidade cai no padrão, igual ao resto do motor.
    expect(faltaParaOMinimo(medidas, null, 11, 12)?.toNumber()).toBe(131.472);
  });

  it("a falta é a diferença entre os dois preços de milheiro", () => {
    const praticado = precoMilheiroSaco({ ...ITEM_2253_A, fatorKg: 11 });
    const noPiso = precoMilheiroSaco({ ...ITEM_2253_A, fatorKg: 12 });

    expect(faltaParaOMinimo(medidas, undefined, 11, 12)?.toNumber()).toBe(
      noPiso.minus(praticado).toNumber(),
    );
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



describe("faixas de peso", () => {
  /*
   * A tabela real da SELPACK para o PEAD, do backup do SICOV. Repare no buraco
   * entre 300 e 301: é assim que está cadastrado lá.
   */
  const SELPACK_PEAD = [
    { pesoAteKg: 300, precoKg: 35.2 },
    { pesoDeKg: 301, pesoAteKg: 499, precoKg: 34.1 },
    { pesoDeKg: 500, pesoAteKg: 999, precoKg: 33.25 },
    { pesoDeKg: 1000, precoKg: 32.75 },
  ];

  it("um pedido de 400 kg cai na segunda faixa", () => {
    expect(precoDaFaixa(SELPACK_PEAD, 400, 99).toNumber()).toBe(34.1);
  });

  it("percorre a escada inteira", () => {
    expect(precoDaFaixa(SELPACK_PEAD, 1, 99).toNumber()).toBe(35.2);
    expect(precoDaFaixa(SELPACK_PEAD, 300, 99).toNumber()).toBe(35.2);
    expect(precoDaFaixa(SELPACK_PEAD, 301, 99).toNumber()).toBe(34.1);
    expect(precoDaFaixa(SELPACK_PEAD, 999, 99).toNumber()).toBe(33.25);
    expect(precoDaFaixa(SELPACK_PEAD, 1000, 99).toNumber()).toBe(32.75);
    expect(precoDaFaixa(SELPACK_PEAD, 50000, 99).toNumber()).toBe(32.75);
  });

  it("peso no buraco entre faixas cai no preço padrão", () => {
    // 300,5 não pertence a faixa nenhuma na tabela como ela está cadastrada.
    expect(precoDaFaixa(SELPACK_PEAD, 300.5, 99).toNumber()).toBe(99);
  });

  it("material sem faixa usa o preço padrão", () => {
    expect(precoDaFaixa([], 400, "13.50").toNumber()).toBe(13.5);
  });

  it("faixa sem piso nem teto vale para qualquer peso", () => {
    expect(precoDaFaixa([{ precoKg: 7 }], 0, 99).toNumber()).toBe(7);
    expect(precoDaFaixa([{ precoKg: 7 }], 99999, 99).toNumber()).toBe(7);
  });
});
