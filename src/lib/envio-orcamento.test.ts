import { describe, expect, it } from "vitest";

import { problemaNoModeloDaProposta, textoPadraoDoOrcamento } from "./envio-orcamento";

const COMPLETA = {
  numero: 193,
  cliente: "AKILAH EMBALAGENS LTDA",
  attn: "Sr. Marcelo",
  // Coluna `date`: meia-noite UTC. Em São Paulo seria 29/10 — o texto diz 30.
  validoAte: new Date("2026-10-30T00:00:00.000Z"),
  prazoPagamento: "28/35/42",
  vendedor: "Valquiria Silvestre",
};

describe("texto padrão da proposta", () => {
  it("preenche tudo com a proposta completa", () => {
    const { assunto, corpo } = textoPadraoDoOrcamento(COMPLETA);

    expect(assunto).toBe("Proposta nº 193 — AKILAH EMBALAGENS LTDA");
    expect(corpo).toBe(
      "A/C Sr. Marcelo\n\nSegue em anexo nossa proposta nº 193.\n" +
        "Preços válidos até 30/10/2026.\nPrazo de pagamento: 28/35/42\n\n" +
        "Fico à disposição para qualquer dúvida.\n\nValquiria Silvestre",
    );
  });

  it("sem os dados opcionais, as linhas somem sem deixar o e-mail começar em branco", () => {
    const { corpo } = textoPadraoDoOrcamento({
      ...COMPLETA,
      attn: null,
      validoAte: null,
      prazoPagamento: null,
      vendedor: null,
    });

    expect(corpo).toBe(
      "Segue em anexo nossa proposta nº 193.\n\nFico à disposição para qualquer dúvida.",
    );
  });

  it("usa o modelo da pessoa e fala de proposta ao apontar erro", () => {
    expect(
      textoPadraoDoOrcamento(COMPLETA, { assunto: "Orçamento {numero}", corpo: "Oi, {aos_cuidados}!" }),
    ).toEqual({ assunto: "Orçamento 193", corpo: "Oi, Sr. Marcelo!" });

    expect(problemaNoModeloDaProposta("{cnpj}")).toBe("{cnpj} não é um dado da proposta.");
    expect(problemaNoModeloDaProposta("{se valido_ate}x{fim}")).toBeNull();
  });
});
