/**
 * Testes de navegador do tema.
 *
 * O que se protege:
 *   - sem nada salvo, o tema é Automático e acompanha o modo do aparelho —
 *     inclusive quando ele troca com o app aberto;
 *   - fixar Claro ou Escuro pinta a barra do navegador (`theme-color`) na cor
 *     da página, e não na do aparelho: era a faixa de outra cor no topo;
 *   - voltar ao Automático apaga a escolha e devolve as cores por modo;
 *   - a chave antiga (`tema`) é apagada antes da primeira pintura, e quem a
 *     tinha volta ao Automático.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { cdp, page } from "vitest/browser";

async function modoDoAparelho(modo: "light" | "dark") {
  await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: modo }] });
}

/** As duas `theme-color` que o `layout.tsx` gera, como no app de verdade. */
function porMetas() {
  for (const media of ["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"]) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.media = media;
    meta.content = media.includes("dark") ? "#0b0b0f" : "#fbfbfc";
    document.head.append(meta);
  }
}
const cores = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);

let modulo: typeof import("./alternador-tema");

beforeAll(async () => {
  localStorage.clear();
  porMetas();
  // Depois das metas: o módulo pinta a barra ao carregar.
  modulo = await import("./alternador-tema");
});

afterEach(async () => {
  await modoDoAparelho("light");
  localStorage.clear();
  delete document.documentElement.dataset.tema;
});

describe("tema", () => {
  test("sem nada salvo, é Automático e acompanha o aparelho", async () => {
    await modoDoAparelho("light");
    await render(<modulo.EscolhaTema />);
    await expect.element(page.getByRole("button", { name: "Automático" })).toHaveAttribute("aria-pressed", "true");

    await render(<modulo.AlternadorTema />);
    await expect.element(page.getByRole("button", { name: "Mudar para o tema escuro" })).toBeVisible();

    // O aparelho troca para o escuro com o app aberto: o sol/lua acompanha.
    await modoDoAparelho("dark");
    await expect.element(page.getByRole("button", { name: "Mudar para o tema claro" })).toBeVisible();
    expect(document.documentElement.dataset.tema).toBeUndefined();
  });

  test("fixar Escuro grava a escolha e pinta a barra de escuro, mesmo no aparelho claro", async () => {
    await modoDoAparelho("light");
    await render(<modulo.EscolhaTema />);

    await page.getByRole("button", { name: "Escuro" }).click();

    expect(document.documentElement.dataset.tema).toBe("escuro");
    expect(localStorage.getItem("tema-escolhido")).toBe("escuro");
    expect(cores()).toEqual(["#0b0b0f", "#0b0b0f"]);
  });

  test("voltar ao Automático apaga a escolha e devolve as cores por modo", async () => {
    await render(<modulo.EscolhaTema />);
    await page.getByRole("button", { name: "Claro" }).click();
    expect(cores()).toEqual(["#fbfbfc", "#fbfbfc"]);

    await page.getByRole("button", { name: "Automático" }).click();

    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(localStorage.getItem("tema-escolhido")).toBeNull();
    expect(cores()).toEqual(["#fbfbfc", "#0b0b0f"]);
  });

  test("a chave antiga é apagada antes da pintura, e quem a tinha volta ao Automático", () => {
    localStorage.setItem("tema", "escuro");

    new Function(modulo.SCRIPT_TEMA)();

    expect(localStorage.getItem("tema")).toBeNull();
    expect(document.documentElement.dataset.tema).toBeUndefined();
  });
});
