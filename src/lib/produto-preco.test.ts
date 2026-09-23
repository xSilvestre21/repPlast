/**
 * Testes da tradução produto + unidade → preço.
 *
 * As fixtures são os itens dos quatro pedidos reais em `referencia/`, cobrindo
 * as três formas de precificação do sistema: fórmula (saco), preço de caixa
 * (fita) e preço por quilo (stretch).
 */

import { describe, expect, it } from "vitest";

import {
  ROTULO_COLUNA_PRECO,
  pesoDoItem,
  rotuloColunaPreco,
  precoUnitario,
  unidadesComPreco,
  unidadesDaFamilia,
  type ProdutoPrecificavel,
} from "./produto-preco";

const SACO_2253: ProdutoPrecificavel = {
  familia: "SACO",
  larguraCm: 99,
  comprimentoCm: 166,
  espessuraMm: 0.08,
  fatorKg: 13.5,
};

const FITA_133: ProdutoPrecificavel = {
  familia: "FITA",
  precoCaixa: 368.76,
  unidadesPorCaixa: 6,
};

const STRETCH_146: ProdutoPrecificavel = { familia: "STRETCH", precoKg: 17.4 };

describe("preço unitário por família", () => {
  it("saco: passa pela fórmula e bate com o pedido 2253", () => {
    expect(precoUnitario(SACO_2253, "MIL")?.toDecimalPlaces(2).toFixed(2)).toBe("1774.87");
  });

  it("saco com aditivo: reproduz o pedido 2256", () => {
    const preco = precoUnitario(
      {
        familia: "SACO",
        larguraCm: 77,
        comprimentoCm: 150,
        espessuraMm: 0.05,
        fatorKg: 13.5,
        aditivos: [
          { nome: "Deslizante", sufixoDescricao: "C/ DESLIZANTE", tipo: "POR_KG", valor: 2.1 },
        ],
      },
      "MIL",
    );

    expect(preco?.toDecimalPlaces(2).toFixed(2)).toBe("900.90");
  });

  it("fita: usa o preço de caixa do pedido 133", () => {
    expect(precoUnitario(FITA_133, "CX")?.toFixed(2)).toBe("368.76");
  });

  it("fita: deriva o preço da unidade dividindo a caixa", () => {
    expect(precoUnitario(FITA_133, "UN")?.toFixed(2)).toBe("61.46");
  });

  it("fita: prefere o preço de unidade cadastrado ao derivado", () => {
    expect(precoUnitario({ ...FITA_133, precoUnidade: 70 }, "UN")?.toFixed(2)).toBe("70.00");
  });

  it("saco por quilo: o preço do kg é o fator", () => {
    expect(precoUnitario(SACO_2253, "KG")?.toFixed(2)).toBe("13.50");
  });

  it("saco por quilo: soma o aditivo por kg e ignora o por milheiro", () => {
    const preco = precoUnitario(
      {
        ...SACO_2253,
        aditivos: [
          { nome: "Deslizante", sufixoDescricao: "C/ DESLIZANTE", tipo: "POR_KG", valor: 2.1 },
          { nome: "Solda", sufixoDescricao: "C/ SOLDA", tipo: "POR_MILHEIRO", valor: 40 },
        ],
      },
      "KG",
    );

    expect(preco?.toFixed(2)).toBe("15.60");
  });

  it("saco por quilo sem fator não tem preço", () => {
    expect(precoUnitario({ familia: "SACO", larguraCm: 99 }, "KG")).toBeNull();
  });

  it("fita: sem preço de caixa, a caixa é as unidades vezes o preço de cada", () => {
    const soUnidade: ProdutoPrecificavel = {
      familia: "FITA",
      precoUnidade: 4.39,
      unidadesPorCaixa: 84,
    };

    // O caso do acervo: R$ 4,39 a unidade, caixa de 84 = R$ 368,76.
    expect(precoUnitario(soUnidade, "CX")?.toFixed(2)).toBe("368.76");
    expect(unidadesComPreco(soUnidade)).toEqual(["CX", "UN"]);
  });

  it("stretch: usa o preço por quilo do pedido 146", () => {
    expect(precoUnitario(STRETCH_146, "KG")?.toFixed(2)).toBe("17.40");
  });
});

describe("unidades válidas", () => {
  it("cada família aceita só as suas unidades", () => {
    expect(unidadesDaFamilia("SACO")).toEqual(["MIL", "KG"]);
    expect(unidadesDaFamilia("FITA")).toEqual(["CX", "UN"]);
    expect(unidadesDaFamilia("STRETCH")).toEqual(["KG"]);
    expect(unidadesDaFamilia("BOBINA")).toEqual(["KG"]);
  });

  it("recusa unidade que não pertence à família", () => {
    expect(precoUnitario(SACO_2253, "CX")).toBeNull();
    expect(precoUnitario(STRETCH_146, "CX")).toBeNull();
  });

  it("descarta a unidade sem preço cadastrado", () => {
    // Sem unidadesPorCaixa não dá para derivar o preço avulso.
    const soCaixa: ProdutoPrecificavel = { familia: "FITA", precoCaixa: 368.76 };

    expect(unidadesComPreco(soCaixa)).toEqual(["CX"]);
    expect(unidadesComPreco(FITA_133)).toEqual(["CX", "UN"]);
  });

  it("devolve null quando faltam medidas do saco", () => {
    expect(precoUnitario({ familia: "SACO", larguraCm: 99 }, "MIL")).toBeNull();
  });
});

describe("peso do item", () => {
  it("item vendido em quilo pesa a própria quantidade", () => {
    expect(pesoDoItem(STRETCH_146, "KG", 750).toFixed(0)).toBe("750");
  });

  it("fita não tem peso cadastrado, então devolve zero", () => {
    // Limitação conhecida: uma indústria de fitas com meta em kg ficaria sem base.
    expect(pesoDoItem(FITA_133, "CX", 5).toFixed(0)).toBe("0");
  });

  it("saco vendido em quilo também pesa a própria quantidade", () => {
    expect(pesoDoItem(SACO_2253, "KG", 120).toFixed(0)).toBe("120");
  });

  it("saco usa o peso do milheiro vezes a quantidade", () => {
    // 99 × 166 × 0,08 ÷ 10 = 131,472 kg por milheiro.
    expect(pesoDoItem(SACO_2253, "MIL", 6).toFixed(3)).toBe("788.832");
  });
});

describe("rótulos do PDF", () => {
  it("o cabeçalho da coluna de preço muda por família, como nos pedidos reais", () => {
    expect(ROTULO_COLUNA_PRECO.SACO).toBe("MILHEIRO");
    expect(ROTULO_COLUNA_PRECO.FITA).toBe("PREÇO/CX");
    expect(ROTULO_COLUNA_PRECO.STRETCH).toBe("PREÇO/KG");
    expect(ROTULO_COLUNA_PRECO.BOBINA).toBe("PREÇO/KG");
  });

  it("vendido por quilo, a coluna diz PREÇO/KG em qualquer família", () => {
    expect(rotuloColunaPreco("SACO", "MIL")).toBe("MILHEIRO");
    expect(rotuloColunaPreco("SACO", "KG")).toBe("PREÇO/KG");
    expect(rotuloColunaPreco("FITA", "CX")).toBe("PREÇO/CX");
  });
});
