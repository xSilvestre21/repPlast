/**
 * Testes de navegador do campo de data: o foco no calendário e a data digitada.
 *
 * O que se protege:
 *
 *   - aberto com o mouse, o foco vai para a caixa de digitar, e não para o dia
 *     (no iPhone o dia vinha aceso com o anel de Tab, como se alguém tivesse
 *     navegado até ele); escolhido o dia, o campo não volta aceso;
 *   - pelo teclado, a seta para baixo desce da caixa para a grade, onde o foco
 *     segue o dia destacado, e o Esc devolve o foco ao campo;
 *   - "15112026" vira "15/11/2026", acende o dia no calendário e só vira valor
 *     no Enter ou no clique fora; Esc desiste; data que não existe é avisada.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CampoData } from "./campo-data";

function Tela() {
  return (
    <>
      {/* Em cima: o calendário abre para baixo, e o cobriria. */}
      <button type="button">Fora</button>
      <CampoData name="entrega" rotulo="Entrega" defaultValue="2026-10-15" />
    </>
  );
}

const campo = () => page.getByRole("button", { name: /^Entrega:/ });
const caixa = () => page.getByRole("textbox", { name: "Entrega: digitar a data" });
/** O dia na grade (o calendário vai por portal para o <body>). */
const dia = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-dia="${iso}"]`);
/** O que vai para a Server Action. */
const enviado = () => document.querySelector<HTMLInputElement>('input[name="entrega"]')!.value;
const fechado = () => vi.waitFor(() => expect(document.querySelector("[data-dia]")).toBeNull());

async function abrirEDigitar(texto: string) {
  await campo().click();
  await expect.element(caixa()).toHaveFocus();
  await userEvent.keyboard(texto);
}

describe("foco no calendário", () => {
  test("aberto com o mouse, o foco vai para a caixa e não para o dia; escolhido, o campo não volta aceso", async () => {
    render(<Tela />);
    await campo().click();

    await expect.element(caixa()).toHaveFocus();
    await expect.element(caixa()).toHaveValue("15/10/2026");
    expect(document.activeElement).not.toBe(dia("2026-10-15"));

    await page.elementLocator(dia("2026-10-20")!).click();
    await fechado();
    expect(enviado()).toBe("2026-10-20");
    expect(document.activeElement).not.toBe(campo().element());
  });

  test("pelo teclado: abre na caixa, a seta para baixo desce para o dia, e o Esc volta ao campo", async () => {
    render(<Tela />);
    await expect.element(campo()).toBeVisible();
    campo().element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(caixa()).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    await vi.waitFor(() => expect(document.activeElement).toBe(dia("2026-10-15")));
    await userEvent.keyboard("{ArrowRight}");
    await vi.waitFor(() => expect(document.activeElement).toBe(dia("2026-10-16")));
    // Trocar de mês leva o foco junto, mesmo com o dia de antes saindo da tela.
    await userEvent.keyboard("{PageDown}");
    await vi.waitFor(() => expect(document.activeElement).toBe(dia("2026-11-16")));

    await userEvent.keyboard("{Escape}");
    await expect.element(campo()).toHaveFocus();
  });
});

describe("data digitada", () => {
  test("as barras entram sozinhas, o dia acende, e o Enter confirma", async () => {
    render(<Tela />);
    await abrirEDigitar("15112026");

    await expect.element(caixa()).toHaveValue("15/11/2026");
    await vi.waitFor(() => expect(dia("2026-11-15")?.getAttribute("aria-selected")).toBe("true"));
    // Ainda é prévia: o valor só muda ao confirmar.
    expect(enviado()).toBe("2026-10-15");

    await userEvent.keyboard("{Enter}");
    await fechado();
    expect(enviado()).toBe("2026-11-15");
  });

  test("Backspace logo depois da barra apaga o dígito junto", async () => {
    render(<Tela />);
    await abrirEDigitar("15");
    await expect.element(caixa()).toHaveValue("15/");

    await userEvent.keyboard("{Backspace}");
    await expect.element(caixa()).toHaveValue("1");
  });

  test("data que não existe: avisa e não muda nada", async () => {
    render(<Tela />);
    await abrirEDigitar("31022026");
    await userEvent.keyboard("{Enter}");

    await expect.element(page.getByText(/Essa data não existe/)).toBeVisible();
    await expect.element(caixa()).toHaveAttribute("aria-invalid", "true");
    expect(dia("2026-10-15")).not.toBeNull();
    expect(enviado()).toBe("2026-10-15");
  });

  test("Esc desiste do que foi digitado", async () => {
    render(<Tela />);
    await abrirEDigitar("01122026");
    await userEvent.keyboard("{Escape}");

    await fechado();
    expect(enviado()).toBe("2026-10-15");
  });

  test("clique fora confirma a data digitada", async () => {
    render(<Tela />);
    await abrirEDigitar("01122026");
    await page.getByRole("button", { name: "Fora" }).click();

    await fechado();
    expect(enviado()).toBe("2026-12-01");
  });
});
