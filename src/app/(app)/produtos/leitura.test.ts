/**
 * A conta da proposta avulsa, gravada e relida.
 *
 * O que se testa é a promessa do módulo: a conta aceita na proposta volta pelo
 * MESMO `dadosDoFormulario` do cadastro de produto e dá o mesmo produto. Se a
 * ida e a volta divergirem, a proposta fica presa sem poder virar pedido — ou,
 * pior, vira pedido com um produto de medida diferente da cotada.
 */

import { describe, expect, it } from "vitest";

import {
  contaDaLinha,
  contaDoFormulario,
  contaDoProduto,
  dadosDoFormulario,
  fornecedorDaTampaVaria,
  formularioDaConta,
  lerConta,
  lerMaoDeObra,
} from "./leitura";
import { ErroDeCampo } from "@/lib/erro-formulario";

function formulario(campos: Record<string, string>, aditivos: string[] = []): FormData {
  const formData = new FormData();
  for (const [campo, valor] of Object.entries(campos)) formData.set(campo, valor);
  for (const aditivo of aditivos) formData.append("aditivos", aditivo);
  return formData;
}

const SACO = {
  familia: "SACO",
  larguraCm: "30",
  comprimentoCm: "40",
  espessuraMm: "0,06",
  fatorKg: "14,00",
  densidade: "0,1",
  material: "PEAD",
  sanfona: "",
};

describe("conta do item", () => {
  it("guarda o texto como foi digitado, com a vírgula", () => {
    const conta = contaDoFormulario(formulario(SACO, ["a1"]));

    expect(conta.espessuraMm).toBe("0,06");
    expect(conta.fatorKg).toBe("14,00");
    expect(conta.aditivos).toEqual(["a1"]);
  });

  it("não leva o que não é conta: indústria, cliente, descrição", () => {
    const conta = contaDoFormulario(
      formulario({ ...SACO, fornecedorId: "f", clienteId: "c", descricao: "x" }),
    );

    expect(conta).not.toHaveProperty("fornecedorId");
    expect(conta).not.toHaveProperty("clienteId");
    expect(conta).not.toHaveProperty("descricao");
  });

  it("relida, dá o mesmo produto que o cadastro daria", () => {
    const gravada = JSON.parse(JSON.stringify(contaDoFormulario(formulario(SACO, ["a1"]))));
    const conta = lerConta(gravada)!;

    const extras = { fornecedorId: "f", clienteId: "c", descricao: "30x40x0,06 S/SF PEAD" };
    const pelaConta = dadosDoFormulario(formularioDaConta(conta, extras));
    const peloCadastro = dadosDoFormulario(formulario({ ...SACO, ...extras }));

    expect(pelaConta).toEqual(peloCadastro);
    expect(pelaConta.espessuraMm).toBe("0.06");
    expect(pelaConta.clienteId).toBe("c");
  });

  it("recusa a conta de saco sem medida, como o cadastro recusaria", () => {
    const conta = contaDoFormulario(formulario({ ...SACO, larguraCm: "" }));
    const extras = { fornecedorId: "f", descricao: "saco" };

    expect(() => dadosDoFormulario(formularioDaConta(conta, extras))).toThrow(/largura/i);
  });

  it("item de catálogo, sem conta, lê como nulo", () => {
    expect(lerConta(null)).toBeNull();
    expect(lerConta({})).toBeNull();
    expect(lerConta([1, 2])).toBeNull();
  });
});

