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
  parcelasAcertadas: [],
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

/*
 * Salvar fecha o painel — e fechava DURANTE a renderização do formulário, o que
 * o React acusa ("Cannot update a component while rendering a different
 * component"; eram os dois avisos do Next). Ver `components/ao-salvar.ts`.
 */
describe("salvar fecha o painel sem o aviso do React", () => {
  const AVISO = /while rendering a different component/;

  for (const [caso, pedido, salvar, acao] of [
    ["o acerto", PEDIDO, "Salvar acerto", "acerto"],
    ["o “não pago”", PEDIDO, "Marcar como não pago", "naoPago"],
    ["o desmarcar", { ...PEDIDO, atraso: { naoPaga: true, para: null } }, "Tirar o “não pago”", "desmarcarNaoPago"],
  ] as const) {
    test(caso, async () => {
      const erros = vi.spyOn(console, "error");
      const acoes = abrir(pedido);

      await page.getByRole("button", { name: "Lançar acerto" }).click();
      if (acao === "acerto") await page.getByRole("button", { name: /^Pagou o valor todo/ }).click();
      else await escolha(/^Ainda não foi pago/).click();
      await page.getByRole("button", { name: salvar }).click();

      await enviado(acoes[acao]);
      // O painel fechou: o botão da linha diz que está fechado.
      await expect
        .element(page.getByRole("button", { name: "Lançar acerto" }))
        .toHaveAttribute("aria-expanded", "false");
      expect(erros.mock.calls.map((c) => String(c[0])).filter((m) => AVISO.test(m))).toEqual([]);
      erros.mockRestore();
    });
  }
});

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

    await expect
      .element(page.getByText(/apague\s+antes esse acerto: toque em “Recebi”, aqui em cima/))
      .toBeVisible();
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
  test("abre uma tela só com as duas respostas, e “Voltar” traz o painel de volta", async () => {
    abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Ainda não foi pago/).click();

    // As três respostas de cima e a entrega saem; ficam só as duas deste passo.
    await expect.element(page.getByRole("heading", { name: "Ainda não foi pago" })).toBeVisible();
    await expect.element(escolha(/^Ainda não sei quando/)).toBeVisible();
    await expect.element(escolha(/^Já sei o mês/)).toBeVisible();
    await expect.element(escolha(/^Recebi/)).not.toBeInTheDocument();
    await expect.element(page.getByText("A indústria entregou em")).not.toBeVisible();

    // O que já tinha sido digitado no "Recebi" continua lá na volta.
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect.element(escolha(/^Recebi/)).toHaveAttribute("aria-checked", "true");
    await expect.element(escolha(/^Ainda não sei quando/)).not.toBeInTheDocument();
  });

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

  test("com o mês: a grade do ano, aberta no mês de hoje, e o do pedido apagado", async () => {
    const acoes = abrir(PEDIDO);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Ainda não foi pago/).click();
    await escolha(/^Já sei o mês/).click();

    // O campo, como o de data: o mês por extenso e quanto falta.
    const campo = page.getByRole("button", { name: "A indústria vai pagar em: dezembro de 2026" });
    await expect.element(campo).toHaveTextContent("dezembro de 2026 · este mês");
    await expect.element(page.getByText(/selo\s+“Pagamento adiado”/)).toBeVisible();
    await expect.element(page.getByText(/passa a contar\s+em\s+dezembro de 2026/)).toBeVisible();

    // A grade, como a do topo da tela: o escolhido marcado, e o mês do pedido
    // à vista, mas sem clique — adiar é para depois dele.
    await campo.click();
    const grade = page.getByRole("dialog", { name: /Escolher/ });
    await expect.element(grade.getByRole("button", { name: "dezembro de 2026" })).toHaveAttribute("aria-pressed", "true");
    await expect.element(grade.getByRole("button", { name: "outubro de 2026, mês do pedido" })).toBeDisabled();
    await expect.element(grade.getByText("out: mês do pedido")).toBeVisible();

    await grade.getByRole("button", { name: "Próximo ano" }).click();
    await grade.getByRole("button", { name: "janeiro de 2027" }).click();
    await expect.element(page.getByText(/passa a contar\s+em\s+janeiro de 2027/)).toBeVisible();

    await page.getByRole("button", { name: "Marcar como não pago" }).click();
    const formData = await enviado(acoes.naoPago);
    expect(formData.get("quando")).toBe("mes");
    expect(formData.get("mes")).toBe("2027-01");
  });

  test("já marcado, o cartão diz, e leva até onde se tira a marca", async () => {
    const acoes = abrir({ ...PEDIDO, atraso: { naoPaga: true, para: null } });

    await expect.element(page.getByText("Não pago", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Lançar acerto" }).click();

    // Abre no "Recebi" — quem abre a linha marcada quase sempre vem lançar o
    // pagamento —, e o cartão do "não pago" conta que ela está marcada.
    await expect.element(escolha(/^Recebi/)).toHaveAttribute("aria-checked", "true");
    await expect.element(escolha(/^Ainda não foi pago.*Marcado, sem previsão/)).toBeVisible();

    await escolha(/^Ainda não foi pago/).click();
    await page.getByRole("button", { name: "Tirar o “não pago”" }).click();
    await enviado(acoes.desmarcarNaoPago);
    expect(acoes.naoPago).not.toHaveBeenCalled();
  });

  test("quem estava atrasado diz, no acerto, em que mês a indústria pagou", async () => {
    const acoes = abrir({ ...PEDIDO, atraso: { naoPaga: true, para: null }, mesDaTela: "2026-11", lugar: "pendente" });

    await page.getByRole("button", { name: "Lançar acerto" }).click();

    // Abre no mês da tela em que se está lançando.
    await expect
      .element(page.getByRole("button", { name: "Em que mês a indústria pagou?: novembro de 2026" }))
      .toBeVisible();

    await page.getByRole("button", { name: /^Pagou o valor todo/ }).click();
    await page.getByRole("button", { name: "Salvar acerto" }).click();
    expect((await enviado(acoes.acerto)).get("contaEm")).toBe("2026-11");
  });
});

