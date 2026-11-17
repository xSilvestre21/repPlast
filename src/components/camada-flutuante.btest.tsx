/**
 * Testes de navegador: o que abre ao clicar aparece INTEIRO na tela.
 *
 * O defeito que deu origem a este arquivo: no acerto das comissões, a data de
 * entrega abria o calendário para baixo, para fora da tela — e a janela do
 * acerto trava a rolagem da página, então não havia como chegar ao resto
 * dele. O calendário só subia se coubesse inteiro em cima; não cabendo em lado
 * nenhum, descia contando com a página rolar, e numa janela ela não rola.
 *
 * Aqui cada campo que abre alguma coisa é posto onde aperta — no pé de uma
 * janela, no fim da página, numa tela baixa — e o que abriu tem de estar à
 * vista, sem precisar de uma rolagem que não existe.
 *
 * Rode com:  npm run test:navegador
 */

import { type ReactNode, useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CampoData } from "./campo-data";
import { CampoHora } from "./campo-hora";
import { CampoMes } from "./campo-mes";
import { Dialogo } from "./dialogo";
import { SelecaoBuscavel, type OpcaoBuscavel } from "./selecao-buscavel";
import { TextoComVariaveis, type VariavelSugerida } from "./texto-com-variaveis";

afterEach(async () => {
  await page.viewport(1280, 720);
});

/** Uma janela como a do acerto: um tanto de conteúdo, e o campo por último. */
function NaJanela({ antes, children }: { antes: number; children: ReactNode }) {
  return (
    <Dialogo aberto aoFechar={() => {}} titulo="Acerto do pedido #1" largo fecharNoFundo={false}>
      <div style={{ height: antes }} />
      {children}
    </Dialogo>
  );
}

/** O campo no fim de uma página que não tem mais nada embaixo. */
function NoFimDaPagina({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 400, padding: 16 }}>
      <div style={{ height: 1200 }} />
      {children}
    </div>
  );
}

/** O cartão aberto (calendário, hora, mês) — vai por portal, para fora da raiz. */
const cartao = () => document.querySelector<HTMLElement>('[role="dialog"][id]:not(dialog)')!;

/** Inteiro dentro da janela do navegador, sem precisar rolar. */
async function inteiroNaTela(elemento: () => HTMLElement) {
  await vi.waitFor(() => {
    const caixa = elemento().getBoundingClientRect();
    expect(caixa.top, "o começo está acima da tela").toBeGreaterThanOrEqual(0);
    expect(caixa.bottom, "o fim está abaixo da tela").toBeLessThanOrEqual(window.innerHeight);
  });
}

