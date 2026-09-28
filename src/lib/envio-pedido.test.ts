import { describe, expect, it } from "vitest";

import {
  LIMITE_ANEXOS_BYTES,
  lerListaEmails,
  montarDestinatarios,
  problemaNoEnvio,
  textoPadraoDoEnvio,
} from "./envio-pedido";

const PDF = { nome: "2276-AKILAH-28-10-2026.pdf", tamanho: 80_000 };

describe("destinatários do envio", () => {
  it("junta contatos e avulsos no para, e as cópias no cc", () => {
    expect(
      montarDestinatarios({
        contatos: ["pcp@qualy.com.br"],
        avulsos: ["marcos@qualy.com.br"],
        copiaCliente: "compras@akilah.com.br",
        copiaParaMim: "valquiria@gmail.com",
      }),
    ).toEqual({
      para: ["pcp@qualy.com.br", "marcos@qualy.com.br"],
      cc: ["compras@akilah.com.br", "valquiria@gmail.com"],
    });
  });

  it("não repete ninguém, ignorando maiúsculas, e o para tem preferência", () => {
    expect(
      montarDestinatarios({
        contatos: ["PCP@qualy.com.br", "pcp@qualy.com.br"],
        avulsos: [" pcp@Qualy.com.br "],
        copiaParaMim: "pcp@qualy.com.br",
      }),
    ).toEqual({ para: ["PCP@qualy.com.br"], cc: [] });
  });

  it("lê a lista digitada com qualquer separador", () => {
    expect(lerListaEmails("a@x.com, b@x.com;c@x.com\nd@x.com  e@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
      "e@x.com",
    ]);
    expect(lerListaEmails("  ")).toEqual([]);
  });
});

describe("problemas no envio", () => {
  const base = { para: ["pcp@qualy.com.br"], cc: [], assunto: "Pedido nº 1", anexos: [PDF] };

  it("deixa passar um envio normal", () => {
    expect(problemaNoEnvio(base)).toBeNull();
  });

  it("exige alguém da indústria — só cópia não basta", () => {
    expect(problemaNoEnvio({ ...base, para: [], cc: ["eu@x.com"] })).toMatch(/destinatário/);
  });

  it("aponta o e-mail inválido, inclusive nas cópias", () => {
    expect(problemaNoEnvio({ ...base, para: ["pcp@qualy"] })).toBe("E-mail inválido: pcp@qualy");
    expect(problemaNoEnvio({ ...base, cc: ["sem-arroba"] })).toBe("E-mail inválido: sem-arroba");
  });

  it("exige assunto", () => {
    expect(problemaNoEnvio({ ...base, assunto: "   " })).toMatch(/assunto/);
  });

  it("recusa anexo executável", () => {
    expect(
      problemaNoEnvio({ ...base, anexos: [PDF, { nome: "boleto.PDF.exe", tamanho: 10 }] }),
    ).toMatch(/boleto\.PDF\.exe/);
  });

  it("aceita exatamente o limite e recusa um byte a mais, contando o PDF", () => {
    const resto = LIMITE_ANEXOS_BYTES - PDF.tamanho;

    expect(problemaNoEnvio({ ...base, anexos: [PDF, { nome: "pc.pdf", tamanho: resto }] })).toBeNull();
    expect(
      problemaNoEnvio({ ...base, anexos: [PDF, { nome: "pc.pdf", tamanho: resto + 1 }] }),
    ).toMatch(/limite é 20 MB/);
  });
});

describe("texto padrão", () => {
  it("monta assunto e corpo, pulando o que o pedido não tem", () => {
    const { assunto, corpo } = textoPadraoDoEnvio({
      numero: 2276,
      razaoSocialCliente: "AKILAH EMBALAGENS LTDA",
      cnpjCliente: null,
      pedidoDoCliente: "2356",
      vendedor: "Valquiria Silvestre",
    });

    expect(assunto).toBe("Pedido nº 2276 — AKILAH EMBALAGENS LTDA");
    expect(corpo).toBe(
      "Segue em anexo o pedido nº 2276.\n\nCliente: AKILAH EMBALAGENS LTDA\n" +
        "Pedido do cliente: 2356\n\nValquiria Silvestre",
    );
  });
});
