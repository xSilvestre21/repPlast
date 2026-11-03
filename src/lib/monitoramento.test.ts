import { describe, expect, it } from "vitest";

import { filtrarEvento, mascarar } from "./monitoramento";

describe("mascarar", () => {
  it("troca e-mail, CPF e CNPJ, formatados ou não", () => {
    expect(mascarar("Unique constraint failed: email = joao.silva+rep@empresa.com.br")).toBe(
      "Unique constraint failed: email = [e-mail]",
    );
    expect(mascarar("cpfCnpj 123.456.789-09 recusado")).toBe("cpfCnpj [cpf] recusado");
    expect(mascarar("cpfCnpj 12345678909 recusado")).toBe("cpfCnpj [cpf] recusado");
    expect(mascarar("CNPJ 12.345.678/0001-95")).toBe("CNPJ [cnpj]");
    expect(mascarar('{"cpfCnpj":"12345678000195"}')).toBe('{"cpfCnpj":"[cnpj]"}');
  });

  it("deixa o resto: números curtos, ids e o código do erro", () => {
    const texto = "P2002 no pedido 1532, organizacao 3f2a330b-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(mascarar(texto)).toBe(texto);
  });
});

describe("filtrarEvento", () => {
  it("descarta o aviso do túnel do Sentry", () => {
    expect(
      filtrarEvento({
        message: "(node:1) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.",
      }),
    ).toBeNull();
  });

  it("mascara em qualquer nível, sem perder o resto do evento", () => {
    const evento = {
      level: "error",
      message: "[asaas] POST /v3/checkouts → 400",
      extra: { arguments: ["[asaas] POST /v3/checkouts → 400", '{"email":"ana@x.com.br"}'] },
      exception: { values: [{ type: "Error", value: "falhou para ana@x.com.br" }] },
    };

    expect(filtrarEvento(evento)).toEqual({
      level: "error",
      message: "[asaas] POST /v3/checkouts → 400",
      extra: { arguments: ["[asaas] POST /v3/checkouts → 400", '{"email":"[e-mail]"}'] },
      exception: { values: [{ type: "Error", value: "falhou para [e-mail]" }] },
    });
  });
});
