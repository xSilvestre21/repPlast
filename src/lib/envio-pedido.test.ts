import { describe, expect, it } from "vitest";

import {
  LIMITE_ANEXOS_BYTES,
  PEDIDO_EXEMPLO,
  condicoesDoModelo,
  pedidoExemploSem,
  lerListaEmails,
  montarDestinatarios,
  problemaNoEnvio,
  problemaNoModelo,
  textoPadraoDoEnvio,
  variaveisDesconhecidas,
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

  const PEDIDO = {
    numero: 2276,
    razaoSocialCliente: "AKILAH EMBALAGENS LTDA",
    cnpjCliente: null,
    pedidoDoCliente: "2356",
    vendedor: null,
  };

  it("usa o modelo da pessoa, sumindo com a linha de campo vazio", () => {
    const { assunto, corpo } = textoPadraoDoEnvio(PEDIDO, {
      assunto: "PC {pedido_cliente} / nosso {numero}",
      corpo: "Bom dia!\nCNPJ: {cnpj}\nPedido {numero} de {cliente}.\n\nAtt,\n{vendedor}",
    });

    expect(assunto).toBe("PC 2356 / nosso 2276");
    expect(corpo).toBe("Bom dia!\nPedido 2276 de AKILAH EMBALAGENS LTDA.\n\nAtt,");
  });

  it("volta ao texto de sempre quando o modelo está vazio", () => {
    expect(textoPadraoDoEnvio(PEDIDO, { assunto: null, corpo: "" })).toEqual(
      textoPadraoDoEnvio(PEDIDO),
    );
  });

  it("deixa à vista a variável que não existe", () => {
    expect(textoPadraoDoEnvio(PEDIDO, { corpo: "Oi {clinte}" }).corpo).toBe("Oi {clinte}");
    expect(variaveisDesconhecidas("{numero} {clinte} {clinte}")).toEqual(["clinte"]);
  });
});

describe("trecho condicional", () => {
  const COM = {
    numero: 2278,
    razaoSocialCliente: "AKILAH EMBALAGENS LTDA",
    cnpjCliente: null,
    pedidoDoCliente: "PC-4512",
    vendedor: "Ana",
  };
  const SEM = { ...COM, pedidoDoCliente: null };

  const MODELO = [
    "Segue o pedido {numero}.",
    "",
    "{se pedido_cliente}",
    "Referente ao seu pedido de compra {pedido_cliente}.",
    "Favor conferir antes de faturar.",
    "{fim}",
    "",
    "Att,",
    "{vendedor}",
  ].join("\n");

  it("mostra o trecho quando o pedido tem o dado, sem sobrar linha das etiquetas", () => {
    expect(textoPadraoDoEnvio(COM, { corpo: MODELO }).corpo).toBe(
      "Segue o pedido 2278.\n\nReferente ao seu pedido de compra PC-4512.\n" +
        "Favor conferir antes de faturar.\n\nAtt,\nAna",
    );
  });

  it("tira o trecho inteiro quando falta, sem deixar buraco duplo", () => {
    expect(textoPadraoDoEnvio(SEM, { corpo: MODELO }).corpo).toBe(
      "Segue o pedido 2278.\n\nAtt,\nAna",
    );
  });

  it("funciona no meio da linha, no assunto e um dentro do outro", () => {
    const { assunto, corpo } = textoPadraoDoEnvio(SEM, {
      assunto: "Pedido {numero}{se pedido_cliente} (PC {pedido_cliente}){fim}",
      corpo: "A{se vendedor} B{se cnpj} C{fim} D{fim}.",
    });
    expect(assunto).toBe("Pedido 2278");
    expect(corpo).toBe("A B D.");
  });

  it("aponta bloco aberto, fim sobrando e dado que não existe", () => {
    expect(problemaNoModelo(MODELO)).toBeNull();
    expect(problemaNoModelo("{se cnpj} x")).toMatch(/Falta o \{fim\}.*\{se cnpj\}/);
    expect(problemaNoModelo("x {fim}")).toMatch(/sobrando/);
    expect(problemaNoModelo("{se clinte}x{fim}")).toMatch(/\{clinte\} não é um dado/);
  });
});

describe("prévia sem as condições", () => {
  it("tira do exemplo só os dados usados em {se …}", () => {
    const nomes = condicoesDoModelo("{cnpj} {se pedido_cliente}x{fim} {se pedido_cliente}y{fim}");
    expect(nomes).toEqual(["pedido_cliente"]);
    expect(pedidoExemploSem(nomes)).toEqual({ ...PEDIDO_EXEMPLO, pedidoDoCliente: null });
  });
});
