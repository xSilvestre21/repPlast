/**
 * Testes de navegador da gaveta do menu no celular.
 *
 * O que se protege é o movimento da folha do acerto, agora também no menu:
 *   - tocar fora fecha DESLIZANDO — o `<dialog>` só fecha depois que a gaveta
 *     sai, e o conteúdo continua na tela até lá (antes sumia de uma vez);
 *   - arrastar para a esquerda fecha; arrastar pouco devolve a gaveta, sem
 *     deixar `translate` nenhum;
 *   - abre com o foco na caixa, e não no X.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

vi.mock("next/navigation", () => ({ usePathname: () => "/pedidos" }));
// A ação de sair puxa o banco; aqui só a gaveta importa.
vi.mock("@/app/(entrada)/acoes", () => ({ sair: async () => {} }));

import { Navegacao } from "./navegacao";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function abrirGaveta() {
  await render(<Navegacao nomeUsuario="Renata" nomeOrganizacao="Representação Prado" />);
  await page.getByRole("button", { name: "Abrir o menu" }).click();
  const gaveta = document.querySelector<HTMLDialogElement>("dialog")!;
  await vi.waitFor(() => expect(gaveta.open).toBe(true));
  await esperar(600); // a entrada termina
  return gaveta;
}

/** Arrasta o dedo na gaveta `distancia` px na horizontal (negativo: para a esquerda), devagar. */
async function arrastar(gaveta: HTMLDialogElement, distancia: number) {
  const alvo = gaveta.querySelector<HTMLElement>("nav")!;
  const { left, top } = alvo.getBoundingClientRect();
  const toque = (x: number) => new Touch({ identifier: 5, target: alvo, clientX: left + 200 + x, clientY: top + 40 });
  const disparar = (tipo: string, x: number) =>
    alvo.dispatchEvent(
      new TouchEvent(tipo, {
        touches: tipo === "touchend" ? [] : [toque(x)],
        changedTouches: [toque(x)],
        bubbles: true,
        cancelable: true,
      }),
    );
  disparar("touchstart", 0);
  for (let passo = 1; passo <= 10; passo++) {
    disparar("touchmove", (distancia * passo) / 10);
    await esperar(60);
  }
  disparar("touchend", distancia);
}

beforeEach(async () => {
  await page.viewport(390, 844);
});
afterEach(async () => {
  await page.viewport(1280, 720);
});

describe("gaveta do menu", () => {
  test("abre com o foco na caixa, e não no X", async () => {
    const gaveta = await abrirGaveta();
    expect(document.activeElement).toBe(gaveta);
  });

  test("tocar fora fecha deslizando, com o conteúdo na tela até o fim", async () => {
    const gaveta = await abrirGaveta();

    // O toque no fundo escurecido: o alvo é o próprio <dialog>.
    gaveta.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await esperar(50);
    expect(gaveta.open).toBe(true);
    expect(gaveta.querySelector("nav")).not.toBeNull();

    await vi.waitFor(() => expect(gaveta.open).toBe(false), { timeout: 1500 });
  });

  test("arrastar para a esquerda fecha", async () => {
    const gaveta = await abrirGaveta();
    await arrastar(gaveta, -250);
    await vi.waitFor(() => expect(gaveta.open).toBe(false), { timeout: 1500 });
  });

  test("arrastar pouco devolve a gaveta, sem translate", async () => {
    const gaveta = await abrirGaveta();
    await arrastar(gaveta, -30);
    await esperar(700);

    expect(gaveta.open).toBe(true);
    expect(gaveta.style.translate).toBe("");
    expect(getComputedStyle(gaveta).translate).toBe("none");
  });
});
