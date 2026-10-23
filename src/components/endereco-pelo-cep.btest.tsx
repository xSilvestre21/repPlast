/**
 * Testes de navegador do endereço pelo CEP das fichas de cliente e fornecedor:
 * o que se preenche, o que fica, e a resposta atrasada que não vale mais.
 *
 * O ViaCEP é trocado por `consultarCep` falso — cada teste diz o que ele responde.
 *
 * Rode com:  npm run test:navegador
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import type { ResultadoCep } from "@/lib/cep";

const viacep = vi.hoisted(() => ({
  respostas: {} as Record<string, ResultadoCep | Promise<ResultadoCep>>,
}));
vi.mock("@/lib/cep", () => ({
  consultarCep: (cep: string) => Promise.resolve(cep in viacep.respostas ? viacep.respostas[cep] : "inexistente"),
}));

import { EnderecoPeloCep, type ValoresEndereco } from "./endereco-pelo-cep";

const VAZIO: ValoresEndereco = {
  endereco: "",
  numero: "",
  complemento: "",
  cep: "",
  bairro: "",
  municipio: "",
  uf: "",
};

const PAULISTA = { logradouro: "Avenida Paulista", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" };

/** Pelo `name`: a dica que aparece embaixo entra no nome acessível do campo. */
const campo = (nome: string) => page.elementLocator(document.querySelector(`input[name="${nome}"]`)!);

beforeEach(() => {
  viacep.respostas = {};
});

describe("EnderecoPeloCep", () => {
  test("o CEP vem antes da rua, e o número e o complemento logo depois dela", async () => {
    await render(<EnderecoPeloCep valores={VAZIO} />);

    const nomes = [...document.querySelectorAll("input")].map((input) => input.name);
    expect(nomes).toEqual(["cep", "endereco", "numero", "complemento", "bairro", "municipio", "uf"]);
  });

  test("CEP completo preenche rua, bairro e cidade, e o cursor vai para o número", async () => {
    viacep.respostas["01310100"] = PAULISTA;
    await render(<EnderecoPeloCep valores={VAZIO} />);

    await userEvent.type(campo("cep"), "01310100");

    await expect.element(campo("endereco")).toHaveValue("Avenida Paulista");
    await expect.element(campo("bairro")).toHaveValue("Bela Vista");
    await expect.element(campo("municipio")).toHaveValue("São Paulo");
    await expect.element(campo("uf")).toHaveValue("SP");
    await expect.element(campo("numero")).toHaveFocus();
    await expect.element(page.getByText("São Paulo/SP")).toBeVisible();
  });

  test("a mesma rua já escrita fica como está — com o número e o complemento", async () => {
    viacep.respostas["01310100"] = PAULISTA;
    await render(
      <EnderecoPeloCep valores={{ ...VAZIO, endereco: "AVENIDA PAULISTA", numero: "1578", complemento: "Sala 3" }} />,
    );

    await userEvent.type(campo("cep"), "01310100");

    await expect.element(campo("municipio")).toHaveValue("São Paulo");
    await expect.element(campo("endereco")).toHaveValue("AVENIDA PAULISTA");
    await expect.element(campo("numero")).toHaveValue("1578");
    await expect.element(campo("complemento")).toHaveValue("Sala 3");
  });

  test("outra rua é trocada pela do CEP novo, e o número da antiga sai junto", async () => {
    viacep.respostas["01310100"] = PAULISTA;
    await render(
      <EnderecoPeloCep valores={{ ...VAZIO, endereco: "Rua Velha", numero: "10", complemento: "Fundos", bairro: "Centro" }} />,
    );

    await userEvent.type(campo("cep"), "01310100");

    await expect.element(campo("endereco")).toHaveValue("Avenida Paulista");
    await expect.element(campo("numero")).toHaveValue("");
    await expect.element(campo("complemento")).toHaveValue("");
    await expect.element(campo("bairro")).toHaveValue("Bela Vista");
  });

  test("CEP geral de cidade pequena: só a cidade, e a rua pede para ser escrita", async () => {
    viacep.respostas["13690000"] = { logradouro: "", bairro: "", cidade: "Descalvado", uf: "SP" };
    await render(<EnderecoPeloCep valores={VAZIO} />);

    await userEvent.type(campo("cep"), "13690000");

    await expect.element(campo("municipio")).toHaveValue("Descalvado");
    await expect.element(campo("endereco")).toHaveValue("");
    await expect.element(campo("endereco")).toHaveFocus();
    await expect
      .element(page.getByText("Este CEP vale para toda Descalvado/SP: escreva a rua e o bairro."))
      .toBeVisible();
  });

  test("CEP que não existe avisa embaixo dele e não mexe em nada", async () => {
    await render(<EnderecoPeloCep valores={{ ...VAZIO, endereco: "Rua Velha", numero: "10" }} />);

    await userEvent.type(campo("cep"), "99999999");

    await expect.element(page.getByText("Não achamos este CEP. Confira os números, como 12345-678.")).toBeVisible();
    await expect.element(campo("endereco")).toHaveValue("Rua Velha");
    await expect.element(campo("numero")).toHaveValue("10");
  });

  test("ViaCEP fora do ar: manda escrever à mão", async () => {
    viacep.respostas["01310100"] = null;
    await render(<EnderecoPeloCep valores={VAZIO} />);

    await userEvent.type(campo("cep"), "01310100");

    await expect
      .element(page.getByText("Não conseguimos buscar o endereço pelo CEP agora. Escreva a rua, o bairro e a cidade."))
      .toBeVisible();
  });

  test("a resposta de um CEP já trocado não vale mais", async () => {
    let soltar!: (resultado: ResultadoCep) => void;
    viacep.respostas["11111111"] = new Promise((resolver) => (soltar = resolver));
    viacep.respostas["01310100"] = PAULISTA;
    await render(<EnderecoPeloCep valores={VAZIO} />);

    await userEvent.type(campo("cep"), "11111111");
    await userEvent.fill(campo("cep"), "01310100");
    await expect.element(campo("municipio")).toHaveValue("São Paulo");

    soltar({ logradouro: "Rua Atrasada", bairro: "Longe", cidade: "Outra", uf: "RJ" });
    await new Promise((pronto) => setTimeout(pronto, 50));
    await expect.element(campo("municipio")).toHaveValue("São Paulo");
    await expect.element(campo("endereco")).toHaveValue("Avenida Paulista");
  });
});
