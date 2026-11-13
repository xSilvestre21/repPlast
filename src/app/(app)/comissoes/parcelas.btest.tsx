/**
 * Testes de navegador do fechamento no editor de parcelas.
 *
 * O que se protege: a pessoa VÊ, enquanto escolhe, em que mês cada parcela vai
 * contar — "vence outubro → recebe dezembro" — e o editor abre com a sugestão
 * da indústria, que se troca ali mesmo para a exceção. E os dias: o prazo do
 * pedido abre o campo só para começar, e fica dito que quem decide é ela. E
 * as duas formas de montar ficam à vista: por dias, ou escolhendo as datas —
 * antes só havia o campo dos dias, e ninguém descobria o calendário.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { EditorParcelas } from "./parcelas";

function abrir(
  fechamento: string,
  salvar = vi.fn(async () => ({})),
  prazoSugerido: string | null = "10/25",
) {
  render(
    <EditorParcelas
      venda="1000.00"
      percentual="5"
      percentualPreposto={null}
      // 10 e 25 dias depois de 01/10: vencem 11/10 e 26/10.
      dataBase="2026-10-01"
      prazoSugerido={prazoSugerido}
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

describe("os dias das parcelas", () => {
  const campoDias = () => page.getByRole("textbox", { name: /^Dias a partir da entrega/ });
  // O texto inteiro da nota, com o prazo em negrito junto: o `toHaveTextContent`
  // daqui compara o texto todo, e a nota é uma frase longa.
  const textoDaNota = () => document.querySelector('[role="note"]')?.textContent ?? "";

  test("abre com o prazo do pedido, dito como ponto de partida", async () => {
    abrir("");

    await expect.element(campoDias()).toHaveValue("10/25");
    await expect.poll(textoDaNota).toContain("10/25 é o prazo de pagamento do pedido");
    expect(textoDaNota()).toContain("Quem decide as parcelas é você");
    await expect.element(page.getByText(/No celular, separe com vírgula: 30,60,90,120/)).toBeVisible();
  });

  test("o primeiro toque seleciona tudo, e o que se digita substitui o prazo do pedido", async () => {
    abrir("");

    await userEvent.click(campoDias());
    await userEvent.keyboard("30,60,90");

    await expect.element(campoDias()).toHaveValue("30,60,90");
    await expect.poll(textoDaNota).toContain("toque em “Dividir em partes iguais”");
  });

  test("dividido, as parcelas seguem os dias dela; e dá para voltar ao do pedido", async () => {
    abrir("");

    await campoDias().fill("30,60,90");
    await page.getByRole("button", { name: "Dividir em partes iguais" }).click();

    await expect.poll(textoDaNota).toContain("As parcelas seguem os seus dias");
    expect(document.querySelectorAll("ol > li")).toHaveLength(3);

    await page.getByRole("button", { name: "voltar a ele" }).click();

    await expect.element(campoDias()).toHaveValue("10/25");
    await expect.poll(textoDaNota).toContain("10/25 é o prazo de pagamento do pedido");
    expect(document.querySelectorAll("ol > li")).toHaveLength(2);
  });
});

describe("como montar as parcelas", () => {
  const forma = (nome: RegExp) => page.getByRole("radio", { name: nome });

  test("com prazo no pedido, abre por dias — e a outra forma está à vista", async () => {
    abrir("");

    await expect.element(page.getByRole("heading", { name: "Como quer montar as parcelas?" })).toBeVisible();
    await expect.element(forma(/^Por dias depois da entrega/)).toHaveAttribute("aria-checked", "true");
    await expect.element(forma(/^Escolhendo as datas/)).toHaveAttribute("aria-checked", "false");
    await expect.element(page.getByRole("heading", { name: "Confira as datas e os valores" })).toBeVisible();
  });

  test("sem prazo legível, espera a escolha: nenhuma parcela ainda", async () => {
    abrir("", undefined, "Antecipado");

    await expect.element(forma(/^Por dias depois da entrega/)).toHaveAttribute("aria-checked", "false");
    await expect.element(forma(/^Escolhendo as datas/)).toHaveAttribute("aria-checked", "false");
    expect(document.querySelectorAll("ol > li")).toHaveLength(0);
    await expect.element(page.getByRole("button", { name: "Salvar parcelas" })).not.toBeInTheDocument();
  });

  test("escolhendo as datas: tantas parcelas, uma por mês a partir da primeira", async () => {
    const salvar = abrir("", undefined, null);

    await forma(/^Escolhendo as datas/).click();
    await page.getByRole("textbox", { name: "Quantas parcelas?" }).fill("3");
    await page.getByRole("button", { name: "Criar parcelas" }).click();

    expect(document.querySelectorAll("ol > li")).toHaveLength(3);
    await page.getByRole("button", { name: "Salvar parcelas" }).click();

    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    const formData = (salvar.mock.calls[0] as unknown as [object, FormData])[1];
    // A primeira nasce um mês depois da entrega (01/10), as outras mês a mês.
    expect(formData.getAll("vencimento")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
    expect(formData.getAll("base")).toEqual(["333,33", "333,33", "333.34"]);
  });

  test("recusa a quantidade que não dá parcelamento, embaixo do campo", async () => {
    abrir("", undefined, null);

    await forma(/^Escolhendo as datas/).click();
    await page.getByRole("textbox", { name: "Quantas parcelas?" }).fill("1");
    await page.getByRole("button", { name: "Criar parcelas" }).click();

    await expect.element(page.getByText(/de 2 a 24, como 3/)).toBeVisible();
    expect(document.querySelectorAll("ol > li")).toHaveLength(0);
  });
});
