/**
 * Testes de navegador da demonstração "Como funciona", nos produtos por milheiro.
 *
 * O que se protege: frasco, bombona e tampa mostram a descrição do cadastro
 * (`descricaoDoTipo`) e o preço da linha da tabela — e pôr a tampa no frasco
 * troca os dois, para o conjunto, sem somar frasco + tampa.
 *
 * Rode com:  npx vitest run --config vitest.browser.config.mts como-funciona.btest
 */

import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { ComoFunciona } from "./como-funciona";
import { Movimento } from "./movimento";

async function abrir() {
  return render(
    <Movimento>
      <ComoFunciona />
    </Movimento>,
  );
}

type Tela = Awaited<ReturnType<typeof abrir>>;

async function escolherProduto(tela: Tela, nome: string) {
  await tela.getByRole("group", { name: "Produto do exemplo" }).getByRole("button", { name: nome }).click();
}

async function escolher(tela: Tela, grupo: string, opcao: string) {
  await tela.getByRole("group", { name: grupo, exact: true }).getByRole("button", { name: opcao }).click();
}

describe("a demonstração com frasco, bombona e tampa", () => {
  test("a troca tem os seis produtos", async () => {
    const tela = await abrir();
    const troca = tela.getByRole("group", { name: "Produto do exemplo" });

    for (const nome of ["Saco", "Stretch", "Fita", "Frasco", "Bombona", "Tampa"]) {
      await expect.element(troca.getByRole("button", { name: nome })).toBeVisible();
    }
  });

  test("pôr a tampa no frasco vira o conjunto: descrição com o + Tampa e o preço da linha dele", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Frasco");

    await expect.element(tela.getByText("Frasco 500mL PEAD Cilíndrico", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*620,00/)).toBeVisible();

    await escolher(tela, "Tampa", "Com tampa");

    await expect
      .element(tela.getByText("Frasco 500mL PEAD Cilíndrico + Tampa 28mm PP Rosca", { exact: true }))
      .toBeVisible();
    // O conjunto é outra linha da tabela (790), não 620 + o preço da tampa.
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*790,00/)).toBeVisible();

    await tela.getByRole("tab", { name: /Preço/ }).click();
    await expect.element(tela.getByText("o conjunto tem linha própria")).toBeVisible();
  });

  test("a bombona por unidade sai pelo milheiro dividido por mil", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Bombona");

    await expect
      .element(tela.getByText("Bombona 20L PEAD Boca Estreita + Tampa 51mm PP Lacre", { exact: true }))
      .toBeVisible();
    await expect.element(tela.getByText(/Preço da unidade:\s*R\$\s*13,10/)).toBeVisible();

    await escolher(tela, "Vender por", "Milheiro");
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*13\.100,00/)).toBeVisible();
  });

  test("a tampa sozinha muda a descrição e o preço com o diâmetro", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Tampa");

    await expect.element(tela.getByText("Tampa 28mm PP Flip Top", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*205,00/)).toBeVisible();

    await escolher(tela, "Diâmetro", "53 mm");

    await expect.element(tela.getByText("Tampa 53mm PP Flip Top", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*395,00/)).toBeVisible();
  });
});
