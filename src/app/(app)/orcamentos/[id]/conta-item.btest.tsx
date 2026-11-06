/**
 * Testes de navegador do item por conta da proposta.
 *
 * O que se protege: trocar de tipo recomeça a conta. O que sobrasse da peça
 * anterior entraria na descrição e no preço de um item que ninguém pediu.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { ContaItem } from "./conta-item";

async function abrir() {
  const tela = await render(
    <ContaItem
      materiais={[]}
      aditivos={[]}
      industrias={[{ id: "f2", rotulo: "SOROPLAST" }]}
      adicionar={async () => ({})}
    />,
  );

  const escolherTipo = async (pedaco: string, nome: string) => {
    await userEvent.clear(tela.getByRole("combobox", { name: "Tipo" }));
    await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), pedaco);
    await tela.getByRole("option", { name: nome, exact: true }).click();
  };

  return {
    tela,
    escolherTipo,
    campo: (nome: string) => page.elementLocator(document.querySelector(`[name="${nome}"]`)!),
  };
}

describe("trocar de tipo no item por conta", () => {
  test("do conjunto para só a tampa, a conta recomeça", async () => {
    const { tela, campo, escolherTipo } = await abrir();

    await escolherTipo("bombona", "Bombona + Tampa");
    await userEvent.type(campo("capacidade"), "20");
    await userEvent.type(campo("diametroMm"), "63");
    await userEvent.type(campo("precoAvulso"), "2.000,00");
    await userEvent.type(campo("quantidade"), "3");
    await tela.getByRole("button", { name: "Cor" }).first().click();
    await tela.getByRole("button", { name: "Natural" }).click();
    await expect.element(campo("descricao")).toHaveValue("Bombona 20L Natural + Tampa 63mm");

    await escolherTipo("tampa", "Tampa");

    await expect.element(campo("complemento")).toHaveValue("");
    await expect.element(campo("diametroMm")).toHaveValue("");
    await expect.element(campo("precoAvulso")).toHaveValue("");
    await expect.element(campo("quantidade")).toHaveValue("");
    await expect.element(campo("descricao")).toHaveValue("Tampa");
  });
});

describe("tampa e acabamento na conta", () => {
  test("na conta, a escolha da mão de obra soma ao preço do item", async () => {
    const { tela, campo, escolherTipo } = await abrir();

    await escolherTipo("frasco", "Frasco");
    await userEvent.type(campo("capacidade"), "500");
    await userEvent.type(campo("precoAvulso"), "2.000,00");
    await tela.getByRole("checkbox", { name: "Serigrafado" }).click();
    await userEvent.type(campo("acabamentoValorCom"), "150,00");
    await userEvent.type(campo("acabamentoValorSem"), "90,00");

    await expect.element(campo("descricao")).toHaveValue("Frasco 500mL Serigrafado");
    await expect.element(campo("precoUnitario")).toHaveValue("2.000,00");

    await tela.getByRole("radio", { name: /^Com mão de obra/ }).click();
    await expect.element(campo("precoUnitario")).toHaveValue("2.150,00");

    await tela.getByRole("radio", { name: /^Sem mão de obra/ }).click();
    await expect.element(campo("precoUnitario")).toHaveValue("2.090,00");
  });

  test("com um valor só, a conta já cobra esse", async () => {
    const { tela, campo, escolherTipo } = await abrir();

    await escolherTipo("frasco", "Frasco");
    await userEvent.type(campo("precoAvulso"), "2.000,00");
    await tela.getByRole("checkbox", { name: "Serigrafado" }).click();
    await userEvent.type(campo("acabamentoValorSem"), "90,00");

    await expect.element(tela.getByRole("radio", { name: /^Sem mão de obra/ })).toBeChecked();
    await expect.element(campo("precoUnitario")).toHaveValue("2.090,00");
  });

  test("com variável, o seletor vale para esta proposta e não oferece a mesma indústria", async () => {
    const { tela, escolherTipo } = await abrir();

    await escolherTipo("frasco", "Frasco + Tampa");
    await expect
      .element(tela.getByRole("combobox", { name: "Fornecedor da tampa", exact: true }))
      .toBeVisible();

    await tela.getByRole("checkbox", { name: "Fornecedor variável Escolher em cada pedido" }).click();

    await tela.getByRole("combobox", { name: "Fornecedor da tampa nesta proposta" }).click();
    await expect.element(tela.getByRole("option", { name: "SOROPLAST" })).toBeVisible();
    await expect
      .element(tela.getByRole("option", { name: "Mesma indústria do produto" }))
      .not.toBeInTheDocument();
  });
});
