/**
 * Testes da limpeza da assinatura colada.
 *
 * O HTML vem da área de transferência de quem colou — de qualquer lugar. O
 * que se protege: o que é de assinatura fica (tabela, cor, link, logo), o que
 * roda código sai, e a versão em texto do e-mail sai legível.
 */

import { describe, expect, it } from "vitest";

import { emailHtml, emailTexto, limparAssinatura, textoDaAssinatura } from "./assinatura-email";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

// O formato que o Gmail entrega ao copiar a assinatura da página de configurações.
const DO_GMAIL =
  '<div dir="ltr"><table cellpadding="0" style="color:#333;font-family:Arial"><tbody><tr>' +
  '<td><img src="https://ci3.googleusercontent.com/logo.png" width="96" alt="Val &amp; Amaral"></td>' +
  '<td style="padding-left:12px"><b>Valquiria Silvestre</b><br>Representante comercial<br>' +
  '<a href="tel:+5516999990000">(16) 99999-0000</a> · <a href="https://valeamaral.com.br">valeamaral.com.br</a>' +
  "</td></tr></tbody></table></div>";

describe("limparAssinatura", () => {
  it("guarda o que a assinatura do Gmail tem: tabela, cor, logo e links", () => {
    const { html, imagensPerdidas } = limparAssinatura(DO_GMAIL);

    expect(imagensPerdidas).toBe(0);
    expect(html).toContain('src="https://ci3.googleusercontent.com/logo.png"');
    expect(html).toContain('href="tel:+5516999990000"');
    expect(html).toContain("<b>Valquiria Silvestre</b>");
    expect(html).toContain("color:#333");
    expect(html).toContain("padding-left:12px");
  });

  it("tira o que roda código", () => {
    const { html } = limparAssinatura(
      '<p onclick="roubar()">Valquiria<script>alert(1)</script></p>' +
        '<a href="javascript:alert(1)">clique</a>' +
        '<span style="background:url(https://x.test/rastreio.gif);color:red">oi</span>',
    );

    expect(html).not.toMatch(/script|onclick|javascript|url\(/i);
    expect(html).toContain("Valquiria");
    expect(html).toContain("color:red");
  });

  it("aceita o logo embutido em PNG, e conta a imagem que não veio na cópia", () => {
    const { html, imagensPerdidas } = limparAssinatura(
      `<img src="${PNG}"><img src="blob:https://outlook.live.com/abc"><img src="data:image/svg+xml;base64,PHN2Zz4=">Val`,
    );

    expect(html).toContain(PNG);
    expect(html).not.toMatch(/blob:|svg/);
    expect(imagensPerdidas).toBe(2);
  });

  it("sem texto nem imagem, é sem assinatura", () => {
    expect(limparAssinatura("<div><br></div>  ").html).toBeNull();
    expect(limparAssinatura("").html).toBeNull();
  });

  it("recusa a assinatura pesada demais, embaixo do campo", () => {
    const enorme = `<img src="data:image/png;base64,${"A".repeat(600_000)}">`;
    expect(() => limparAssinatura(enorme)).toThrow(/grande demais/);
  });
});

describe("texto da assinatura", () => {
  it("uma linha por bloco, sem tags nem entidades", () => {
    expect(textoDaAssinatura(limparAssinatura(DO_GMAIL).html!)).toBe(
      "Valquiria Silvestre\nRepresentante comercial\n(16) 99999-0000 · valeamaral.com.br",
    );
  });

  it("o e-mail em texto leva a assinatura depois do separador de praxe", () => {
    expect(emailTexto("Segue o pedido.\n", "<p>Val</p>")).toBe("Segue o pedido.\n\n-- \nVal");
  });
});

describe("emailHtml", () => {
  it("a mensagem continua texto: escapada, com as quebras de linha", () => {
    const html = emailHtml("Preço < R$ 10\nAbraço", "<p>Val</p>");
    expect(html).toContain("Preço &lt; R$ 10<br>");
    expect(html).toContain("<p>Val</p>");
  });
});
