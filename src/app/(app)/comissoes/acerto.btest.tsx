/**
 * Testes de navegador da linha da apuração e do painel que ela abre.
 *
 * O que se protege:
 *   - o painel PERGUNTA o que aconteceu com o pagamento, com as três respostas
 *     à vista — "recebi", "ainda não foi pago", "recebo em parcelas" —, em vez
 *     de um formulário só com os outros caminhos escondidos no rodapé;
 *   - a data de entrega tem o botão dela e salva sem valor recebido, dizendo
 *     que é da entrega da indústria, e não do pagamento;
 *   - "ainda não foi pago" envia a escolha (sem previsão, ou o mês) e diz antes
 *     o que ela faz com a linha;
 *   - a linha mostra o selo do atraso, e o que conta em outro mês fica fora da
 *     soma deste;
 *   - o acerto lançado errado tem volta: "Desfazer acerto" pergunta antes e
 *     envia `desfazer=sim`, mesmo com o % ainda preenchido no campo;
 *   - o pedido sem parcelas diz em que mês a comissão dele conta, e muda na
 *     hora quando se troca a exceção do fechamento.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { type AcoesDaLinha, type LinhaPedido, LinhaComissao } from "./acerto";

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
  atraso: { naoPaga: false, para: null },
  mesNatural: "2026-10",
  mesDaTela: "2026-10",
  hoje: "2026-12",
  lugar: "no-mes",
  industria: null,
};

const ACERTADO: LinhaPedido = {
  ...PEDIDO,
  valorRecebido: "1.000,00",
  percentualRecebido: "50",
  recebido: 500,
  podeParcelar: false,
  parcelarExigeDesfazerAcerto: true,
};

type Espia = ReturnType<typeof vi.fn<(estado: object, formData: FormData) => Promise<object>>>;

function abrir(pedido: LinhaPedido) {
  const espia = (): Espia => vi.fn(async (_estado: object, _formData: FormData) => ({}));
  const acoes = {
    acerto: espia(),
    entrega: espia(),
    naoPago: espia(),
    desmarcarNaoPago: espia(),
    parcelas: espia(),
    desfazerParcelas: espia(),
  };
  render(
    <table>
      <tbody>
        <LinhaComissao
          pedido={pedido}
          comPercentual
          acoes={acoes as unknown as AcoesDaLinha}
          enderecoDoMes="/comissoes?mes=__MES__"
        />
      </tbody>
    </table>,
  );
  return acoes;
}

/** O `FormData` da única chamada de uma ação. */
async function enviado(acao: Espia): Promise<FormData> {
  await vi.waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
  return acao.mock.calls[0][1];
}

const escolha = (nome: string | RegExp) => page.getByRole("radio", { name: nome });

describe("o que aconteceu com o pagamento", () => {
  test("a linha tem um botão de verdade, e o painel abre com as três respostas", async () => {
    abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();

    await expect.element(escolha(/^Recebi/)).toHaveAttribute("aria-checked", "true");
    await expect.element(escolha(/^Ainda não foi pago/)).toHaveAttribute("aria-checked", "false");
    await expect.element(escolha(/^Recebo em parcelas/)).toBeVisible();
    // Cada resposta diz o que é — inclusive que parcela pode ser por dias ou por data.
    await expect.element(page.getByText(/em dias \(28\/35\/42\) ou nas datas que você escolher/)).toBeVisible();
  });

  test("“recebo em parcelas” abre o editor, perguntando como montar", async () => {
    abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Recebo em parcelas/).click();

    await expect.element(page.getByRole("heading", { name: "Como quer montar as parcelas?" })).toBeVisible();
    await expect.element(escolha(/^Por dias depois da entrega/)).toBeVisible();
    await expect.element(escolha(/^Escolhendo as datas/)).toBeVisible();
  });

  test("com acerto no pedido inteiro, parcelar diz o que fazer antes", async () => {
    abrir(ACERTADO);

    await page.getByRole("button", { name: "Ver acerto" }).click();
    await escolha(/^Recebo em parcelas/).click();

    await expect.element(page.getByText(/use antes o\s+botão “Desfazer acerto”/)).toBeVisible();
  });

  test("“pagou o valor todo” preenche a venda e mostra a comissão", async () => {
    const acoes = abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await page.getByRole("button", { name: /^Pagou o valor todo/ }).click();

    await expect.element(page.getByText(/igual ao previsto/)).toBeVisible();
    await page.getByRole("button", { name: "Salvar acerto" }).click();

    const formData = await enviado(acoes.acerto);
    expect(formData.get("valorRecebido")).toBe("1.000,00");
    expect(formData.get("comissaoPercentualRecebido")).toBe("5");
    // A entrega não viaja com o acerto: tem o formulário dela.
    expect(formData.get("entregueEm")).toBeNull();
    // Nem o mês do pagamento, que só aparece em quem atrasou.
    expect(formData.get("contaEm")).toBeNull();
  });
});

