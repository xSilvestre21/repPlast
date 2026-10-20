import { describe, expect, it } from "vitest";

import {
  cabeNoTopo,
  normalizarNomeEscritorio,
  problemaNoNomeEscritorio,
  proximaTrocaPermitida,
} from "./escritorio-regras";

describe("cabeNoTopo", () => {
  it("aceita nomes que cabem em duas linhas no menor espaço do topo", () => {
    expect(cabeNoTopo("Representação Prado")).toBe(true);
    expect(cabeNoTopo("Moreira & Guimarães Representações Ltda")).toBe(true);
    expect(cabeNoTopo("QUALIPLAST REP. COMERCIAIS")).toBe(true);
  });

  it("decide pela quebra das palavras, não pela contagem de caracteres", () => {
    // 36 caracteres e não cabe: "REPRESENTAÇÕES" sozinha quase enche uma linha.
    expect(cabeNoTopo("QUALIPLAST REPRESENTAÇÕES COMERCIAIS")).toBe(false);
    // 39 e cabe.
    expect(cabeNoTopo("Moreira & Guimarães Representações Ltda")).toBe(true);
  });

  it("recusa o que precisaria de três linhas", () => {
    expect(cabeNoTopo("Representações Comerciais de Embalagens Plásticas Ltda")).toBe(false);
  });

  it("ignora espaços repetidos e nas pontas, como o navegador", () => {
    expect(cabeNoTopo("  Representação    Prado  ")).toBe(cabeNoTopo("Representação Prado"));
  });

  it("conta caractere fora da tabela como o mais largo", () => {
    expect(cabeNoTopo("Representação Prado")).toBe(true);
    expect(cabeNoTopo("代表代表代表代表代表代表代表代表代表代表代表代表代表代表")).toBe(false);
  });
});

describe("normalizarNomeEscritorio", () => {
  it("tira espaço das pontas e junta os repetidos", () => {
    expect(normalizarNomeEscritorio("  Vera   &  Assis ")).toBe("Vera & Assis");
  });
});

describe("problemaNoNomeEscritorio", () => {
  it("aceita nome que cabe", () => {
    expect(problemaNoNomeEscritorio("Vera & Assis")).toBeNull();
  });

  it("recusa vazio, comprido demais e o que não cabe no topo", () => {
    expect(problemaNoNomeEscritorio("")).toMatch(/Informe o nome/);
    expect(problemaNoNomeEscritorio("a ".repeat(30).trim())).toMatch(/até 45 caracteres — este tem 59/);
    expect(problemaNoNomeEscritorio("MOREIRA REPRESENTAÇÕES LTDA")).toMatch(/não cabe inteiro/);
  });
});

describe("proximaTrocaPermitida", () => {
  const dia = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 24 * 60 * 60 * 1000);
  const criadaEm = dia(0);

  it("troca à vontade nos 7 primeiros dias", () => {
    expect(proximaTrocaPermitida({ criadaEm, ultimaTroca: dia(5), agora: dia(6) })).toBeNull();
  });

  it("troca feita no prazo livre não segura a seguinte", () => {
    expect(proximaTrocaPermitida({ criadaEm, ultimaTroca: dia(6), agora: dia(8) })).toBeNull();
  });

  it("depois do prazo livre, uma troca a cada 30 dias", () => {
    expect(proximaTrocaPermitida({ criadaEm, ultimaTroca: dia(10), agora: dia(20) })).toEqual(dia(40));
    expect(proximaTrocaPermitida({ criadaEm, ultimaTroca: dia(10), agora: dia(40) })).toBeNull();
  });

  it("nunca trocou: pode", () => {
    expect(proximaTrocaPermitida({ criadaEm, ultimaTroca: null, agora: dia(100) })).toBeNull();
  });
});
