/**
 * Testes de navegador do fechamento no editor de parcelas.
 *
 * O que se protege: a pessoa VÊ, enquanto escolhe, em que mês cada parcela vai
 * contar — "vence outubro → recebe dezembro" — e o editor abre com a sugestão
 * da indústria, que se troca ali mesmo para a exceção.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { EditorParcelas } from "./parcelas";

function abrir(fechamento: string, salvar = vi.fn(async () => ({}))) {
  render(
    <EditorParcelas
      venda="1000.00"
      percentual="5"
      percentualPreposto={null}
      // 10 e 25 dias depois de 01/10: vencem 11/10 e 26/10.
      dataBase="2026-10-01"
      prazoSugerido="10/25"
      fechamento={fechamento}
      atuais={[]}
      salvar={salvar}
      desfazer={null}
      aoFechar={() => {}}
    />,
  );
  return salvar;
}

describe("quando a indústria paga a comissão", () => {
  test("com a sugestão da indústria, cada linha diz o mês em que recebe", async () => {
    abrir("20");

    await expect.element(page.getByRole("textbox", { name: "Fatura até o dia" })).toHaveValue("20");
    // 11/10 está antes do fechamento; 26/10 entra no faturamento de novembro.
    await expect.element(page.getByText("→ recebe novembro de 2026")).toBeVisible();
    await expect.element(page.getByText("→ recebe dezembro de 2026")).toBeVisible();
  });

  test("trocar o dia muda o mês na hora", async () => {
    abrir("20");

    await page.getByRole("textbox", { name: "Fatura até o dia" }).fill("30");
    await expect.element(page.getByText("→ recebe novembro de 2026").nth(1)).toBeVisible();
    await expect.element(page.getByText("→ recebe dezembro de 2026")).not.toBeInTheDocument();
  });

  test("a exceção: no mês do vencimento, nada se desloca e o dia some", async () => {
    abrir("20");

    await page.getByRole("button", { name: "no mês do vencimento" }).click();
    await expect.element(page.getByRole("textbox", { name: "Fatura até o dia" })).not.toBeInTheDocument();
    await expect.element(page.getByText(/→ recebe/)).not.toBeInTheDocument();
  });

  test("indústria sem fechamento abre no mês do vencimento, e manda o dia escolhido", async () => {
    const salvar = abrir("");

    await expect.element(page.getByRole("button", { name: "no mês do vencimento" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "no mês seguinte ao faturamento" }).click();
    await page.getByRole("button", { name: "Salvar parcelas" }).click();

    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    const formData = (salvar.mock.calls[0] as unknown as [object, FormData])[1];
    expect(formData.get("pagamento")).toBe("seguinte");
    expect(formData.get("diaFechamentoComissao")).toBe("30");
  });
});