describe("a data de entrega", () => {
  test("tem o botão dela, e diz que não é a data do pagamento", async () => {
    const acoes = abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();

    await expect.element(page.getByText("A indústria entregou em")).toBeVisible();
    await expect.element(page.getByText(/Não é a\s+data do pagamento/)).toBeVisible();

    // Salva sem nenhum valor recebido digitado.
    await page.getByRole("button", { name: "Salvar data da entrega" }).click();
    await enviado(acoes.entrega);
    expect(acoes.acerto).not.toHaveBeenCalled();
    await expect.element(page.getByRole("button", { name: "Data salva" })).toBeVisible();
  });
});

describe("ainda não foi pago", () => {
  test("sem previsão: diz que o pedido fica no mês dele e aparece como pendente", async () => {
    const acoes = abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Ainda não foi pago/).click();

    await expect.element(escolha(/^Ainda não sei quando/)).toHaveAttribute("aria-checked", "true");
    await expect.element(page.getByText(/Pendentes de meses anteriores/)).toBeVisible();

    await page.getByRole("button", { name: "Marcar como não pago" }).click();
    const formData = await enviado(acoes.naoPago);
    expect(formData.get("quando")).toBe("sem-previsao");
  });

  test("com o mês: abre no mês de hoje e diz para onde a comissão vai", async () => {
    const acoes = abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Ainda não foi pago/).click();
    await escolha(/^Já sei o mês/).click();

    const mes = page.getByRole("combobox", { name: "A indústria vai pagar em" });
    await expect.element(mes).toHaveValue("2026-12");
    await expect.element(page.getByText(/passa a contar\s+em/)).toBeVisible();
    await expect.element(page.getByText(/“Recebe em dezembro”/)).toBeVisible();

    await mes.selectOptions("2027-01");
    await expect.element(page.getByText(/“Recebe em janeiro de 2027”/)).toBeVisible();

    await page.getByRole("button", { name: "Marcar como não pago" }).click();
    const formData = await enviado(acoes.naoPago);
    expect(formData.get("quando")).toBe("mes");
    expect(formData.get("mes")).toBe("2027-01");
  });

  test("já marcado, o painel abre nele e oferece tirar a marca", async () => {
    const acoes = abrir({ ...PEDIDO, atraso: { naoPaga: true, para: null } });

    await expect.element(page.getByText("Não pago", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Lançar acerto" }).click();

    await expect.element(escolha(/^Ainda não foi pago/)).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Tirar o “não pago”" }).click();
    await enviado(acoes.desmarcarNaoPago);
    expect(acoes.naoPago).not.toHaveBeenCalled();
  });

  test("quem estava atrasado diz, no acerto, em que mês a indústria pagou", async () => {
    const acoes = abrir({ ...PEDIDO, atraso: { naoPaga: true, para: null }, mesDaTela: "2026-11", lugar: "pendente" });

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Recebi/).click();

    // Abre no mês da tela em que se está lançando.
    const mes = page.getByRole("combobox", { name: /^Em que mês a indústria pagou?/ });
    await expect.element(mes).toHaveValue("2026-11");

    await page.getByRole("button", { name: /^Pagou o valor todo/ }).click();
    await page.getByRole("button", { name: "Salvar acerto" }).click();
    expect((await enviado(acoes.acerto)).get("contaEm")).toBe("2026-11");
  });
});

