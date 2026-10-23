/**
 * Testes de navegador dos dados para pagamento na ficha da indústria: os campos
 * na edição, e na leitura o que se vê é o que o Copiar leva.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { PAGAMENTO_VAZIO } from "@/lib/dados-pagamento";

import { SecaoDadosPagamento } from "./dados-pagamento";

const PAGAMENTO = {
  ...PAGAMENTO_VAZIO,
  tipoChavePix: "CNPJ",
  chavePix: "12.345.678/0001-95",
  banco: "Itaú",
  agencia: "1234",
  conta: "56789-0",
  tipoConta: "CORRENTE",
};

afterEach(() => vi.restoreAllMocks());

describe("SecaoDadosPagamento", () => {
  test("editando: um campo para cada coisa, já com o que estava gravado", async () => {
    await render(<SecaoDadosPagamento pagamento={PAGAMENTO} editavel podeEditar />);

    const nomes = [...document.querySelectorAll("input, select, textarea")].map((c) => c.getAttribute("name"));
    expect(nomes).toEqual([
      "pagamentoTipoChavePix",
      "pagamentoChavePix",
      "pagamentoBanco",
      "pagamentoAgencia",
      "pagamentoConta",
      "pagamentoTipoConta",
      "pagamentoFavorecido",
      "pagamentoDocumento",
      "pagamentoObservacoes",
    ]);
    const campo = (nome: string) => page.elementLocator(document.querySelector(`[name="${nome}"]`)!);
    await expect.element(campo("pagamentoTipoChavePix")).toHaveValue("CNPJ");
    await expect.element(campo("pagamentoBanco")).toHaveValue("Itaú");
  });

  test("lendo: as linhas preenchidas, e o Copiar leva exatamente elas", async () => {
    const escrito: string[] = [];
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue({
      writeText: async (texto: string) => void escrito.push(texto),
    } as Clipboard);
    await render(<SecaoDadosPagamento pagamento={PAGAMENTO} editavel={false} podeEditar={false} />);

    await expect.element(page.getByText("PIX (CNPJ): 12.345.678/0001-95")).toBeVisible();
    await expect.element(page.getByText("Banco: Itaú · Agência: 1234 · Conta corrente: 56789-0")).toBeVisible();
    expect(document.querySelector("input")).toBeNull();

    await page.getByRole("button", { name: "Copiar" }).click();
    expect(escrito).toEqual(["PIX (CNPJ): 12.345.678/0001-95\nBanco: Itaú · Agência: 1234 · Conta corrente: 56789-0"]);
  });

  test("vazio: o administrador é mandado ao Editar; o preposto, não", async () => {
    const { rerender } = await render(
      <SecaoDadosPagamento pagamento={PAGAMENTO_VAZIO} editavel={false} podeEditar />,
    );
    await expect
      .element(page.getByText("Nenhum dado de pagamento cadastrado. Clique em Editar para incluir."))
      .toBeVisible();

    await rerender(<SecaoDadosPagamento pagamento={PAGAMENTO_VAZIO} editavel={false} podeEditar={false} />);
    await expect.element(page.getByText("Nenhum dado de pagamento cadastrado.", { exact: true })).toBeVisible();
    expect(page.getByRole("button").elements()).toHaveLength(0);
  });
});

describe("SecaoDadosPagamento — digitando", () => {
  /** Pelo `name`: a dica embaixo entra no nome acessível do campo. */
  const campo = (nome: string) => page.elementLocator(document.querySelector(`[name="${nome}"]`)!);

  test("agência e conta se pontuam sozinhas", async () => {
    await render(<SecaoDadosPagamento pagamento={PAGAMENTO_VAZIO} editavel podeEditar />);

    await userEvent.type(campo("pagamentoAgencia"), "12345");
    await expect.element(campo("pagamentoAgencia")).toHaveValue("1234-5");

    await userEvent.type(campo("pagamentoConta"), "567890");
    await expect.element(campo("pagamentoConta")).toHaveValue("56789-0");

    // O X do Banco do Brasil, no lugar do dígito.
    await userEvent.fill(campo("pagamentoConta"), "");
    await userEvent.type(campo("pagamentoConta"), "12345x");
    await expect.element(campo("pagamentoConta")).toHaveValue("12345-X");
  });

  test("apagar e corrigir no meio da conta: o cursor não pula para o fim", async () => {
    await render(<SecaoDadosPagamento pagamento={{ ...PAGAMENTO_VAZIO, conta: "56789-0" }} editavel podeEditar />);
    const conta = document.querySelector<HTMLInputElement>('[name="pagamentoConta"]')!;

    // Cursor depois do "7" (posição 3): apaga o 7 e digita 1.
    conta.focus();
    conta.setSelectionRange(3, 3);
    await userEvent.keyboard("{Backspace}1");

    await expect.element(campo("pagamentoConta")).toHaveValue("56189-0");
    expect(conta.selectionStart).toBe(3);
  });

  test("a chave segue o tipo: CNPJ desde o primeiro número, e trocar o tipo repontua", async () => {
    await render(<SecaoDadosPagamento pagamento={PAGAMENTO_VAZIO} editavel podeEditar />);

    await userEvent.selectOptions(campo("pagamentoTipoChavePix"), "CNPJ");
    await userEvent.type(campo("pagamentoChavePix"), "12345678");
    await expect.element(campo("pagamentoChavePix")).toHaveValue("12.345.678");

    await userEvent.selectOptions(campo("pagamentoTipoChavePix"), "CPF");
    await expect.element(campo("pagamentoChavePix")).toHaveValue("123.456.78");
  });

  test("e-mail não perde as letras nem ao trocar para CNPJ por engano", async () => {
    await render(<SecaoDadosPagamento pagamento={PAGAMENTO_VAZIO} editavel podeEditar />);

    await userEvent.selectOptions(campo("pagamentoTipoChavePix"), "EMAIL");
    await userEvent.type(campo("pagamentoChavePix"), "financeiro@industria.com.br");
    await expect.element(campo("pagamentoChavePix")).toHaveValue("financeiro@industria.com.br");

    await userEvent.selectOptions(campo("pagamentoTipoChavePix"), "CNPJ");
    await expect.element(campo("pagamentoChavePix")).toHaveValue("financeiro@industria.com.br");

    // E continuar digitando nele não apaga as letras, nem joga o cursor longe.
    await userEvent.type(campo("pagamentoChavePix"), "x");
    await expect.element(campo("pagamentoChavePix")).toHaveValue("financeiro@industria.com.brx");
  });
});
