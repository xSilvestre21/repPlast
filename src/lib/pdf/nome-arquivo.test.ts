/**
 * O gabarito são os nomes dos quatro pedidos reais em `referencia/`.
 */

import { describe, expect, it } from "vitest";

import { nomeArquivoPedido, nomeArquivoRelatorio } from "./nome-arquivo";

/** Data em UTC ao meio-dia: evita o fuso empurrar o dia para trás. */
const emUtc = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("nome do arquivo do pedido", () => {
  it("reproduz os quatro nomes reais", () => {
    expect(
      nomeArquivoPedido({
        numero: 2253,
        apelidoCliente: "MARIOL",
        pedidoDoCliente: "228156",
        prazoEntrega: emUtc("2026-10-09"),
      }),
    ).toBe("2253-MARIOL-PC-228156-09-10-2026.pdf");

    expect(
      nomeArquivoPedido({
        numero: 2256,
        apelidoCliente: "LEMEPACK",
        pedidoDoCliente: null,
        prazoEntrega: emUtc("2026-09-30"),
      }),
    ).toBe("2256-LEMEPACK-30-09-2026.pdf");

    expect(
      nomeArquivoPedido({
        numero: 133,
        apelidoCliente: "CASTRO-MACHI",
        pedidoDoCliente: null,
        prazoEntrega: emUtc("2026-06-12"),
      }),
    ).toBe("133-CASTRO-MACHI-12-06-2026.pdf");

    expect(
      nomeArquivoPedido({
        numero: 146,
        apelidoCliente: "AN-PARAFUSOS",
        pedidoDoCliente: null,
        prazoEntrega: emUtc("2026-08-25"),
      }),
    ).toBe("146-AN-PARAFUSOS-25-08-2026.pdf");
  });

  it("usa a data de ENTREGA, não a de emissão", () => {
    // No pedido 2253 a emissão foi 10/09 e a entrega 09/10 — o nome traz a entrega.
    const nome = nomeArquivoPedido({
      numero: 2253,
      apelidoCliente: "MARIOL",
      pedidoDoCliente: null,
      prazoEntrega: emUtc("2026-10-09"),
    });

    expect(nome).toContain("09-10-2026");
    expect(nome).not.toContain("10-09-2026");
  });

  it("tira acento e espaço do apelido", () => {
    expect(
      nomeArquivoPedido({
        numero: 7,
        apelidoCliente: "Embalagens São João & Cia",
        pedidoDoCliente: null,
        prazoEntrega: emUtc("2026-01-05"),
      }),
    ).toBe("7-EMBALAGENS-SAO-JOAO-CIA-05-01-2026.pdf");
  });

  it("omite o pedido do cliente quando não houver", () => {
    const nome = nomeArquivoPedido({
      numero: 10,
      apelidoCliente: "CLI",
      pedidoDoCliente: null,
      prazoEntrega: emUtc("2026-03-01"),
    });

    expect(nome).toBe("10-CLI-01-03-2026.pdf");
    expect(nome).not.toContain("PC-");
  });
});

describe("nome do arquivo do relatório dos gráficos", () => {
  it("é Relatorio-escritório-mês-ano, sem acento e com hífen no lugar do espaço", () => {
    expect(nomeArquivoRelatorio("Representação Modelo", "2026-09", "pdf")).toBe(
      "Relatorio-Representacao-Modelo-09-2026.pdf",
    );
  });

  it("tira o símbolo que não viaja no cabeçalho do download", () => {
    expect(nomeArquivoRelatorio('Silva & Filhos "Ltda."', "2026-01", "html")).toBe(
      "Relatorio-Silva-Filhos-Ltda-01-2026.html",
    );
  });

  it("não fica com o nome vazio quando o escritório é só símbolo", () => {
    expect(nomeArquivoRelatorio("***", "2026-12", "pdf")).toBe("Relatorio-Escritorio-12-2026.pdf");
  });
});
