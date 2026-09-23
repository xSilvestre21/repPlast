/**
 * A conta da proposta avulsa, gravada e relida.
 *
 * O que se testa é a promessa do módulo: a conta aceita na proposta volta pelo
 * MESMO `dadosDoFormulario` do cadastro de produto e dá o mesmo produto. Se a
 * ida e a volta divergirem, a proposta fica presa sem poder virar pedido — ou,
 * pior, vira pedido com um produto de medida diferente da cotada.
 */

import { describe, expect, it } from "vitest";

import { contaDoFormulario, dadosDoFormulario, formularioDaConta, lerConta } from "./leitura";

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