describe("os selos do pagamento que atrasou", () => {
  test("no mês dele, adiado: o selo diz quando recebe, e o valor fica fora da soma", async () => {
    abrir({ ...PEDIDO, atraso: { naoPaga: false, para: "2026-12" }, lugar: "adiada-daqui" });

    await expect.element(page.getByText("Recebe em dezembro")).toBeVisible();
    await expect.element(page.getByText("conta em dezembro")).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "ver em dezembro" }))
      .toHaveAttribute("href", "/comissoes?mes=2026-12");
  });

  test("no mês em que recebe: o selo diz de que mês o pedido é", async () => {
    abrir({ ...PEDIDO, atraso: { naoPaga: false, para: "2026-12" }, mesDaTela: "2026-12" });

    await expect.element(page.getByText("De outubro · pagamento adiado")).toBeVisible();
    await expect.element(page.getByText(/^conta em/)).not.toBeInTheDocument();
  });

  test("na lista de pendentes: diz de que mês é, e leva até ele", async () => {
    abrir({
      ...PEDIDO,
      atraso: { naoPaga: true, para: null },
      mesDaTela: "2026-12",
      lugar: "pendente",
      industria: "ALFAPLAST",
    });

    await expect.element(page.getByText("Não pago · de outubro")).toBeVisible();
    await expect.element(page.getByText("ALFAPLAST")).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "ver em outubro" }))
      .toHaveAttribute("href", "/comissoes?mes=2026-10");
  });
});

describe("desfazer acerto", () => {
  test("pergunta antes, e o Cancelar não desfaz", async () => {
    const acoes = abrir(ACERTADO);

    await page.getByRole("button", { name: "Ver acerto" }).click();
    await page.getByRole("button", { name: "Desfazer acerto" }).click();

    await expect.element(page.getByText("Desfazer o acerto do pedido #142?")).toBeVisible();
    await expect.element(page.getByText(/volta a contar só como previsto/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();
    expect(acoes.acerto).not.toHaveBeenCalled();
  });

  test("confirmado, envia o desfazer mesmo com o % preenchido", async () => {
    const acoes = abrir(ACERTADO);

    await page.getByRole("button", { name: "Ver acerto" }).click();
    await page.getByRole("button", { name: "Desfazer acerto" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Desfazer acerto" }).click();

    const formData = await enviado(acoes.acerto);
    expect(formData.get("desfazer")).toBe("sim");
    expect(formData.get("comissaoPercentualRecebido")).toBe("50");
  });

  test("sem acerto lançado, não há o que desfazer", async () => {
    abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await expect.element(page.getByRole("button", { name: "Desfazer acerto" })).not.toBeInTheDocument();
  });
});

describe("quando a indústria paga o pedido inteiro", () => {
  test("nasce com o fechamento da indústria e diz o mês da comissão", async () => {
    abrir({ ...PEDIDO, fechamento: "30", mesNatural: "2026-11" });

    // Entregue em 15/10 com fechamento 30: a linha avisa e o painel diz novembro.
    await expect.element(page.getByText("paga após faturar")).toBeInTheDocument();
    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await expect.element(page.getByText("novembro de 2026")).toBeVisible();

    // A exceção, trocada ali mesmo.
    await page.getByRole("button", { name: "no mês do vencimento" }).click();
    await expect.element(page.getByText("outubro de 2026")).toBeVisible();
  });

  test("manda a escolha junto com o acerto", async () => {
    const acoes = abrir({ ...PEDIDO, fechamento: "30", mesNatural: "2026-11" });

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await page.getByRole("textbox", { name: "Fatura até o dia" }).fill("10");
    await page.getByRole("button", { name: "Salvar acerto" }).click();

    const formData = await enviado(acoes.acerto);
    expect(formData.get("pagamento")).toBe("seguinte");
    expect(formData.get("diaFechamentoComissao")).toBe("10");
    expect(formData.get("desfazer")).toBeNull();
  });
});
