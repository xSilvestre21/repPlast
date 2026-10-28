/**
 * Testes de navegador do foco ao abrir o `Dialogo`.
 *
 * O que se protege: a janela abre com o foco na caixa, e não no X — no iPhone
 * o X vinha aceso, como se alguém tivesse apertado Tab até ele —, a não ser
 * que o conteúdo marque um campo para receber o foco (`data-autofocus`). Botão
 * marcado (o Cancelar do "tem certeza?") só recebe o foco de quem está no
 * teclado: no iPhone ele também vinha aceso.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { Dialogo } from "./dialogo";

/** O que a pessoa usou por último, como `foco.ts` ouve. */
const tocou = () => window.dispatchEvent(new PointerEvent("pointerdown"));
const teclou = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

function Pergunta() {
  return (
    <Dialogo aberto aoFechar={() => {}} titulo="Desfazer o acerto do pedido #2265?">
      <button type="button" data-autofocus="">
        Cancelar
      </button>
      <button type="button">Desfazer acerto</button>
    </Dialogo>
  );
}

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

  test("com campo marcado, o foco vai para ele — mesmo aberta com o dedo", async () => {
    tocou();
    await render(
      <Dialogo aberto aoFechar={() => {}} titulo="Novo contato">
        <input name="nome" data-autofocus="" />
      </Dialogo>,
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector('input[name="nome"]')));
  });

  test("com botão marcado, aberta com o dedo, o foco fica na caixa", async () => {
    tocou();
    await render(<Pergunta />);
    const caixa = document.querySelector("dialog")!;
    await vi.waitFor(() => expect(caixa.open).toBe(true));

    expect(document.activeElement).toBe(caixa);
  });

  test("com botão marcado, aberta pelo teclado, o foco vai para ele", async () => {
    teclou();
    await render(<Pergunta />);
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe("Cancelar"));
  });
});
