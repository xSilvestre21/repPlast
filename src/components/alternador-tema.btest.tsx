/**
 * Testes de navegador do tema.
 *
 * O que se protege:
 *   - sem nada salvo, o tema é Automático e acompanha o modo do aparelho —
 *     inclusive quando ele troca com o app aberto;
 *   - fixar Claro ou Escuro grava a escolha e põe o tema na página;
 *   - voltar ao Automático apaga a escolha;
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

let modulo: typeof import("./alternador-tema");

beforeAll(async () => {
  localStorage.clear();
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

  test("fixar Escuro grava a escolha e escurece a página, mesmo no aparelho claro", async () => {
    await modoDoAparelho("light");
    await render(<modulo.EscolhaTema />);

    await page.getByRole("button", { name: "Escuro" }).click();

    expect(document.documentElement.dataset.tema).toBe("escuro");
    expect(localStorage.getItem("tema-escolhido")).toBe("escuro");
  });

  test("voltar ao Automático apaga a escolha", async () => {
    await render(<modulo.EscolhaTema />);
    await page.getByRole("button", { name: "Claro" }).click();
    expect(localStorage.getItem("tema-escolhido")).toBe("claro");

    await page.getByRole("button", { name: "Automático" }).click();

    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(localStorage.getItem("tema-escolhido")).toBeNull();
  });

  test("a chave antiga é apagada antes da pintura, e quem a tinha volta ao Automático", () => {
    localStorage.setItem("tema", "escuro");

    new Function(modulo.SCRIPT_TEMA)();

    expect(localStorage.getItem("tema")).toBeNull();
    expect(document.documentElement.dataset.tema).toBeUndefined();
  });
});
