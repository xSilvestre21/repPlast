/**
 * Testes de navegador da apuração no celular em pé.
 *
 * O que se protege: abaixo de 640px a linha do pedido vira cartão — nada fica
 * escondido à direita, e cada valor tem o rótulo que perdeu com o cabeçalho —,
 * e "acertar" abre o acerto numa folha que sobe de baixo, e não dentro da
 * linha, onde o formulário herdava a largura da tabela e saía cortado.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { Tabela } from "@/components/ui";

import { type LinhaPedido, LinhaComissao } from "./acerto";
import { colunasDaComissao } from "./colunas";

const PEDIDO: LinhaPedido = {
  id: "p1",
  numero: 2300,
  status: "ENVIADO",
  motivoCancelamento: "",
  apelidoCliente: "SUPERMERCADOS IRMÃOS CASTRO-MACHADO",
  prazoEntrega: "2026-10-05",
  entregueEm: null,
  base: "12500",
  percentual: "5",
  previsto: 625,
  valorRecebido: "",
  percentualRecebido: "",
  recebido: null,
  preposto: null,
  corPreposto: null,
  percentualPreposto: null,
  rateio: null,
  rateioRecebido: null,
  podeAcertar: true,
  parcela: null,
  venda: "12500",
  prazoPagamento: null,
  dataBaseParcelas: "2026-10-05",
  fechamento: "",
  dataCompetencia: "2026-10-05",
  parcelasAtuais: [],
  podeParcelar: true,
  parcelarExigeDesfazerAcerto: false,
};

function montar() {
  return render(
    <Tabela colunas={colunasDaComissao(true)} larguraMinima="min-w-200" className="tabela-cartoes">
      <LinhaComissao
        pedido={PEDIDO}
        comPercentual
        salvar={async () => ({})}
        salvarParcelas={async () => ({})}
        desfazerParcelas={async () => ({})}
      />
    </Tabela>,
  );
}

describe("apuração no celular em pé", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });
  afterEach(async () => {
    await page.viewport(1280, 720);
  });

  test("a linha vira cartão: nada passa da largura, o nome aparece inteiro e cada valor tem rótulo", async () => {
    await montar();

    const tabela = document.querySelector("table")!;
    expect(tabela.getBoundingClientRect().width).toBeLessThanOrEqual(390);
    expect(getComputedStyle(document.querySelector("thead")!).display).toBe("none");

    const cliente = document.querySelector<HTMLElement>('[data-area="cliente"] span')!;
    expect(cliente.scrollWidth).toBeLessThanOrEqual(cliente.clientWidth);

    const previsto = document.querySelector('[data-area="previsto"]')!;
    expect(getComputedStyle(previsto, "::before").content).toBe('"Previsto"');
  });

  test("acertar abre a folha que sobe de baixo, com o formulário dentro", async () => {
    await montar();

    await page.getByRole("button", { name: /acertar/ }).click();

    const folha = page.getByRole("dialog");
    await expect.element(folha).toBeVisible();
    await expect.element(folha.getByRole("heading", { name: "Acerto do pedido #2300" })).toBeVisible();
    await expect.element(folha.getByText("Valor recebido")).toBeVisible();
    // A linha do painel da tela larga não existe aqui.
    expect(document.querySelector("tr[hidden]")).toBeNull();

    await folha.getByRole("button", { name: "Fechar" }).click();
    await expect.element(folha).not.toBeInTheDocument();
  });

  test("o parcelamento cabe na folha: nenhuma parcela fica para o lado", async () => {
    await montar();

    await page.getByRole("button", { name: /acertar/ }).click();
    const folha = page.getByRole("dialog");
    await folha.getByRole("button", { name: "Parcelar o recebimento" }).click();
    // Com vírgula, como se digita no teclado do iPhone.
    await folha.getByLabelText(/^Dias a partir da entrega/).fill("28,35,42");
    await folha.getByRole("button", { name: "Dividir em partes iguais" }).click();

    await expect.element(folha.getByText("restante")).toBeVisible();
    const caixa = document.querySelector("dialog")!.getBoundingClientRect();
    const parcelas = [...document.querySelectorAll("dialog ol > li")];
    expect(parcelas).toHaveLength(3);
    for (const parcela of parcelas) {
      expect(parcela.scrollWidth).toBeLessThanOrEqual(parcela.clientWidth);
      expect(parcela.getBoundingClientRect().right).toBeLessThanOrEqual(caixa.right);
    }
  });
});
