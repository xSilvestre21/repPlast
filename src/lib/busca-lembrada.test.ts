/**
 * A busca lembrada das listas: de qual seção é cada caminho, e com que
 * parâmetros a lista abre — os da URL, ou os lembrados quando a URL não traz
 * nenhum.
 *
 * O cookie em si (gravar, apagar ao trocar de seção) só existe no navegador:
 * ver `components/esquecer-buscas.btest.tsx`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { nomeDoCookie, secaoDoCaminho } from "./busca-lembrada";

const lembrados = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (lembrados.has(nome) ? { name: nome, value: lembrados.get(nome)! } : undefined),
  }),
}));

const { parametrosDaLista } = await import("./busca-lembrada-servidor");

describe("secaoDoCaminho", () => {
  it("acha a seção na lista, na ficha e na edição", () => {
    expect(secaoDoCaminho("/produtos")).toBe("produtos");
    expect(secaoDoCaminho("/produtos?busca=vega")).toBe("produtos");
    expect(secaoDoCaminho("/produtos/abc-123?editar=1")).toBe("produtos");
    expect(secaoDoCaminho("/pedidos/novo")).toBe("pedidos");
  });

  it("fora das listas não é seção nenhuma", () => {
    expect(secaoDoCaminho("/")).toBeNull();
    expect(secaoDoCaminho("/configuracoes")).toBeNull();
    expect(secaoDoCaminho("/produtosx")).toBeNull();
  });
});

describe("parametrosDaLista", () => {
  beforeEach(() => lembrados.clear());

  it("sem nada na URL, abre com a busca lembrada da seção", async () => {
    lembrados.set(nomeDoCookie("produtos"), "busca=vega+pack&situacao=todos&l=90");

    expect(await parametrosDaLista("produtos", {})).toEqual({
      busca: "vega pack",
      situacao: "todos",
      l: "90",
    });
  });

  it("guarda o que a busca tem de especial, como & e acento", async () => {
    const consulta = new URLSearchParams({ busca: "M&G Embalagens — São Paulo" }).toString();
    lembrados.set(nomeDoCookie("clientes"), consulta);

    expect(await parametrosDaLista("clientes", {})).toEqual({ busca: "M&G Embalagens — São Paulo" });
  });

  it("a URL com filtro manda: um link explícito não é trocado pela busca de antes", async () => {
    lembrados.set(nomeDoCookie("pedidos"), "busca=antiga");

    expect(await parametrosDaLista("pedidos", { status: "ENVIADO" })).toEqual({ status: "ENVIADO" });
  });

  it("cada seção lembra a sua", async () => {
    lembrados.set(nomeDoCookie("produtos"), "busca=vega");

    expect(await parametrosDaLista("clientes", {})).toEqual({});
  });
});
