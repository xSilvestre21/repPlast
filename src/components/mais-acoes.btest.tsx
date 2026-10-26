/**
 * Testes de navegador do "Mais ações".
 *
 * O que se protege: no computador as ações aparecem no lugar, como sempre; no
 * celular em pé elas se recolhem num botão que abre a folha que sobe de baixo —
 * antes, sete botões empilhados ocupavam a primeira tela da ficha do pedido.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { MaisAcoes } from "./mais-acoes";

const ACOES = (
  <MaisAcoes titulo="Pedido 2265">
    <button type="button">Duplicar</button>
    <button type="button">Apagar</button>
  </MaisAcoes>
);

afterEach(async () => {
  await page.viewport(1280, 720);
});

describe("MaisAcoes", () => {
  test("no computador, as ações aparecem no lugar", async () => {
    await render(ACOES);
    await expect.element(page.getByRole("button", { name: "Duplicar" })).toBeVisible();
    expect(page.getByRole("button", { name: "Mais ações" }).elements()).toHaveLength(0);
  });

  test("no celular, recolhem num botão que abre a folha", async () => {
    await page.viewport(390, 844);
    await render(ACOES);

    await expect.element(page.getByRole("button", { name: "Mais ações" })).toBeVisible();
    expect(page.getByRole("button", { name: "Duplicar" }).elements()).toHaveLength(0);

    await page.getByRole("button", { name: "Mais ações" }).click();
    const folha = page.getByRole("dialog", { name: "Pedido 2265" });
    await expect.element(folha).toBeVisible();
    await expect.element(folha.getByRole("button", { name: "Apagar" })).toBeVisible();
  });
});
