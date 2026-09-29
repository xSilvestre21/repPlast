import { describe, expect, it } from "vitest";

import { comMascaraDeCnpj, situacaoDoParametro } from "./consulta";

describe("busca de clientes", () => {
  it("aplica a máscara do CNPJ aos dígitos digitados, do começo", () => {
    expect(comMascaraDeCnpj("39843059000187")).toBe("39.843.059/0001-87");
    expect(comMascaraDeCnpj("3984305")).toBe("39.843.05");
    expect(comMascaraDeCnpj("39")).toBe("39");
  });

  it("abre nos ativos quando a URL não diz outra coisa", () => {
    expect(situacaoDoParametro(undefined)).toBe("ativos");
    expect(situacaoDoParametro("inativos")).toBe("inativos");
    expect(situacaoDoParametro("todos")).toBe("todos");
    expect(situacaoDoParametro("qualquer")).toBe("ativos");
  });
});
