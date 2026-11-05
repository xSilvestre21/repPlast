import { describe, expect, it } from "vitest";

import { comMascaraDeCnpj, prepostoDoParametro, situacaoDoParametro } from "./consulta";

describe("busca de clientes", () => {
  it("aplica a máscara do CNPJ aos dígitos digitados, do começo", () => {
    expect(comMascaraDeCnpj("98765432000198")).toBe("98.765.432/0001-98");
    expect(comMascaraDeCnpj("3984305")).toBe("39.843.05");
    expect(comMascaraDeCnpj("39")).toBe("39");
  });

  it("abre nos ativos quando a URL não diz outra coisa", () => {
    expect(situacaoDoParametro(undefined)).toBe("ativos");
    expect(situacaoDoParametro("inativos")).toBe("inativos");
    expect(situacaoDoParametro("todos")).toBe("todos");
    expect(situacaoDoParametro("qualquer")).toBe("ativos");
  });

  it("só o administrador filtra por preposto, e só com um id de verdade", () => {
    const id = "3f2b8c1e-7a4d-4e9b-9c11-0d5e6f7a8b9c";

    expect(prepostoDoParametro(id, true)).toBe(id);
    expect(prepostoDoParametro(id, false)).toBe("");
    // A coluna é `uuid`: qualquer outra coisa derrubaria a consulta.
    expect(prepostoDoParametro("abc", true)).toBe("");
    expect(prepostoDoParametro(`${id}' OR 1=1`, true)).toBe("");
    expect(prepostoDoParametro(undefined, true)).toBe("");
    expect(prepostoDoParametro([id], true)).toBe("");
  });
});