describe("numa janela, onde a página não rola", () => {
  test("o calendário que não cabe embaixo nem em cima aparece inteiro na tela", async () => {
    render(
      <NaJanela antes={360}>
        <CampoData name="entregueEm" rotulo="A indústria entregou em" defaultValue="2026-10-15" />
      </NaJanela>,
    );
    await page.getByRole("button", { name: /^A indústria entregou em:/ }).click();
    await inteiroNaTela(cartao);
  });

  test("e continua inteiro quando muda de mês e fica mais alto", async () => {
    render(
      <NaJanela antes={360}>
        <CampoData name="entregueEm" rotulo="A indústria entregou em" defaultValue="2026-12-15" />
      </NaJanela>,
    );
    await page.getByRole("button", { name: /^A indústria entregou em:/ }).click();
    await inteiroNaTela(cartao);
    // Fevereiro de 2027 tem os dois dias de Carnaval listados embaixo da grade.
    await userEvent.keyboard("15022027");
    await inteiroNaTela(cartao);
  });

  test("numa tela baixa, o calendário rola por dentro em vez de sair da tela", async () => {
    await page.viewport(1280, 480);
    render(
      <NaJanela antes={200}>
        <CampoData name="entregueEm" rotulo="A indústria entregou em" defaultValue="2026-10-15" />
      </NaJanela>,
    );
    await page.getByRole("button", { name: /^A indústria entregou em:/ }).click();
    await inteiroNaTela(cartao);
    const calendario = cartao();
    expect(calendario.scrollHeight).toBeGreaterThan(calendario.clientHeight);
    expect(getComputedStyle(calendario).overflowY).toBe("auto");
  });

  test("a hora também", async () => {
    render(
      <NaJanela antes={380}>
        <CampoHora name="hora" rotulo="Hora" defaultValue="14:30" />
      </NaJanela>,
    );
    await page.getByRole("button", { name: /^Hora:/ }).click();
    await inteiroNaTela(cartao);
  });

  test("o mês também", async () => {
    await page.viewport(1280, 480);
    render(
      <NaJanela antes={150}>
        <CampoMes name="competencia" rotulo="Mês do recebimento" defaultValue="2026-11" hoje="2026-11" />
      </NaJanela>,
    );
    await page.getByRole("button", { name: /^Mês do recebimento:/ }).click();
    await inteiroNaTela(cartao);
  });

  test("a lista de busca abre para o lado que cabe DENTRO da janela, e não só na tela", async () => {
    const opcoes: OpcaoBuscavel[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      rotulo: `Indústria ${i + 1}`,
    }));
    render(
      <NaJanela antes={120}>
        <SelecaoBuscavel name="industriaId" rotulo="Indústria" opcoes={opcoes} />
      </NaJanela>,
    );
    await page.getByRole("combobox").click();
    const lista = () => page.getByRole("listbox").element() as HTMLElement;
    await expect.element(page.getByRole("listbox")).toBeVisible();

    const janela = document.querySelector("dialog")!.getBoundingClientRect();
    const caixa = lista().getBoundingClientRect();
    expect(caixa.bottom, "a lista passou do pé da janela").toBeLessThanOrEqual(janela.bottom);
    expect(caixa.top, "a lista passou do alto da janela").toBeGreaterThanOrEqual(janela.top);
  });
});

describe("na página", () => {
  test("no fim da página, o calendário aparece inteiro", async () => {
    await render(
      <NoFimDaPagina>
        <CampoData name="pagoEm" rotulo="Data do pagamento" defaultValue="2026-10-15" />
      </NoFimDaPagina>,
    );
    const campo = page.getByRole("button", { name: /^Data do pagamento:/ });
    campo.element().scrollIntoView({ block: "end" });
    await campo.click();
    await inteiroNaTela(cartao);
  });

  test("o lado é decidido pela altura de verdade: cabendo em cima, sobe, e a página não pula", async () => {
    // 600px de tela: em cima do campo cabe o calendário sem atalhos (~450px),
    // mas não a estimativa de quando ele ainda não existe (560px).
    await page.viewport(1280, 600);
    await render(
      <NoFimDaPagina>
        <CampoData name="pagoEm" rotulo="Data do pagamento" defaultValue="2026-10-15" atalhos={[]} atalhosUteis={[]} />
      </NoFimDaPagina>,
    );
    const campo = page.getByRole("button", { name: /^Data do pagamento:/ });
    campo.element().scrollIntoView({ block: "end" });
    const rolagem = window.scrollY;

    await campo.click();
    await inteiroNaTela(cartao);
    expect(cartao().getBoundingClientRect().bottom).toBeLessThanOrEqual(
      campo.element().getBoundingClientRect().top,
    );
    expect(window.scrollY).toBe(rolagem);
  });

  test("a lista de dados da mensagem, no fim da página, aparece inteira", async () => {
    const variaveis: VariavelSugerida[] = Array.from({ length: 10 }, (_, i) => ({
      nome: `dado${i}`,
      rotulo: `Dado ${i + 1}`,
      detalhe: "exemplo",
      codigo: `{dado${i}}`,
      abre: `{dado${i}}`,
    }));
    function Mensagem() {
      const [valor, setValor] = useState("");
      return (
        <TextoComVariaveis
          name="corpo"
          rotulo="Mensagem"
          variaveis={variaveis}
          valor={valor}
          aoMudar={setValor}
          linhas={3}
        />
      );
    }
    await render(
      <NoFimDaPagina>
        <Mensagem />
      </NoFimDaPagina>,
    );
    const campo = page.getByRole("textbox", { name: "Mensagem" });
    campo.element().scrollIntoView({ block: "end" });
    await campo.click();
    await userEvent.keyboard("{{");
    await inteiroNaTela(() => page.getByRole("listbox").element().parentElement as HTMLElement);
  });
});
