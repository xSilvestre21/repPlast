import { describe, expect, test } from "vitest";

import { filtrarTemas, temasPara, TEMAS } from "./temas";

const ids = (temas: { id: string }[]) => temas.map((t) => t.id);

describe("temasPara", () => {
  test("o administrador do Max vê todos", () => {
    expect(temasPara({ ehAdmin: true, temPrepostos: true })).toHaveLength(TEMAS.length);
  });

  test("o administrador do Solo não vê o rateio", () => {
    expect(ids(temasPara({ ehAdmin: true, temPrepostos: false }))).not.toContain("rateio");
  });

  test("o preposto não recebe o que só o administrador configura", () => {
    const dele = ids(temasPara({ ehAdmin: false, temPrepostos: true }));
    expect(dele).not.toContain("senha-de-app");
    expect(dele).not.toContain("plano");
    expect(dele).not.toContain("rateio");
    expect(dele).toContain("parcelamento");
  });
});

describe("filtrarTemas", () => {
  test("sem busca, todos", () => {
    expect(filtrarTemas(TEMAS, "  ")).toHaveLength(TEMAS.length);
  });

  test("por pedaço, sem acento e sem caixa", () => {
    expect(ids(filtrarTemas(TEMAS, "GMAIL"))).toEqual(["senha-de-app"]);
    expect(ids(filtrarTemas(TEMAS, "parc"))).toContain("parcelamento");
    expect(ids(filtrarTemas(TEMAS, "comissao"))).toContain("comissoes");
  });

  test("todas as palavras têm de aparecer", () => {
    expect(ids(filtrarTemas(TEMAS, "dia fechamento"))).toEqual(["faturamento"]);
    expect(filtrarTemas(TEMAS, "gmail parcela")).toEqual([]);
  });
});
