/**
 * Testes de navegador da descrição no cadastro de produto.
 *
 * O que se protege: a descrição acompanha as especificações. Abrir e salvar não
 * mexe no texto gravado (o do sistema anterior continua como estava), mas
 * mudar uma medida reescreve a descrição — o saco que virou 35x40 não pode
 * seguir impresso 30x40 no pedido.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { FormularioProduto } from "./formulario";
import { VALORES_VAZIOS } from "./valores";

const SACO = {
  ...VALORES_VAZIOS,
  fornecedorId: "f1",
  familia: "SACO",
  material: "PEAD",
  larguraCm: "30",
  comprimentoCm: "40",
  espessuraMm: "0,06",
  fatorKg: "14",
  descricao: "SACO 30X40 DO SISTEMA ANTIGO",
};

const FORNECEDORES = [
  { id: "f1", nome: "ALFAPLAST", fatorKgPadrao: null, comissaoPercentual: "5", aditivos: [], materiais: [] },
];

async function abrir() {
  await render(
    <FormularioProduto
      fornecedores={FORNECEDORES}
      clientes={[]}
      valores={SACO}
      acao={async () => ({})}
      rotuloEnvio="Salvar"
    />,
  );
  return {
    descricao: page.elementLocator(document.querySelector('[name="descricao"]')!),
    largura: page.elementLocator(document.querySelector('[name="larguraCm"]')!),
  };
}

describe("descrição do produto", () => {
  test("abrir a ficha não mexe no texto gravado", async () => {
    const { descricao } = await abrir();
    await expect.element(descricao).toHaveValue("SACO 30X40 DO SISTEMA ANTIGO");
  });

  test("mudar a medida reescreve a descrição", async () => {
    const { descricao, largura } = await abrir();

    await userEvent.clear(largura);
    await userEvent.type(largura, "35");

    await expect.element(descricao).toHaveValue("35x40x0,06 S/SF PEAD");
  });

  test("o texto ajustado depois da mudança fica, até a próxima mudança", async () => {
    const { descricao, largura } = await abrir();

    await userEvent.clear(largura);
    await userEvent.type(largura, "35");
    await userEvent.type(descricao, " LISO");
    await expect.element(descricao).toHaveValue("35x40x0,06 S/SF PEAD LISO");

    await userEvent.type(largura, "0");
    await expect.element(descricao).toHaveValue("350x40x0,06 S/SF PEAD");
  });
});