describe("os selos do pagamento que atrasou", () => {
  test("no mês dele, adiado: o selo diz quando recebe, e o valor fica fora da soma", async () => {
    abrir({ ...PEDIDO, atraso: { naoPaga: false, para: "2026-12" }, lugar: "adiada-daqui" });

    // A mesma pílula do mês em que recebe; o mês vai no link.
    await expect.element(page.getByText("Pagamento adiado")).toBeVisible();
    await expect.element(page.getByText("conta em dezembro")).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "recebe em dezembro" }))
      .toHaveAttribute("href", "/comissoes?mes=2026-12");
  });

  test("no mês dele, depois do acerto lançado no outro: “pago com atraso”", async () => {
    abrir({
      ...PEDIDO,
      atraso: { naoPaga: false, para: "2026-12" },
      lugar: "adiada-daqui",
      recebido: 50,
      valorRecebido: "1.000,00",
      percentualRecebido: "5",
    });

    await expect.element(page.getByText("Pago com atraso")).toBeVisible();
    await expect.element(page.getByRole("link", { name: "recebido em dezembro" })).toBeVisible();
  });

  test("no mês em que recebe: lilás, e o link volta ao mês do pedido", async () => {
    abrir({ ...PEDIDO, atraso: { naoPaga: false, para: "2026-12" }, mesDaTela: "2026-12" });

    const selo = page.getByText("Pagamento adiado");
    await expect.element(selo).toBeVisible();
    // Lilás, e não o azul da marca da parcela, com que se confundia.
    expect(selo.element().closest(".carimbo")!.classList).toContain("carimbo-lilas");
    await expect
      .element(page.getByRole("link", { name: "pedido de outubro" }))
      .toHaveAttribute("href", "/comissoes?mes=2026-10");
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

    await expect.element(page.getByText("Não pago", { exact: true })).toBeVisible();
    await expect.element(page.getByText("ALFAPLAST")).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "pedido de outubro" }))
      .toHaveAttribute("href", "/comissoes?mes=2026-10");
  });
});

describe("desfazer o parcelamento com parcela já acertada", () => {
  const PARCELA: LinhaPedido = {
    ...PEDIDO,
    parcela: { numero: 2, total: 3, vencimento: "2026-11-12", recebimento: "2026-11" },
    base: "300",
    previsto: 15,
    podeParcelar: false,
    parcelasAtuais: [
      { vencimento: "2026-10-12", valor: "300,00" },
      { vencimento: "2026-11-12", valor: "300,00" },
      { vencimento: "2026-12-12", valor: "400,00" },
    ],
    parcelasAcertadas: [{ numero: 1, mes: "2026-10" }],
    mesNatural: "2026-11",
    mesDaTela: "2026-11",
  };

  test("a janela diz qual parcela, em que lista, e que o caminho passa por “Recebi”", async () => {
    const acoes = abrir(PARCELA);

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Editar as 3 parcelas/).click();
    await page.getByRole("button", { name: "Desfazer parcelamento" }).click();

    const janela = page.getByRole("dialog", { name: "Não é possível desfazer o parcelamento" });
    await expect.element(janela).toBeVisible();
    await expect.element(janela.getByText(/A parcela 1 já tem acerto lançado/)).toBeVisible();
    await expect
      .element(janela.getByText(/na lista de outubro de 2026\) pelo botão “Ver acerto” e toque em “Recebi esta parcela”/))
      .toBeVisible();
    // Não oferece o botão que apagaria: só “Entendi”.
    await expect.element(janela.getByRole("button", { name: "Desfazer parcelamento" })).not.toBeInTheDocument();
    await janela.getByRole("button", { name: "Entendi" }).click();
    expect(acoes.desfazerParcelas).not.toHaveBeenCalled();
  });

  test("quando a acertada é a própria parcela aberta, manda tocar em “Recebi esta parcela” ali", async () => {
    abrir({ ...PARCELA, recebido: 15, valorRecebido: "300,00", parcelasAcertadas: [{ numero: 2, mes: "2026-11" }] });

    await page.getByRole("button", { name: "Ver acerto" }).click();
    await escolha(/^Editar as 3 parcelas/).click();
    await page.getByRole("button", { name: "Desfazer parcelamento" }).click();

    await expect
      .element(page.getByText(/no painel desta parcela, toque em “Recebi esta parcela”/))
      .toBeVisible();
  });

  test("sem parcela acertada, pergunta antes e desfaz", async () => {
    const acoes = abrir({ ...PARCELA, parcelasAcertadas: [] });

    await page.getByRole("button", { name: "Lançar acerto" }).click();
    await escolha(/^Editar as 3 parcelas/).click();
    await page.getByRole("button", { name: "Desfazer parcelamento" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Desfazer parcelamento" }).click();

    await enviado(acoes.desfazerParcelas);
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
