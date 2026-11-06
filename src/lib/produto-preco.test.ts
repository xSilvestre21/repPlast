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
  ehPorMilheiro,
  rotuloPrecoDosItens,
  unidadeDoRotulo,
  pesoDoItem,
  rotuloColunaPreco,
  precoUnitario,
  unidadesComPreco,
  unidadesDaFamilia,
  unidadesDoItem,
  type ProdutoPrecificavel,
  opcoesDeMaoDeObra,
  valorDoAcabamento,
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
  it("cada família aceita as suas unidades, e a unidade vale para todas", () => {
    expect(unidadesDaFamilia("SACO")).toEqual(["MIL", "KG", "UN"]);
    expect(unidadesDaFamilia("FITA")).toEqual(["CX", "UN"]);
    expect(unidadesDaFamilia("STRETCH")).toEqual(["KG", "UN"]);
    expect(unidadesDaFamilia("BOBINA")).toEqual(["KG", "UN"]);
  });

  it("o lançamento oferece as unidades com preço e a unidade, sem repeti-la", () => {
    expect(unidadesDoItem(SACO_2253)).toEqual(["MIL", "KG", "UN"]);
    expect(unidadesDoItem(STRETCH_146)).toEqual(["KG", "UN"]);
    expect(unidadesDoItem(FITA_133)).toEqual(["CX", "UN"]);
    // Avulso vendido por quilo: a unidade entra com o preço digitado.
    expect(unidadesDoItem({ familia: "AVULSO", unidadeAvulsa: "KG", precoAvulso: 8 })).toEqual([
      "KG",
      "UN",
    ]);
    // Sem preço nenhum, sobra a unidade — a amostra ainda entra.
    expect(unidadesDoItem({ familia: "SACO", larguraCm: 99 })).toEqual(["UN"]);
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
    expect(precoUnitario({ familia: "SACO", larguraCm: 99 }, "UN")).toBeNull();
  });

  it("saco por unidade é o milheiro dividido por mil, sem arredondar", () => {
    const milheiro = precoUnitario(SACO_2253, "MIL")!;
    expect(precoUnitario(SACO_2253, "UN")?.equals(milheiro.dividedBy(1000))).toBe(true);
    expect(precoUnitario(SACO_2253, "UN")?.toDecimalPlaces(6).toFixed(6)).toBe("1.774872");
  });

  it("stretch por unidade não tem preço calculado — ele é digitado", () => {
    expect(precoUnitario(STRETCH_146, "UN")).toBeNull();
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

  it("saco por unidade pesa o milheiro dividido por mil", () => {
    expect(pesoDoItem(SACO_2253, "UN", 6000).toFixed(3)).toBe("788.832");
    expect(pesoDoItem(SACO_2253, "UN", 25).toFixed(3)).toBe("3.287");
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

  it("fita vendida por unidade não sai sob PREÇO/CX", () => {
    expect(rotuloColunaPreco("FITA", "UN")).toBe("PREÇO/UN");
    // O avulso por unidade mantém o rótulo que sempre teve.
    expect(rotuloColunaPreco("AVULSO", "UN")).toBe("PREÇO UNIT.");
  });

  it("o cabeçalho do documento olha todas as linhas, não só a primeira", () => {
    expect(rotuloPrecoDosItens([])).toBe("PREÇO");
    expect(
      rotuloPrecoDosItens([
        { familia: "SACO", unidade: "KG" },
        { familia: "SACO", unidade: "KG" },
      ]),
    ).toBe("PREÇO/KG");
    // Saco por quilo e stretch dizem a mesma coisa: preço do kg.
    expect(
      rotuloPrecoDosItens([
        { familia: "SACO", unidade: "KG" },
        { familia: "STRETCH", unidade: "KG" },
      ]),
    ).toBe("PREÇO/KG");
  });

  it("unidades misturadas deixam o cabeçalho genérico", () => {
    expect(
      rotuloPrecoDosItens([
        { familia: "SACO", unidade: "MIL" },
        { familia: "SACO", unidade: "KG" },
      ]),
    ).toBe("PREÇO UNIT.");
    expect(
      rotuloPrecoDosItens([
        { familia: "FITA", unidade: "CX" },
        { familia: "FITA", unidade: "UN" },
      ]),
    ).toBe("PREÇO UNIT.");
  });
});

describe("unidade do rótulo do produto", () => {
  it("lê os rótulos do SICOV em qualquer caixa", () => {
    expect(unidadeDoRotulo("MIL")).toBe("MIL");
    expect(unidadeDoRotulo("mil")).toBe("MIL");
    expect(unidadeDoRotulo("Kg")).toBe("KG");
    expect(unidadeDoRotulo("KG")).toBe("KG");
    expect(unidadeDoRotulo("Un")).toBe("UN");
    expect(unidadeDoRotulo("Caixas")).toBe("CX");
  });

  it("sem rótulo, ou com um desconhecido, não inventa unidade", () => {
    expect(unidadeDoRotulo(null)).toBeNull();
    expect(unidadeDoRotulo("")).toBeNull();
    expect(unidadeDoRotulo("rolo")).toBeNull();
  });
});

describe("acabamento de frasco e bombona", () => {
  const FRASCO = {
    familia: "FRASCO" as const,
    precoAvulso: "2000",
    acabamento: "Serigrafado",
    acabamentoValorCom: "150",
    acabamentoValorSem: "90",
  };

  it("soma o valor com mão de obra", () => {
    const produto = { ...FRASCO, acabamentoMaoDeObra: true };
    expect(precoUnitario(produto, "MIL")?.toString()).toBe("2150");
  });

  it("soma o valor sem mão de obra", () => {
    const produto = { ...FRASCO, acabamentoMaoDeObra: false };
    expect(precoUnitario(produto, "MIL")?.toString()).toBe("2090");
  });

  it("a unidade é o milheiro já com o acabamento, dividido por mil", () => {
    const produto = { ...FRASCO, acabamentoMaoDeObra: true };
    expect(precoUnitario(produto, "UN")?.toString()).toBe("2.15");
  });

  it("sem acabamento, o valor que sobrou não entra", () => {
    const produto = { ...FRASCO, acabamento: null, acabamentoMaoDeObra: true };
    expect(precoUnitario(produto, "MIL")?.toString()).toBe("2000");
  });

  it("antes de a linha escolher, nenhum dos dois entra", () => {
    expect(precoUnitario(FRASCO, "MIL")?.toString()).toBe("2000");
    expect(precoUnitario({ ...FRASCO, acabamentoMaoDeObra: null }, "MIL")?.toString()).toBe("2000");
  });

  it("a linha só pode cobrar o que tem valor no cadastro", () => {
    expect(opcoesDeMaoDeObra(FRASCO).map((o) => o.marca)).toEqual(["COM", "SEM"]);
    expect(
      opcoesDeMaoDeObra({ ...FRASCO, acabamentoValorSem: null }).map((o) => o.marca),
    ).toEqual(["COM"]);
    expect(opcoesDeMaoDeObra({ ...FRASCO, acabamento: null })).toEqual([]);
  });

  it("valor zero é um valor: a opção existe", () => {
    expect(
      opcoesDeMaoDeObra({ ...FRASCO, acabamentoValorCom: "0" }).map((o) => o.marca),
    ).toEqual(["COM", "SEM"]);
  });

  it("sem preço do milheiro continua sem preço", () => {
    const produto = { ...FRASCO, precoAvulso: null, acabamentoMaoDeObra: true };
    expect(precoUnitario(produto, "MIL")).toBeNull();
  });

  it("o valor sai só do que a linha marca", () => {
    expect(valorDoAcabamento({}).toString()).toBe("0");
    expect(
      valorDoAcabamento({ ...FRASCO, acabamentoMaoDeObra: false }).toString(),
    ).toBe("90");
  });
});

describe("famílias vendidas por milheiro", () => {
  const FAMILIAS = ["BOMBONA", "FRASCO", "PAPELAO", "TAMPA", "FRASCO_TAMPA", "BOMBONA_TAMPA"] as const;

  const produto = (familia: (typeof FAMILIAS)[number]): ProdutoPrecificavel => ({
    familia,
    unidadeAvulsa: "MIL",
    precoAvulso: "1250.50",
  });

  it("são reconhecidas, e as outras não", () => {
    for (const familia of FAMILIAS) expect(ehPorMilheiro(familia)).toBe(true);
    expect(ehPorMilheiro("AVULSO")).toBe(false);
    expect(ehPorMilheiro("SACO")).toBe(false);
  });

  it("abrem no milheiro, e a unidade fica para a amostra", () => {
    for (const familia of FAMILIAS) {
      expect(unidadesDaFamilia(familia)).toEqual(["MIL", "UN"]);
      expect(unidadesDoItem(produto(familia))).toEqual(["MIL", "UN"]);
    }
  });

  it("o preço do milheiro é o digitado", () => {
    for (const familia of FAMILIAS) {
      expect(precoUnitario(produto(familia), "MIL")?.toString()).toBe("1250.5");
    }
  });

  it("a unidade é o milheiro dividido por mil, sem arredondar", () => {
    expect(precoUnitario(produto("TAMPA"), "UN")?.toString()).toBe("1.2505");
  });

  it("não têm preço por quilo nem por caixa", () => {
    expect(precoUnitario(produto("FRASCO"), "KG")).toBeNull();
    expect(precoUnitario(produto("FRASCO"), "CX")).toBeNull();
  });

  it("sem preço digitado, não inventa nenhum", () => {
    expect(precoUnitario({ familia: "BOMBONA" }, "MIL")).toBeNull();
  });

  it("saem no PDF sob MILHEIRO", () => {
    for (const familia of FAMILIAS) {
      expect(ROTULO_COLUNA_PRECO[familia]).toBe("MILHEIRO");
      expect(rotuloColunaPreco(familia, "MIL")).toBe("MILHEIRO");
    }
  });

  it("não têm peso cadastrado", () => {
    expect(pesoDoItem(produto("BOMBONA"), "MIL", 5).toNumber()).toBe(0);
  });
});
