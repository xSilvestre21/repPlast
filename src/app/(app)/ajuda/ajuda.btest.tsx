/**
 * Testes de navegador da página de Ajuda.
 *
 * O que se protege:
 *   - a busca filtra os temas por pedaço, e nada achado tem o caminho de volta;
 *   - o preposto não recebe os temas que só o administrador configura;
 *   - as demonstrações fazem a conta de verdade: as parcelas fecham na venda, e
 *     vencimento depois do fechamento joga a comissão dois meses à frente;
 *   - os passos do Gmail se marcam e a contagem anda.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent, type Locator } from "vitest/browser";

import { Ajuda } from "./ajuda";
import { temasPara } from "./temas";

function abrir({ ehAdmin = true, temPrepostos = true } = {}) {
  return render(<Ajuda temas={temasPara({ ehAdmin, temPrepostos })} ehAdmin={ehAdmin} />);
}

const tema = (nome: string) => page.getByRole("region", { name: nome });

/** O texto do elemento, ou vazio enquanto ele não existe. */
const texto = (onde: Locator) => onde.query()?.textContent ?? "";

describe("página de Ajuda", () => {
  test("a busca filtra os temas, e apagar devolve todos", async () => {
    await abrir();
    const busca = page.getByRole("searchbox", { name: "O que você quer saber?" });

    await userEvent.fill(busca, "gmail");
    await expect.element(tema("E-mail: a senha de app")).toBeVisible();
    await expect.element(tema("Parcelamento")).not.toBeInTheDocument();

    await userEvent.fill(busca, "zzzz");
    await expect.element(page.getByText("Nada encontrado")).toBeVisible();
    await page.getByRole("button", { name: "Limpar busca" }).click();

    await expect.element(tema("Parcelamento")).toBeInTheDocument();
  });

  test("o preposto não recebe a senha de app, o plano nem o rateio", async () => {
    await abrir({ ehAdmin: false });

    await expect.element(tema("Parcelamento")).toBeInTheDocument();
    await expect.element(tema("E-mail: a senha de app")).not.toBeInTheDocument();
    await expect.element(tema("Plano e cobrança")).not.toBeInTheDocument();
    await expect.element(tema("Prepostos e rateio")).not.toBeInTheDocument();
  });

  test("parcelamento: 3.000,00 em 28/35/42 dá três de 1.000,00, e a soma fecha", async () => {
    await abrir();
    const parcelas = tema("Parcelamento").getByRole("list", { name: "Parcelas" }).getByRole("listitem");

    await expect.poll(() => parcelas.elements().length).toBe(3);
    await expect.poll(() => texto(parcelas.nth(0))).toMatch(/02\/11/);
    await expect.poll(() => texto(parcelas.nth(0))).toMatch(/1\.000,00/);

    // Outro prazo: duas parcelas, e o que não divide vai para a última.
    await userEvent.fill(tema("Parcelamento").getByLabelText(/Valor da venda/), "100,01");
    await userEvent.fill(tema("Parcelamento").getByLabelText(/Dias a partir da entrega/), "30/60");

    await expect.poll(() => parcelas.elements().length).toBe(2);
    await expect.poll(() => texto(parcelas.nth(0))).toMatch(/50,00/);
    await expect.poll(() => texto(parcelas.nth(1))).toMatch(/50,01/);
  });

  test("parcelamento: o prazo do pedido é só o começo, e dá para voltar a ele", async () => {
    await abrir();
    const parcelamento = tema("Parcelamento");
    const nota = parcelamento.getByRole("note");
    const dias = parcelamento.getByLabelText(/Dias a partir da entrega/);
    const parcelas = parcelamento.getByRole("list", { name: "Parcelas" }).getByRole("listitem");

    await expect
      .poll(() => texto(nota))
      .toMatch(/28\/35\/42 é o prazo de pagamento do pedido.*Quem decide as parcelas é você/);

    // Com vírgula, como no teclado do celular.
    await userEvent.fill(dias, "30,60");
    await expect.poll(() => texto(nota)).toMatch(/Parcelas pelos seus dias/);
    await expect.poll(() => parcelas.elements().length).toBe(2);

    await parcelamento.getByRole("button", { name: "voltar a ele" }).click();
    await expect.element(dias).toHaveValue("28/35/42");
    await expect.poll(() => parcelas.elements().length).toBe(3);
  });

  test("faturamento: vence dia 25 com fechamento 20 e a comissão entra em dezembro", async () => {
    await abrir();
    const faturamento = tema("Dia de faturamento");

    await expect.poll(() => texto(faturamento.getByRole("status"))).toMatch(/só paga em dezembro/);

    await faturamento.getByRole("button", { name: "Não tem" }).click();
    await expect.poll(() => texto(faturamento.getByRole("status"))).toMatch(/no próprio mês: outubro/);
  });

  test("os passos do Gmail se marcam, e a contagem anda", async () => {
    await abrir();
    const email = tema("E-mail: a senha de app");

    await expect.element(email.getByText("0 de 3 feitos")).toBeInTheDocument();
    await email.getByRole("button", { name: "Marcar o passo 1 como feito" }).click();
    await expect.element(email.getByText("1 de 3 feitos")).toBeInTheDocument();
    // Feito o primeiro, o segundo abre sozinho.
    await expect.element(email.getByRole("button", { name: "Crie a senha de app" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
