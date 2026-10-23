/**
 * Testes de navegador da busca lembrada: o cookie que a lista grava e o vigia
 * que o apaga quando a pessoa troca de seção.
 *
 * Em `node` não há `document.cookie`; aqui é o do Chromium de verdade.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { esquecerOutras, lembrarBusca, nomeDoCookie, SECOES_COM_BUSCA } from "@/lib/busca-lembrada";

const navegacao = vi.hoisted(() => ({ caminho: "/produtos" }));
vi.mock("next/navigation", () => ({ usePathname: () => navegacao.caminho }));

import { EsquecerBuscas } from "./esquecer-buscas";

/** O valor do cookie da seção, já decodificado, ou `null`. */
function lembrado(secao: (typeof SECOES_COM_BUSCA)[number]): string | null {
  const par = document.cookie.split("; ").find((p) => p.startsWith(`${nomeDoCookie(secao)}=`));
  return par ? decodeURIComponent(par.slice(par.indexOf("=") + 1)) : null;
}

afterEach(() => esquecerOutras(null));

describe("lembrarBusca", () => {
  test("grava a query da lista no cookie da seção", () => {
    lembrarBusca("/produtos?busca=M%26G&situacao=todos");
    expect(lembrado("produtos")).toBe("busca=M%26G&situacao=todos");
  });

  test("sem query — a pessoa limpou os filtros —, esquece", () => {
    lembrarBusca("/produtos?busca=vega");
    lembrarBusca("/produtos");
    expect(lembrado("produtos")).toBeNull();
  });

  test("fora das listas não grava nada", () => {
    lembrarBusca("/configuracoes?busca=x");
    expect(document.cookie).not.toContain("repplast_busca_");
  });
});

describe("EsquecerBuscas", () => {
  test("na seção, mantém a busca dela e apaga a das outras", async () => {
    lembrarBusca("/produtos?busca=vega");
    lembrarBusca("/clientes?busca=acme");
    navegacao.caminho = "/produtos/abc?editar=1";

    await render(<EsquecerBuscas />);

    expect(lembrado("produtos")).toBe("busca=vega");
    expect(lembrado("clientes")).toBeNull();
  });

  test("fora das listas (Painel, Configurações), esquece todas", async () => {
    lembrarBusca("/produtos?busca=vega");
    lembrarBusca("/pedidos?status=ENVIADO");
    navegacao.caminho = "/";

    await render(<EsquecerBuscas />);

    for (const secao of SECOES_COM_BUSCA) expect(lembrado(secao)).toBeNull();
  });

  test("trocar de aba esquece a seção de onde saiu", async () => {
    lembrarBusca("/produtos?busca=vega");
    navegacao.caminho = "/produtos";
    const tela = await render(<EsquecerBuscas />);
    expect(lembrado("produtos")).toBe("busca=vega");

    navegacao.caminho = "/clientes";
    await tela.rerender(<EsquecerBuscas />);

    await expect.poll(() => lembrado("produtos")).toBeNull();
  });
});
