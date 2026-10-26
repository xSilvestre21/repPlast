/**
 * Testes de navegador da folha que sobe de baixo.
 *
 * O que se protege é o comportamento da folha do iOS:
 *   - abre com o foco na caixa, e não no X (que no iPhone vinha aceso), e com
 *     a página por trás travada;
 *   - segurar a alça e arrastar para baixo fecha; arrastar pouco devolve a
 *     folha ao lugar, sem deixar `translate` nenhum (com ele, o iOS desenhava o
 *     cursor fora do campo);
 *   - com o conteúdo no topo, arrastar por ele também fecha;
 *   - o X fecha deslizando, e só depois o `<dialog>` fecha de verdade.
 *
 * Rode com:  npm run test:navegador
 */

import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { FolhaDeBaixo } from "./folha-de-baixo";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Folha({ aoFechar }: { aoFechar: () => void }) {
  const [aberto, setAberto] = useState(true);
  return (
    <FolhaDeBaixo
      aberto={aberto}
      aoFechar={() => {
        aoFechar();
        setAberto(false);
      }}
      titulo="Acerto do pedido #2300"
    >
      <p data-conteudo="">Conteúdo da folha</p>
      <label>
        Valor
        <input name="valor" />
      </label>
    </FolhaDeBaixo>
  );
}

/** Arrasta a zona da alça `distancia` px para baixo, devagar (sem peteleco). */
async function arrastarAlca(distancia: number) {
  const zona = document.querySelector<HTMLElement>("[data-arraste]")!;
  const { left, top } = zona.getBoundingClientRect();
  const ponto = (y: number) => ({ clientX: left + 20, clientY: top + 10 + y, pointerId: 7, button: 0, bubbles: true });
  zona.dispatchEvent(new PointerEvent("pointerdown", ponto(0)));
  for (let passo = 1; passo <= 10; passo++) {
    zona.dispatchEvent(new PointerEvent("pointermove", ponto((distancia * passo) / 10)));
    await esperar(60);
  }
  zona.dispatchEvent(new PointerEvent("pointerup", ponto(distancia)));
}

/** O mesmo, com o dedo no conteúdo (eventos de toque). */
async function arrastarConteudo(distancia: number) {
  const alvo = document.querySelector<HTMLElement>("[data-conteudo]")!;
  const { left, top } = alvo.getBoundingClientRect();
  const toque = (y: number) =>
    new Touch({ identifier: 3, target: alvo, clientX: left + 10, clientY: top + 5 + y });
  const disparar = (tipo: string, y: number) =>
    alvo.dispatchEvent(
      new TouchEvent(tipo, {
        touches: tipo === "touchend" ? [] : [toque(y)],
        changedTouches: [toque(y)],
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

afterEach(async () => {
  await page.viewport(1280, 720);
});

describe("FolhaDeBaixo", () => {
  test("abre com o foco na caixa, e não no X, e com a página por trás travada", async () => {
    await render(<Folha aoFechar={() => {}} />);
    const folha = document.querySelector("dialog")!;
    await vi.waitFor(() => expect(folha.open).toBe(true));

    expect(document.activeElement).toBe(folha);
    expect(getComputedStyle(document.documentElement).overflow).toBe("hidden");
  });

  test("arrastar a alça para baixo fecha a folha", async () => {
    await page.viewport(390, 844);
    const aoFechar = vi.fn();
    await render(<Folha aoFechar={aoFechar} />);
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await arrastarAlca(400);

    await vi.waitFor(() => expect(aoFechar).toHaveBeenCalled());
    await vi.waitFor(() => expect(document.querySelector("dialog")!.open).toBe(false));
    // Fechada, a página volta a rolar.
    expect(getComputedStyle(document.documentElement).overflow).not.toBe("hidden");
  });

  test("arrastar pouco e soltar devolve a folha, sem deixar translate", async () => {
    await page.viewport(390, 844);
    const aoFechar = vi.fn();
    await render(<Folha aoFechar={aoFechar} />);

    await arrastarAlca(30);
    await esperar(700);

    expect(aoFechar).not.toHaveBeenCalled();
    const folha = document.querySelector("dialog")!;
    expect(folha.open).toBe(true);
    expect(folha.style.translate).toBe("");
    expect(getComputedStyle(folha).translate).toBe("none");
  });

  test("com o conteúdo no topo, arrastar por ele fecha", async () => {
    await page.viewport(390, 844);
    const aoFechar = vi.fn();
    await render(<Folha aoFechar={aoFechar} />);
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await arrastarConteudo(400);

    await vi.waitFor(() => expect(aoFechar).toHaveBeenCalled());
  });

  test("o X fecha deslizando: o dialog só fecha depois da animação", async () => {
    const aoFechar = vi.fn();
    await render(<Folha aoFechar={aoFechar} />);
    const folha = document.querySelector("dialog")!;

    await page.getByRole("button", { name: "Fechar" }).click();
    expect(aoFechar).toHaveBeenCalled();
    expect(folha.open).toBe(true);

    await vi.waitFor(() => expect(folha.open).toBe(false), { timeout: 1500 });
  });
});
