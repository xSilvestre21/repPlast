/**
 * Testes de navegador do aviso dos 7 dias grátis no cadastro.
 *
 * O que se protege: ninguém cria o escritório sem ter marcado que viu QUANDO e
 * QUANTO vai ser cobrado; e o CPF/CNPJ que já usou o teste não segue para o
 * pagamento achando que é grátis — o formulário troca o aceite pelo de pagar
 * hoje, e o botão diz isso.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { EstadoFormulario } from "@/lib/erro-formulario";

import { FormularioCadastro } from "./formulario";

const TESTE = { hoje: "09/11", ultimoDia: "15/11", cobranca: "16/11", valor: "R$ 79,00" };

async function abrir(acao = vi.fn(async (): Promise<EstadoFormulario> => ({}))) {
  const tela = await render(<FormularioCadastro acao={acao} plano="solo" teste={TESTE} />);
  return { tela, acao };
}

/**
 * Envia sem a validação do navegador: aqui interessa o que a tela faz com a
 * resposta do servidor, e não preencher os doze campos obrigatórios.
 */
function enviarSemValidar() {
  const formulario = document.querySelector("form")!;
  formulario.noValidate = true;
  formulario.requestSubmit();
}

describe("o aviso dos 7 dias grátis", () => {
  test("o aceite é obrigatório e diz a data e o valor da primeira cobrança", async () => {
    const { tela } = await abrir();

    const aceite = tela.getByRole("checkbox", { name: /Entendi: nada é cobrado hoje/ });
    await expect.element(aceite).toBeRequired();
    await expect.element(aceite).not.toBeChecked();
    await expect
      .element(tela.getByText(/até 15\/11, a primeira mensalidade, de R\$ 79,00, é cobrada no cartão em 16\/11/))
      .toBeVisible();
    // O botão do checkout do Asaas diz "Pagar R$ 79,00" mesmo no teste: a explicação vem antes.
    await expect.element(tela.getByText(/No Asaas, o botão diz “Pagar R\$ 79,00”/)).toBeVisible();
    await expect
      .element(tela.getByRole("button", { name: "Cadastrar o cartão e começar o teste" }))
      .toBeVisible();
  });

  test("o servidor recusando sem o aceite, a frase aparece embaixo da caixa", async () => {
    const { tela } = await abrir(
      vi.fn(async () => ({
        erro: "Para começar os 7 dias grátis, marque que entendeu quando vem a primeira cobrança.",
        campo: "teste",
      })),
    );

    enviarSemValidar();

    await expect.element(tela.getByText(/marque que entendeu quando vem a primeira cobrança/)).toBeVisible();
    await expect.element(tela.getByRole("checkbox", { name: /Entendi: nada é cobrado hoje/ })).toBeVisible();
  });

  test("o CPF/CNPJ que já testou troca o aceite pelo de pagar hoje, e o botão também", async () => {
    const { tela } = await abrir(
      vi.fn(async () => ({
        erro: "Este CPF/CNPJ já usou os 7 dias grátis em outro escritório, e por isso a primeira mensalidade é cobrada hoje.",
        campo: "pagarHoje",
      })),
    );

    enviarSemValidar();

    const pagarHoje = tela.getByRole("checkbox", { name: /Pagar a primeira mensalidade hoje/ });
    await expect.element(pagarHoje).toBeRequired();
    await expect.element(tela.getByText(/já usou os 7 dias grátis em outro escritório, e por isso/)).toBeVisible();
    await expect.element(tela.getByRole("checkbox", { name: /Entendi: nada é cobrado hoje/ })).not.toBeInTheDocument();
    await expect.element(tela.getByRole("button", { name: "Continuar para o pagamento" })).toBeVisible();
  });

  test("marcado o pagar hoje, uma recusa em outro campo não traz o teste de volta", async () => {
    const { tela } = await abrir(
      vi.fn(async () => ({
        erro: "Já existe uma conta com este e-mail.",
        campo: "email",
        valores: { pagarHoje: "sim" },
      })),
    );

    enviarSemValidar();

    await expect.element(tela.getByRole("checkbox", { name: /Pagar a primeira mensalidade hoje/ })).toBeChecked();
    await expect.element(tela.getByRole("button", { name: "Continuar para o pagamento" })).toBeVisible();
  });
});
