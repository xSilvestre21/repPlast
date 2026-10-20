/**
 * Testes de navegador do painel de acerto do pedido.
 *
 * O que se protege:
 *   - o acerto lançado errado tem volta: "desfazer acerto" pergunta antes e
 *     envia `desfazer=sim`, mesmo com o % ainda preenchido no campo — antes,
 *     apagar só o valor dava erro, e parecia que não havia como desfazer;
 *   - o pedido sem parcelas diz em que mês a comissão dele conta, e muda na
 *     hora quando se troca a exceção do fechamento.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { type LinhaPedido, LinhaComissao } from "./acerto";

const PEDIDO: LinhaPedido = {
  id: "p1",
  numero: 142,
  status: "ENVIADO",
  motivoCancelamento: "",
  apelidoCliente: "ORION",
  prazoEntrega: "2026-10-15",
  entregueEm: null,
  base: "1000",
  percentual: "5",
  previsto: 50,
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
  venda: "1000",
  prazoPagamento: null,
  dataBaseParcelas: "2026-10-15",
  fechamento: "",
  dataCompetencia: "2026-10-15",
  parcelasAtuais: [],
  podeParcelar: true,
  parcelarExigeDesfazerAcerto: false,
};

const ACERTADO: LinhaPedido = {
  ...PEDIDO,
  valorRecebido: "1.000,00",
  percentualRecebido: "50",
  recebido: 500,
  podeParcelar: false,
  parcelarExigeDesfazerAcerto: true,
};

function abrir(pedido: LinhaPedido) {
  const salvar = vi.fn(async (_estado: object, formData: FormData) => {
    void formData;
    return {};
  });
  render(
    <table>
      <tbody>
        <LinhaComissao
          pedido={pedido}
          comPercentual
          salvar={salvar}
          salvarParcelas={async () => ({})}
          desfazerParcelas={async () => ({})}
        />
      </tbody>
    </table>,
  );
  return salvar;
}

describe("desfazer acerto", () => {
  test("pergunta antes, e o Cancelar não desfaz", async () => {
    const salvar = abrir(ACERTADO);

    await page.getByRole("button", { name: "acerto" }).click();
    await page.getByRole("button", { name: "desfazer acerto" }).click();

    await expect.element(page.getByText("Desfazer o acerto do pedido #142?")).toBeVisible();
    await expect.element(page.getByText(/volta a contar só como previsto/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    expect(salvar).not.toHaveBeenCalled();
  });

  test("confirmado, envia o desfazer mesmo com o % preenchido", async () => {
    const salvar = abrir(ACERTADO);

    await page.getByRole("button", { name: "acerto" }).click();
    await page.getByRole("button", { name: "desfazer acerto" }).click();
    await page.getByRole("button", { name: "Desfazer acerto", exact: true }).click();

    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    const formData = salvar.mock.calls[0][1];
    expect(formData.get("desfazer")).toBe("sim");
    expect(formData.get("comissaoPercentualRecebido")).toBe("50");
  });

  test("sem acerto lançado, não há o que desfazer", async () => {
    abrir(PEDIDO);

    await page.getByRole("button", { name: "acertar" }).click();
    await expect.element(page.getByRole("button", { name: "desfazer acerto" })).not.toBeInTheDocument();
  });
});

describe("quando a indústria paga o pedido inteiro", () => {
  test("nasce com o fechamento da indústria e diz o mês da comissão", async () => {
    abrir({ ...PEDIDO, fechamento: "30" });

    // Entregue em 15/10 com fechamento 30: a linha avisa e o painel diz novembro.
    await expect.element(page.getByText("paga após faturar")).toBeInTheDocument();
    await page.getByRole("button", { name: "acertar" }).click();
    await expect.element(page.getByText("novembro de 2026")).toBeVisible();

    // A exceção, trocada ali mesmo.
    await page.getByRole("button", { name: "no mês do vencimento" }).click();
    await expect.element(page.getByText("outubro de 2026")).toBeVisible();
  });

  test("manda a escolha junto com o acerto", async () => {
    const salvar = abrir({ ...PEDIDO, fechamento: "30" });

    await page.getByRole("button", { name: "acertar" }).click();
    await page.getByRole("textbox", { name: "Fatura até o dia" }).fill("10");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();

    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
    const formData = salvar.mock.calls[0][1];
    expect(formData.get("pagamento")).toBe("seguinte");
    expect(formData.get("diaFechamentoComissao")).toBe("10");
    expect(formData.get("desfazer")).toBeNull();
  });
});