describe("conta de quem não guardou uma", () => {
  const preco = { toString: () => "17.98" };

  it("a linha do SICOV leva família e preço, no campo da unidade dela", () => {
    expect(contaDaLinha({ familia: "STRETCH", unidade: "KG", precoUnitario: preco })).toMatchObject(
      { familia: "STRETCH", precoKg: "17,98" },
    );
    expect(contaDaLinha({ familia: "FITA", unidade: "CX", precoUnitario: preco })).toMatchObject({
      precoCaixa: "17,98",
    });
    expect(contaDaLinha({ familia: "SACO", unidade: "KG", precoUnitario: preco })).toMatchObject({
      fatorKg: "17,98",
      unidadeRotulo: "KG",
    });
    expect(contaDaLinha({ familia: "AVULSO", unidade: "CX", precoUnitario: preco })).toMatchObject(
      { precoAvulso: "17,98", unidadeAvulsa: "CX" },
    );
  });

  it("o saco por milheiro fica sem preço: ele sai das medidas", () => {
    const conta = contaDaLinha({ familia: "SACO", unidade: "MIL", precoUnitario: preco });
    expect(conta.fatorKg).toBe("");
    expect(conta.unidadeRotulo).toBe("MIL");
  });

  it("o produto volta a conta, e a conta relida dá o mesmo produto", () => {
    const extras = { fornecedorId: "f", clienteId: "c", descricao: "30x40x0,06 S/SF PEAD" };
    const produto = dadosDoFormulario(formulario({ ...SACO, ...extras }));
    const coluna = (v: string | null | undefined) =>
      v === null || v === undefined ? null : { toString: () => v };

    const conta = contaDoProduto({
      familia: produto.familia,
      material: produto.material ?? null,
      complemento: produto.complemento ?? null,
      unidadeRotulo: produto.unidadeRotulo ?? null,
      larguraCm: coluna(produto.larguraCm),
      comprimentoCm: coluna(produto.comprimentoCm),
      espessuraMm: coluna(produto.espessuraMm),
      densidade: coluna(produto.densidade),
      sanfona: produto.sanfona ?? null,
      fatorKg: coluna(produto.fatorKg),
      larguraMm: coluna(produto.larguraMm),
      metragemM: coluna(produto.metragemM),
      micragem: coluna(produto.micragem),
      unidadesPorCaixa: produto.unidadesPorCaixa ?? null,
      precoUnidade: coluna(produto.precoUnidade),
      precoCaixa: coluna(produto.precoCaixa),
      precoKg: coluna(produto.precoKg),
      unidadeAvulsa: produto.unidadeAvulsa ?? null,
      precoAvulso: coluna(produto.precoAvulso),
      capacidade: coluna(produto.capacidade),
      capacidadeUnidade: produto.capacidadeUnidade ?? null,
      alturaCm: coluna(produto.alturaCm),
      diametroMm: coluna(produto.diametroMm),
      materialTampa: produto.materialTampa ?? null,
      complementoTampa: produto.complementoTampa ?? null,
      fornecedorTampaId: produto.fornecedorTampaId ?? null,
      fornecedorTampaVariavel: produto.fornecedorTampaVariavel,
      acabamento: produto.acabamento ?? null,
      acabamentoValorCom: coluna(produto.acabamentoValorCom),
      acabamentoValorSem: coluna(produto.acabamentoValorSem),
      aditivos: ["a1"],
    });

    expect(conta.espessuraMm).toBe("0,06");
    expect(conta.aditivos).toEqual(["a1"]);
    expect(dadosDoFormulario(formularioDaConta(conta, extras))).toEqual(produto);
  });

  it("a linha por milheiro leva o preço; a por unidade, não", () => {
    expect(contaDaLinha({ familia: "TAMPA", unidade: "MIL", precoUnitario: preco })).toMatchObject({
      familia: "TAMPA",
      precoAvulso: "17,98",
      precoKg: "",
    });
    expect(contaDaLinha({ familia: "TAMPA", unidade: "UN", precoUnitario: preco }).precoAvulso).toBe(
      "",
    );
  });
});

