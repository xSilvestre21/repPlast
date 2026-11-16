/**
 * Testes de navegador do pagamento ao preposto.
 *
 * O que se protege:
 *   - a linha abre o pagamento por um botão que diz "Pagar" — era uma setinha
 *     sem texto, e quem não sabia que dava para clicar não achava onde pagar;
 *   - o pagamento abre numa JANELA por cima, com o resumo do mês, o formulário
 *     e "Ao registrar, fica assim:" dizendo o saldo antes do clique. O painel
 *     que abria embaixo da linha ficava aberto depois do serviço feito;
 *   - "Fechar" sai; um clique fora da caixa não fecha (jogaria fora o digitado);
 *   - registrado, a janela fecha sozinha e a linha diz "Pagamento registrado".
 *     Recusado, fica aberta com a frase embaixo do campo, para corrigir.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { EstadoFormulario } from "./acoes";
import { type DadosRepasse, LinhaRepasse } from "./repasse";

const DADOS: DadosRepasse = {
  nome: "Iara Celina",
  cor: null,
  pedidos: 3,
  previsto: 1000,
  devido: 1000,
  pago: 0,
  anterior: 0,
  aRepassar: 1000,
  extrato: [],
  pagamentos: [],
  anteriores: [],
};

/** Um pedido do extrato, com a fatia do preposto no previsto e no liberado. */
const item = (numero: number, previsto: number, recebido: number | null) => ({
  chave: `p${numero}:`,
  pedidoId: `p${numero}`,
  numero,
  parcela: null,
  cliente: `CLIENTE ${numero}`,
  industria: "QUALYPLAST",
  previsto,
  recebido,
});

function abrir(registrar: () => Promise<EstadoFormulario>, dados: DadosRepasse = DADOS) {
  render(
    <LinhaRepasse
      dados={dados}
      registrar={registrar}
      sugestao={dados.aRepassar > 0 ? "1.000,00" : ""}
      hoje="2026-10-19"
      nomeDoMes="Outubro de 2026"
    />,
  );
}

const pagar = () => page.getByRole("button", { name: "Pagar — Iara Celina" });
const janela = () => page.getByRole("dialog", { name: /^Pagamento a Iara/ });
const realizado = () => page.getByRole("dialog", { name: "Pagamento realizado com sucesso!" });
const texto = (el: Element) => el.textContent!.replace(/\u00a0/g, " ");

