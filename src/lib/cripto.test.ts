import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cifrar, criptoConfigurada, decifrar } from "./cripto";

describe("cifra da senha do e-mail", () => {
  const original = process.env.EMAIL_CHAVE;

  beforeEach(() => {
    process.env.EMAIL_CHAVE = randomBytes(32).toString("base64");
  });

  afterEach(() => {
    // Atribuir `undefined` a uma variável de ambiente grava o texto "undefined".
    if (original === undefined) delete process.env.EMAIL_CHAVE;
    else process.env.EMAIL_CHAVE = original;
  });

  it("devolve o que foi cifrado", () => {
    expect(decifrar(cifrar("abcd efgh ijkl mnop"))).toBe("abcd efgh ijkl mnop");
    expect(decifrar(cifrar(""))).toBe("");
    expect(decifrar(cifrar("çãé ✓"))).toBe("çãé ✓");
  });

  it("nunca guarda a senha em claro, e cifra diferente a cada vez", () => {
    const a = cifrar("minha-senha");
    const b = cifrar("minha-senha");

    expect(a).not.toContain("minha-senha");
    expect(a).not.toBe(b);
  });

  it("recusa texto adulterado em vez de decifrar lixo", () => {
    const [versao, iv, tag, dados] = cifrar("minha-senha").split(":");
    const bytes = Buffer.from(dados, "base64");
    bytes[0] ^= 1;

    expect(() => decifrar([versao, iv, tag, bytes.toString("base64")].join(":"))).toThrow();
  });

  it("não decifra com outra chave", () => {
    const guardado = cifrar("minha-senha");
    process.env.EMAIL_CHAVE = randomBytes(32).toString("base64");

    expect(() => decifrar(guardado)).toThrow();
  });

  it("explica quando a chave falta ou não tem o tamanho certo", () => {
    delete process.env.EMAIL_CHAVE;
    expect(criptoConfigurada()).toBe(false);
    expect(() => cifrar("x")).toThrow(/EMAIL_CHAVE/);

    process.env.EMAIL_CHAVE = randomBytes(16).toString("base64");
    expect(criptoConfigurada()).toBe(false);
    expect(() => cifrar("x")).toThrow(/32 bytes/);
  });
});