describe("tampa e acabamento do conjunto", () => {
  const CONJUNTO = {
    fornecedorId: "f",
    descricao: "Frasco 500mL + Tampa 28mm",
    familia: "FRASCO_TAMPA",
    capacidade: "500",
    capacidadeUnidade: "mL",
    diametroMm: "28",
    precoAvulso: "2.000,00",
  };

  const dados = (campos: Record<string, string>) =>
    dadosDoFormulario(formulario({ ...CONJUNTO, ...campos }));

  it("guarda o fornecedor e o código da tampa", () => {
    expect(dados({ fornecedorTampaId: "f2", codigoTampa: "T-42" })).toMatchObject({
      fornecedorTampaId: "f2",
      fornecedorTampaVariavel: false,
      codigoTampa: "T-42",
    });
  });

  it("no variável, quem diz o fornecedor é o item", () => {
    expect(dados({ fornecedorTampaId: "f2", fornecedorTampaVariavel: "1" })).toMatchObject({
      fornecedorTampaId: null,
      fornecedorTampaVariavel: true,
    });
  });

  it("frasco sem tampa não guarda fornecedor de tampa", () => {
    const frasco = dadosDoFormulario(
      formulario({
        ...CONJUNTO,
        familia: "FRASCO",
        fornecedorTampaId: "f2",
        fornecedorTampaVariavel: "1",
        codigoTampa: "T-42",
      }),
    );

    expect(frasco).toMatchObject({
      fornecedorTampaId: null,
      fornecedorTampaVariavel: false,
      codigoTampa: null,
    });
  });

  it("o cadastro guarda só os valores, e um basta", () => {
    const produto = dados({ acabamento: "Serigrafado", acabamentoValorSem: "90,00" });

    expect(produto).toMatchObject({
      acabamento: "Serigrafado",
      acabamentoValorSem: "90",
      acabamentoValorCom: null,
    });
    expect(produto).not.toHaveProperty("acabamentoMaoDeObra");
  });

  it("recusa o acabamento sem valor nenhum, apontando o campo", () => {
    try {
      dados({ acabamento: "Sleeve" });
      expect.unreachable("devia recusar");
    } catch (erro) {
      expect(erro).toMatchObject({ campo: "acabamentoValorCom" });
      expect((erro as Error).message).toMatch(/pelo menos um valor/);
    }
  });

  it("recusa valor que não é número", () => {
    expect(() => dados({ acabamento: "Sleeve", acabamentoValorCom: "abc" })).toThrow(/como 150,00/);
  });

  describe("a escolha da linha", () => {
    const AMBOS = {
      acabamento: "Serigrafado",
      acabamentoValorCom: "150",
      acabamentoValorSem: "90",
    };

    it("com os dois valores, é obrigatória, apontando o campo", () => {
      try {
        lerMaoDeObra(formulario({}), AMBOS);
        expect.unreachable("devia recusar");
      } catch (erro) {
        expect(erro).toMatchObject({ campo: "acabamentoMaoDeObra" });
      }
    });

    it("lê com e sem mão de obra", () => {
      expect(lerMaoDeObra(formulario({ acabamentoMaoDeObra: "COM" }), AMBOS)).toBe(true);
      expect(lerMaoDeObra(formulario({ acabamentoMaoDeObra: "SEM" }), AMBOS)).toBe(false);
    });

    it("com um valor só, não pergunta", () => {
      const soCom = { ...AMBOS, acabamentoValorSem: null };

      expect(lerMaoDeObra(formulario({}), soCom)).toBe(true);
      expect(lerMaoDeObra(formulario({ acabamentoMaoDeObra: "SEM" }), soCom)).toBe(true);
    });

    it("sem acabamento, não há escolha", () => {
      expect(lerMaoDeObra(formulario({ acabamentoMaoDeObra: "COM" }), {})).toBeNull();
    });
  });

  it("tipo sem acabamento ignora o que vier no formulário", () => {
    const tampa = dadosDoFormulario(
      formulario({
        fornecedorId: "f",
        descricao: "Tampa 28mm",
        familia: "TAMPA",
        diametroMm: "28",
        precoAvulso: "100",
        acabamento: "Serigrafado",
        acabamentoValorCom: "150",
      }),
    );

    expect(tampa).toMatchObject({ acabamento: null, acabamentoValorCom: null });
  });

  it("a conta vai e volta com tampa e acabamento", () => {
    const campos = {
      ...CONJUNTO,
      fornecedorTampaId: "f2",
      acabamento: "Rotulado Adesivo",
      acabamentoValorCom: "150,00",
      acabamentoValorSem: "90,00",
    };
    const conta = lerConta(JSON.parse(JSON.stringify(contaDoFormulario(formulario(campos)))))!;
    const extras = { fornecedorId: "f", descricao: CONJUNTO.descricao };

    expect(dadosDoFormulario(formularioDaConta(conta, extras))).toEqual(
      dadosDoFormulario(formulario(campos)),
    );
  });

  it("a conta variável guarda a escolha da proposta, mas o produto não", () => {
    const conta = contaDoFormulario(
      formulario({ ...CONJUNTO, fornecedorTampaId: "f2", fornecedorTampaVariavel: "1" }),
    );

    expect(conta.fornecedorTampaId).toBe("f2");
    expect(
      dadosDoFormulario(formularioDaConta(conta, { fornecedorId: "f", descricao: "x" })),
    ).toMatchObject({ fornecedorTampaId: null, fornecedorTampaVariavel: true });
  });

  it("linha de produto pergunta ao produto; linha de conta, à conta", () => {
    const variavel = contaDoFormulario(
      formulario({ ...CONJUNTO, fornecedorTampaVariavel: "1" }),
    );

    expect(
      fornecedorDaTampaVaria({ produto: { fornecedorTampaVariavel: true }, conta: null }),
    ).toBe(true);
    expect(
      fornecedorDaTampaVaria({ produto: { fornecedorTampaVariavel: false }, conta: variavel }),
    ).toBe(false);
    expect(fornecedorDaTampaVaria({ produto: null, conta: variavel })).toBe(true);
    expect(fornecedorDaTampaVaria({ produto: null, conta: null })).toBe(false);
  });
});

