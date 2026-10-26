/**
 * Testes de navegador do foco ao abrir o `Dialogo`.
 *
 * O que se protege: a janela abre com o foco na caixa, e não no X — no iPhone
 * o X vinha aceso, como se alguém tivesse apertado Tab até ele —, a não ser
 * que o conteúdo marque um campo para receber o foco (`data-autofocus`).
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Dialogo } from "./dialogo";

describe("Dialogo", () => {
  test("sem campo marcado, o foco fica na caixa", async () => {
    await render(
      <Dialogo aberto aoFechar={() => {}} titulo="Apagar o pedido 2265?">
        <button type="button">Apagar</button>
      </Dialogo>,
    );
    const caixa = document.querySelector("dialog")!;
    await vi.waitFor(() => expect(caixa.open).toBe(true));

    expect(document.activeElement).toBe(caixa);
    expect(getComputedStyle(document.documentElement).overflow).toBe("hidden");
  });

  test("com campo marcado, o foco vai para ele", async () => {
    await render(
      <Dialogo aberto aoFechar={() => {}} titulo="Novo contato">
        <input name="nome" data-autofocus="" />
      </Dialogo>,
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector('input[name="nome"]')));
  });
});
