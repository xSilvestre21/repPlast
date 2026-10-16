import { describe, expect, it } from "vitest";

import { problemaNoEmail, provedorParecido } from "./email-valido";

describe("problemaNoEmail", () => {
  it("aceita endereços comuns", () => {
    for (const email of [
      "ana@gmail.com",
      "ana.souza+repplast@escritorio.com.br",
      "contato@val-amaral.com.br",
      "x@ymail.com",
    ]) {
      expect(problemaNoEmail(email), email).toBeNull();
    }
  });

  it("recusa o que o \"tem @ e ponto\" de antes deixava passar", () => {
    for (const email of [
      "ana@gmail..com",
      "ana@gmail.c",
      "ana@-gmail.com",
      ".ana@gmail.com",
      "ana..souza@gmail.com",
      "ana@gmail.com1",
      "ana@@gmail.com",
      "ana@localhost",
    ]) {
      expect(problemaNoEmail(email), email).not.toBeNull();
    }
  });

  it("sugere o provedor quando o domínio é ele digitado errado", () => {
    expect(problemaNoEmail("ana@gmial.com")).toBe("Confira o final do e-mail: não seria @gmail.com?");
    expect(provedorParecido("hotmail.con")).toBe("hotmail.com");
    expect(provedorParecido("outlok.com")).toBe("outlook.com");
  });

  it("não confunde domínio de verdade com erro de digitação", () => {
    expect(provedorParecido("ymail.com")).toBeNull();
    expect(provedorParecido("mail.com")).toBeNull();
    expect(provedorParecido("escritorio.com.br")).toBeNull();
  });
});
