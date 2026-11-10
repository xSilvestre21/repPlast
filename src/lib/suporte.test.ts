import { describe, expect, test } from "vitest";

import { linkEmail, linkWhatsapp, SUPORTE, temWhatsapp, whatsappEscrito } from "./suporte";

describe("suporte", () => {
  test("o número vale com 55, DDD e 8 ou 9 dígitos — só dígitos", () => {
    expect(temWhatsapp("5511912345678")).toBe(true);
    expect(temWhatsapp("551133334444")).toBe(true);
    expect(temWhatsapp("")).toBe(false);
    expect(temWhatsapp("11912345678")).toBe(false);
    expect(temWhatsapp("+55 (11) 91234-5678")).toBe(false);
  });

  test("escrito para ler", () => {
    expect(whatsappEscrito("5511912345678")).toBe("(11) 91234-5678");
    expect(whatsappEscrito("551133334444")).toBe("(11) 3333-4444");
    expect(whatsappEscrito("")).toBe("");
  });

  test("o link abre a conversa com a frase pronta", () => {
    expect(linkWhatsapp("Olá! Tudo bem?", "5511912345678")).toBe(
      "https://wa.me/5511912345678?text=Ol%C3%A1!%20Tudo%20bem%3F",
    );
  });

  test("o e-mail é o dos Termos, com assunto", () => {
    expect(linkEmail()).toBe(`mailto:${SUPORTE.email}?subject=Ajuda%20com%20o%20RepPlast`);
  });

  test("o número configurado é válido, e sai escrito para ler", () => {
    expect(temWhatsapp()).toBe(true);
    expect(whatsappEscrito()).toBe("(19) 99868-2321");
  });
});
