/**
 * Testes de navegador da demonstração "Como funciona", nos produtos de tabela.
 *
 * O que se protege: frasco, bombona, tampa, pote, balde e pré-forma mostram a
 * descrição do cadastro (`descricaoDoTipo`) e o preço da linha da tabela — e pôr
 * a tampa troca os dois, para o conjunto, sem somar peça + tampa. Big bag, fita
 * de arquear e plástico bolha saem na unidade em que o mercado cota.
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
  await tela
    .getByRole("group", { name: "Produto do exemplo" })
    .getByRole("button", { name: nome, exact: true })
    .click();
}

async function escolher(tela: Tela, grupo: string, opcao: string) {
  await tela.getByRole("group", { name: grupo, exact: true }).getByRole("button", { name: opcao }).click();
}

describe("a demonstração com frasco, bombona e tampa", () => {
  test("a trilha tem os doze produtos, e o do meio diz qual é e quantos são", async () => {
    const tela = await abrir();
    const troca = tela.getByRole("group", { name: "Produto do exemplo" });

    for (const nome of [
      "Saco",
      "Stretch",
      "Fita",
      "Frasco",
      "Bombona",
      "Tampa",
      "Pote",
      "Balde",
      "Pré-forma",
      "Big bag",
      "Fita de arquear",
      "Plástico bolha",
    ]) {
      await expect.element(troca.getByRole("button", { name: nome, exact: true })).toBeVisible();
    }

    await expect.element(tela.getByText("1 de 12")).toBeVisible();
    await tela.getByRole("button", { name: "Produto anterior" }).click();
    await expect.element(tela.getByText("12 de 12")).toBeVisible();
    await expect
      .element(troca.getByRole("button", { name: "Plástico bolha", exact: true }))
      .toHaveAttribute("aria-pressed", "true");
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

describe("a demonstração com os produtos que vieram depois", () => {
  test("o pote com tampa é o conjunto; sem ela, a linha do pote", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Pote");

    await expect
      .element(tela.getByText("Pote 500mL PP Redondo Boca 90mm + Tampa 90mm PP Rosca", { exact: true }))
      .toBeVisible();
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*740,00/)).toBeVisible();

    await escolher(tela, "Tampa", "Sem tampa");

    await expect.element(tela.getByText("Pote 500mL PP Redondo Boca 90mm", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*560,00/)).toBeVisible();
  });

  test("o balde abre por unidade, e a alça de metal custa mais", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Balde");

    await expect
      .element(tela.getByText("Balde 20L PP Alça Metálica + Tampa 290mm PP Lacre", { exact: true }))
      .toBeVisible();
    await expect.element(tela.getByText(/Preço da unidade:\s*R\$\s*9,50/)).toBeVisible();

    await escolher(tela, "Alça", "Plástica");
    await expect.element(tela.getByText(/Preço da unidade:\s*R\$\s*8,60/)).toBeVisible();
  });

  test("a pré-forma sai pelo peso, e o gargalo muda a descrição e a linha", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Pré-forma");

    await expect.element(tela.getByText("Pré-forma 18g PET PCO 1881 Cristal", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*210,00/)).toBeVisible();

    await escolher(tela, "Gargalo", "PCO 1810");
    await expect.element(tela.getByText("Pré-forma 18g PET PCO 1810 Cristal", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do milheiro:\s*R\$\s*222,00/)).toBeVisible();
  });

  test("o big bag se vende por unidade, e a válvula muda a descrição e o preço", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Big bag");

    await expect
      .element(tela.getByText("Big bag 90x90x120cm PP 1000 kg 4 Alças Fundo Plano", { exact: true }))
      .toBeVisible();
    await expect.element(tela.getByText(/Preço da unidade:\s*R\$\s*39,90/)).toBeVisible();

    await escolher(tela, "Fundo", "Com válvula");
    await expect
      .element(tela.getByText("Big bag 90x90x120cm PP 1000 kg 4 Alças Fundo C/ Válvula", { exact: true }))
      .toBeVisible();
    await expect.element(tela.getByText(/Preço da unidade:\s*R\$\s*45,90/)).toBeVisible();

    await tela.getByRole("tab", { name: /Preço/ }).click();
    await expect.element(tela.getByText("o cadastro escolhe")).toBeVisible();
  });

  test("a fita de arquear se vende por quilo, e a largura traz a espessura", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Fita de arquear");

    await expect.element(tela.getByText("Fita de arquear 12x0,6mm PP Preta", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do quilo:\s*R\$\s*15,40/)).toBeVisible();

    await escolher(tela, "Largura", "16 mm");
    await expect.element(tela.getByText("Fita de arquear 16x0,8mm PP Preta", { exact: true })).toBeVisible();
    await expect.element(tela.getByText(/Preço do quilo:\s*R\$\s*14,90/)).toBeVisible();
  });

  test("o plástico bolha sai como o mercado escreve, e a bolha grande custa mais", async () => {
    const tela = await abrir();
    await escolherProduto(tela, "Plástico bolha");

    await expect
      .element(tela.getByText("Plástico bolha 1,30 x 100m PEBD Bolha Pequena", { exact: true }))
      .toBeVisible();
    await expect.element(tela.getByText(/Preço da unidade:\s*R\$\s*94,00/)).toBeVisible();

    await escolher(tela, "Bolha", "Grande");
    await expect
      .element(tela.getByText("Plástico bolha 1,30 x 100m PEBD Bolha Grande", { exact: true }))
      .toBeVisible();
    await expect.element(tela.getByText(/Preço da unidade:\s*R\$\s*106,00/)).toBeVisible();
  });
});
