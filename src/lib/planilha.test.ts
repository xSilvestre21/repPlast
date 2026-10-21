import { strFromU8, unzipSync } from "fflate";
import { describe, expect, test } from "vitest";

import { gerarPlanilha, larguraDaColuna, letraDaColuna, type ColunaPlanilha } from "./planilha";

const COLUNAS: ColunaPlanilha[] = [
  { titulo: "Pedido", tipo: "inteiro" },
  { titulo: "Cliente", tipo: "texto" },
  { titulo: "Entregue em", tipo: "data" },
  { titulo: "Base sem IPI", tipo: "moeda" },
  { titulo: "% comissão", tipo: "percentual" },
];

function abrir(arquivo: Uint8Array) {
  const partes = unzipSync(arquivo);
  return Object.fromEntries(Object.entries(partes).map(([nome, bytes]) => [nome, strFromU8(bytes)]));
}

describe("planilha .xlsx", () => {
  test("traz as partes que o Excel exige", () => {
    const partes = abrir(gerarPlanilha("Pedidos", COLUNAS, []));
    expect(Object.keys(partes).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  test("cada coluna abre da largura do maior valor dela", () => {
    const aba = abrir(
      gerarPlanilha("Pedidos", COLUNAS, [
        ["2257", "FRIGORÍFICO SERRA VERDE", new Date("2026-10-01T00:00:00Z"), "1234567.89", "3"],
      ]),
    )["xl/worksheets/sheet1.xml"];

    const larguras = [...aba.matchAll(/<col min="(\d+)" max="\d+" width="(\d+)"/g)].map((m) => Number(m[2]));
    // "FRIGORÍFICO SERRA VERDE" tem 23 caracteres; "R$ 1.234.567,89", 15 —
    // mais 10% e duas casas de folga.
    expect(larguras[1]).toBe(28);
    expect(larguras[3]).toBe(19);
    // Nenhuma coluna mais estreita que o próprio título.
    COLUNAS.forEach((coluna, i) => expect(larguras[i]).toBeGreaterThan(coluna.titulo.length));
  });

  test("número, moeda e data vão como número; texto vai escapado", () => {
    const aba = abrir(
      gerarPlanilha("Pedidos", COLUNAS, [
        ["2257", 'COSTA & MELO <"SP">', new Date("2026-10-01T00:00:00Z"), "-12.5", null],
      ]),
    )["xl/worksheets/sheet1.xml"];

    expect(aba).toContain('<c r="A2" s="5"><v>2257</v></c>');
    expect(aba).toContain("COSTA &amp; MELO &lt;&quot;SP&quot;&gt;");
    // 01/10/2026 é o dia 46296 contado a partir de 30/12/1899.
    expect(aba).toContain('<c r="C2" s="3"><v>46296</v></c>');
    expect(aba).toContain('<c r="D2" s="2"><v>-12.5</v></c>');
    // Célula vazia não é escrita.
    expect(aba).not.toContain('r="E2"');
    // Cabeçalho congelado e com filtro.
    expect(aba).toContain('state="frozen"');
    expect(aba).toContain('<autoFilter ref="A1:E2"/>');
  });

  test("largura tem piso e teto", () => {
    expect(larguraDaColuna({ titulo: "N", tipo: "texto" }, ["a"])).toBe(8);
    expect(larguraDaColuna({ titulo: "Obs", tipo: "texto" }, ["x".repeat(200)])).toBe(60);
  });

  test("letra da coluna passa do Z", () => {
    expect([0, 25, 26, 27, 701, 702].map(letraDaColuna)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });
});
