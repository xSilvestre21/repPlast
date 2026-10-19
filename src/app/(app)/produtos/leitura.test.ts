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
  formularioDaConta,
  lerConta,
} from "./leitura";

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
      aditivos: ["a1"],
    });

    expect(conta.espessuraMm).toBe("0,06");
    expect(conta.aditivos).toEqual(["a1"]);
    expect(dadosDoFormulario(formularioDaConta(conta, extras))).toEqual(produto);
  });
});
