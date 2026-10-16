import { describe, expect, it } from "vitest";

import { CID_LOGO, montarEmailSistema } from "./email-sistema-html";

const LINK = "https://repplast.com.br/redefinir-senha/abc_DEF-123";

const exemplo = {
  nome: "Valquiria Silvestre",
  paragrafos: ["Recebemos um pedido para criar uma senha nova."],
  botao: { rotulo: "Criar senha nova", url: LINK },
  notas: ["Este link vale por 60 minutos e funciona uma vez só.", "Se não foi você, ignore este e-mail."],
};

describe("montarEmailSistema", () => {
  it("põe o link no botão e, de novo, por extenso para copiar", () => {
    const { html } = montarEmailSistema(exemplo);
    expect(html.match(new RegExp(`href="${LINK}"`, "g"))).toHaveLength(2);
    expect(html).toContain(`>${LINK}</a>`);
    expect(html).toContain("Criar senha nova");
  });

  it("traz a marca pelo cid que o envio anexa", () => {
    expect(montarEmailSistema(exemplo).html).toContain(`src="cid:${CID_LOGO}"`);
  });

  it("escapa o que vem do cadastro", () => {
    const { html } = montarEmailSistema({ ...exemplo, nome: `<b>Ana</b> & "Cia"` });
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt; &amp; &quot;Cia&quot;");
    expect(html).not.toContain("<b>Ana</b>");
  });

  it("o texto puro diz o mesmo que o HTML", () => {
    const { texto } = montarEmailSistema(exemplo);
    expect(texto).toContain("Olá, Valquiria Silvestre!");
    expect(texto).toContain(`Criar senha nova:\n${LINK}`);
    for (const nota of exemplo.notas) expect(texto).toContain(nota);
    expect(texto).not.toMatch(/<[a-z]/i);
  });

  it("sem nome, cumprimenta sem nome; sem botão, não desenha botão", () => {
    const { html, texto } = montarEmailSistema({ paragrafos: ["Aviso."] });
    expect(texto.startsWith("Olá!")).toBe(true);
    expect(html).not.toContain("<a href=");
  });
});