describe("tipos vendidos por milheiro", () => {
  const COMUM = {
    fornecedorId: "f",
    descricao: "Texto impresso",
    precoAvulso: "1.250,00",
  };

  const dados = (campos: Record<string, string>) =>
    dadosDoFormulario(formulario({ ...COMUM, ...campos }));

  it("grava sempre em milheiro, com o preço digitado", () => {
    const produto = dados({ familia: "TAMPA", diametroMm: "28" });

    expect(produto.unidadeAvulsa).toBe("MIL");
    expect(produto.precoAvulso).toBe("1250");
    expect(produto.diametroMm).toBe("28");
    expect(produto.precoKg).toBeNull();
  });

  it("batoque e alça gravam o gargalo no diâmetro, e o recusam vazio", () => {
    expect(dados({ familia: "BATOQUE", diametroMm: "18" })).toMatchObject({
      familia: "BATOQUE",
      diametroMm: "18",
      unidadeAvulsa: "MIL",
      materialTampa: null,
    });
    expect(dados({ familia: "ALCA", diametroMm: "48" }).diametroMm).toBe("48");
    expect(() => dados({ familia: "BATOQUE" })).toThrow(/diâmetro/);
  });

  it("recusa preço vazio apontando o campo", () => {
    expect(() =>
      dadosDoFormulario(
        formulario({ fornecedorId: "f", descricao: "x", familia: "TAMPA", diametroMm: "28" }),
      ),
    ).toThrow(/preço/);
  });

  it("a bombona é sempre em litros, mesmo que venha outra coisa", () => {
    const produto = dados({ familia: "BOMBONA", capacidade: "20", capacidadeUnidade: "mL" });
    expect(produto.capacidade).toBe("20");
    expect(produto.capacidadeUnidade).toBe("L");
  });

  it("o frasco aceita mL e L", () => {
    expect(
      dados({ familia: "FRASCO", capacidade: "500", capacidadeUnidade: "mL" }).capacidadeUnidade,
    ).toBe("mL");
    expect(
      dados({ familia: "FRASCO", capacidade: "1,5", capacidadeUnidade: "L" }).capacidade,
    ).toBe("1.5");
  });

  it("recusa frasco sem unidade conhecida", () => {
    expect(() =>
      dados({ familia: "FRASCO", capacidade: "500", capacidadeUnidade: "kg" }),
    ).toThrow(/mL ou em L/);
  });

  it("recusa a medida que falta, e texto no lugar de número", () => {
    expect(() => dados({ familia: "BOMBONA" })).toThrow(/capacidade/);
    expect(() => dados({ familia: "TAMPA", diametroMm: "abc" })).toThrow(/como 28/);
    expect(() => dados({ familia: "PAPELAO", comprimentoCm: "30" })).toThrow(/largura/);
    expect(() =>
      dados({ familia: "FRASCO_TAMPA", capacidade: "500", capacidadeUnidade: "mL" }),
    ).toThrow(/diâmetro/);
  });

  it("no papelão a altura é opcional, para a chapa", () => {
    const produto = dados({ familia: "PAPELAO", comprimentoCm: "100", larguraCm: "80" });
    expect(produto.comprimentoCm).toBe("100");
    expect(produto.larguraCm).toBe("80");
    expect(produto.alturaCm).toBeNull();
  });

  it("só o conjunto guarda material e complemento da tampa", () => {
    const tampa = { materialTampa: "PP", complementoTampa: "Azul", diametroMm: "28" };

    expect(
      dados({ familia: "FRASCO_TAMPA", capacidade: "500", capacidadeUnidade: "mL", ...tampa }),
    ).toMatchObject({ materialTampa: "PP", complementoTampa: "Azul", diametroMm: "28" });

    expect(dados({ familia: "TAMPA", ...tampa })).toMatchObject({
      materialTampa: null,
      complementoTampa: null,
    });
  });

  it("zera as colunas dos outros tipos", () => {
    const produto = dados({
      familia: "TAMPA",
      diametroMm: "28",
      capacidade: "20",
      larguraCm: "30",
      alturaCm: "15",
    });

    expect(produto.capacidade).toBeNull();
    expect(produto.larguraCm).toBeNull();
    expect(produto.alturaCm).toBeNull();
  });

  it("as outras famílias ficam sem as colunas novas", () => {
    expect(dadosDoFormulario(formulario({ ...SACO, fornecedorId: "f", descricao: "x" }))).toMatchObject(
      { capacidade: null, diametroMm: null, materialTampa: null },
    );
  });

  it("a conta do conjunto vai e volta sem perder nada", () => {
    const campos = {
      familia: "FRASCO_TAMPA",
      material: "PEAD",
      complemento: "Oval Branco",
      capacidade: "500",
      capacidadeUnidade: "mL",
      diametroMm: "28",
      materialTampa: "PP",
      complementoTampa: "Flip Top Azul",
      precoAvulso: "1.250,00",
    };
    const extras = { fornecedorId: "f", descricao: "Frasco 500mL" };

    const conta = lerConta(contaDoFormulario(formulario({ ...campos, ...extras })));

    expect(conta).toMatchObject(campos);
    expect(dadosDoFormulario(formularioDaConta(conta!, extras))).toEqual(
      dadosDoFormulario(formulario({ ...campos, ...extras })),
    );
  });

  it("conta gravada antes dos campos novos continua sendo lida", () => {
    const conta = lerConta({ familia: "SACO", larguraCm: "30" });
    expect(conta?.capacidade).toBe("");
    expect(conta?.materialTampa).toBe("");
  });
});

describe("sanfona", () => {
  const comSanfona = (sanfona: string) =>
    dadosDoFormulario(formulario({ ...SACO, sanfona, fornecedorId: "f", descricao: "x" }));

  it("guarda como foi digitada, com o zero da frente", () => {
    expect(comSanfona("09").sanfona).toBe("09");
    expect(comSanfona("13,50").sanfona).toBe("13,50");
  });

  it("vazia continua vazia", () => {
    expect(comSanfona("").sanfona).toBeNull();
  });

  it("texto que não é número é recusado, embaixo da sanfona", () => {
    expect(() => comSanfona("12cm")).toThrow(ErroDeCampo);
    try {
      comSanfona("12cm");
    } catch (erro) {
      expect((erro as ErroDeCampo).campo).toBe("sanfona");
    }
  });
});