describe("pagar o preposto", () => {
  test("o botão diz Pagar e abre a janela, com o resumo e o formulário antes do extrato", async () => {
    abrir(async () => ({}));

    await pagar().click();
    await expect.element(janela()).toBeVisible();
    await expect.element(janela().getByRole("heading", { name: "Pagamento a Iara Celina" })).toBeVisible();
    await expect.element(janela().getByText(/Falta pagar a Iara:/)).toBeVisible();

    const registrar = janela().getByRole("button", { name: "Registrar pagamento" }).element();
    const extrato = janela().getByRole("heading", { name: /^Extrato do mês/ }).element();
    expect(registrar.getBoundingClientRect().bottom).toBeLessThan(extrato.getBoundingClientRect().top);
  });

  test("“Ao registrar, fica assim” acompanha o valor digitado", async () => {
    abrir(async () => ({}));
    await pagar().click();

    // Já vem com o que falta: registrar deixa tudo pago.
    await expect.element(janela().getByText("Fica tudo pago neste mês.")).toBeVisible();
    expect(texto(janela().getByText(/^Iara recebe/).element())).toContain("R$ 1.000,00 em 19/10/2026");

    await userEvent.fill(janela().getByLabelText(/^Valor que você pagou/), "400,00");
    expect(texto(janela().getByText(/^Falta pagar passa a/).element())).toContain("R$ 600,00");
  });

  test("sem saldo, o botão é Ver extrato e o saldo diz tudo pago", async () => {
    abrir(async () => ({}), { ...DADOS, pago: 1000, aRepassar: 0 });

    await expect.element(page.getByRole("button", { name: "Ver extrato — Iara Celina" })).toBeVisible();
    await expect.element(page.getByText("tudo pago")).toBeVisible();
  });

  test("“Fechar” sai; um clique fora da caixa não fecha", async () => {
    abrir(async () => ({}));
    await pagar().click();

    // O canto da tela, fora da caixa: o próprio <dialog>, no fundo escurecido.
    await userEvent.click(janela(), { position: { x: 4, y: 4 } });
    await expect.element(janela()).toBeVisible();

    // O de baixo — o X do canto tem o mesmo nome e faz o mesmo.
    await janela().getByRole("button", { name: "Fechar", exact: true }).last().click();
    await expect.element(janela()).not.toBeInTheDocument();
  });

  test("registrado: a janela fecha e o caminhão leva o pagamento — tudo quitado", async () => {
    abrir(async () => ({}));

    await pagar().click();
    await janela().getByLabelText(/^Observação/).fill("PIX Itaú");
    await janela().getByRole("button", { name: "Registrar pagamento" }).click();

    await expect.element(janela()).not.toBeInTheDocument();
    await expect.element(realizado()).toBeVisible();
    const cartao = texto(realizado().element());
    expect(cartao).toContain("R$ 1.000,00 pagos a Iara em 19/10/2026");
    expect(cartao).toContain("“PIX Itaú”");
    expect(cartao).toContain("Tudo quitado — Iara não tem mais nada a receber em outubro de 2026.");
    // O caminhão leva o pagamento até a casa de quem recebe: o nome está na placa.
    expect(realizado().element().querySelector("[data-nome]")!.textContent).toBe("Iara");

    // Não some sozinho: espera o "Ok".
    await realizado().getByRole("button", { name: "Ok" }).click();
    await expect.element(realizado()).not.toBeInTheDocument();
  });

  test("pago em parte: o cartão diz quanto ainda falta, com o saldo de ANTES do pagamento", async () => {
    abrir(async () => ({}));

    await pagar().click();
    await userEvent.fill(janela().getByLabelText(/^Valor que você pagou/), "400,00");
    await janela().getByRole("button", { name: "Registrar pagamento" }).click();

    await expect.element(realizado()).toBeVisible();
    expect(texto(realizado().element())).toContain("Ainda faltam R$ 600,00 para quitar outubro de 2026.");
  });

  test("os pagamentos lançados aparecem em destaque: valor, data e a observação inteira", async () => {
    abrir(async () => ({}), {
      ...DADOS,
      pago: 1000,
      aRepassar: 0,
      pagamentos: [
        { id: "r1", pagoEm: "2026-10-10", valor: 600, observacao: "PIX Itaú — adiantamento combinado com a Iara no dia 8", excluir: null },
        { id: "r2", pagoEm: "2026-10-30", valor: 400, observacao: null, excluir: null },
      ],
    });
    await page.getByRole("button", { name: /^Ver extrato/ }).click();

    await expect.element(janela().getByText("Pago em 10/10/2026")).toBeVisible();
    await expect.element(janela().getByText("“PIX Itaú — adiantamento combinado com a Iara no dia 8”")).toBeVisible();
    expect(texto(janela().getByText(/pagamentos ·/).element())).toBe("2 pagamentos · R$ 1.000,00 no total");
  });

  test("recusado: continua aberta, com o motivo", async () => {
    abrir(async () => ({ erro: "Digite o valor pago, como 1.250,00." }));

    await pagar().click();
    await janela().getByRole("button", { name: "Registrar pagamento" }).click();

    await expect.element(janela().getByText("Digite o valor pago, como 1.250,00.")).toBeVisible();
    await expect.element(janela()).toBeVisible();
  });

  test("liberado acima do previsto: diz quais pedidos vieram a mais, e o extrato mostra a diferença", async () => {
    abrir(async () => ({}), {
      ...DADOS,
      previsto: 1100,
      devido: 1150,
      aRepassar: 1150,
      extrato: [item(2224, 500, 540), item(2230, 500, 510), item(2241, 100, null)],
    });
    await pagar().click();

    const nota = janela().getByRole("note");
    await expect.element(nota.getByText(/O liberado passou do previsto/)).toBeVisible();
    expect(texto(nota.element())).toContain("em 2 pedidos");
    expect(texto(nota.element())).toContain("R$ 50,00");
    // O que mais veio a mais primeiro.
    expect(texto(nota.element())).toMatch(/#2224.*\+R\$ 40,00[\s\S]*#2230.*\+R\$ 10,00/);

    // No extrato, a diferença de cada pedido; o não pago fica sem.
    await expect.element(janela().getByText("pago a mais").first()).toBeVisible();
    expect(janela().getByText("pago a mais").elements()).toHaveLength(2);
  });

  test("devendo de outro mês: diz que mês, os pedidos e os pagamentos dele", async () => {
    abrir(async () => ({}), {
      ...DADOS,
      anterior: 200,
      aRepassar: 1200,
      anteriores: [
        {
          mes: "2026-09",
          nome: "setembro de 2026",
          liberado: 1000,
          pago: 800,
          ficou: 200,
          pedidos: [item(2100, 950, 1000)],
          pagamentos: [{ id: "r1", pagoEm: "2026-09-30", valor: 800, observacao: "PIX", excluir: null }],
        },
      ],
    });
    await pagar().click();

    await expect
      .element(janela().getByRole("heading", { name: "De onde vêm os R$ 200,00 de meses anteriores" }))
      .toBeVisible();
    await expect.element(janela().getByText("ficou faltando")).toBeVisible();
    expect(texto(janela().getByText(/^liberados/).element())).toBe("liberados R$ 1.000,00 · pagos R$ 800,00");

    await janela().getByText("Ver os pedidos e os pagamentos de setembro de 2026").click();
    await expect.element(janela().getByRole("link", { name: "#2100" })).toBeVisible();
    await expect.element(janela().getByText("Pago em 30/09/2026")).toBeVisible();
  });

  test("excluir um pagamento é um botão de verdade, e pergunta antes", async () => {
    const excluir = async () => ({});
    abrir(async () => ({}), {
      ...DADOS,
      pago: 600,
      aRepassar: 400,
      pagamentos: [{ id: "r1", pagoEm: "2026-10-10", valor: 600, observacao: null, excluir }],
    });
    await pagar().click();

    const botao = janela().getByRole("button", { name: "Excluir o pagamento de R$ 600,00" });
    await expect.element(botao).toBeVisible();
    // Contorno vermelho, como todo botão que apaga — e não um link sublinhado.
    expect(botao.element().className).toContain("text-perigo");
    expect(botao.element().className).not.toContain("underline");

    await botao.click();
    await expect
      .element(page.getByRole("dialog", { name: "Excluir o pagamento de R$ 600,00?" }))
      .toBeVisible();
  });
});
