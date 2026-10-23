/**
 * Testes de navegador dos dados para pagamento na ficha da indústria: os campos
 * na edição, e na leitura o que se vê é o que o Copiar leva.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
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
