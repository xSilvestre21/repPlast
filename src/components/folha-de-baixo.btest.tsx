/**
 * Testes de navegador da folha que sobe de baixo.
 *
 * O que se protege é o gesto do iOS: segurar a alça e arrastar para baixo
 * fecha; arrastar pouco e soltar devolve a folha ao lugar; e o X continua
 * fechando.
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
      <p>Conteúdo</p>
    </FolhaDeBaixo>
  );
}

/** Arrasta a zona da alça `distancia` px para baixo, devagar (sem peteleco). */
async function arrastar(distancia: number) {
  const zona = document.querySelector<HTMLElement>("[data-arraste]")!;
  const { left, top } = zona.getBoundingClientRect();
  const ponto = (y: number) => ({ clientX: left + 20, clientY: top + 10 + y, pointerId: 7, button: 0, bubbles: true });
  zona.dispatchEvent(new PointerEvent("pointerdown", ponto(0)));
  for (let passo = 1; passo <= 5; passo++) {
    zona.dispatchEvent(new PointerEvent("pointermove", ponto((distancia * passo) / 5)));
    await esperar(20);
  }
  // Parado antes de soltar: a velocidade do fim do gesto fica perto de zero.
  await esperar(150);
  zona.dispatchEvent(new PointerEvent("pointerup", ponto(distancia)));
}

afterEach(async () => {
  await page.viewport(1280, 720);
});

describe("FolhaDeBaixo", () => {
  test("arrastar a alça para baixo fecha a folha", async () => {
    await page.viewport(390, 844);
    const aoFechar = vi.fn();
    await render(<Folha aoFechar={aoFechar} />);
    await expect.element(page.getByRole("dialog")).toBeVisible();

    await arrastar(400);

    await vi.waitFor(() => expect(aoFechar).toHaveBeenCalled());
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  test("arrastar pouco e soltar devolve a folha ao lugar", async () => {
    await page.viewport(390, 844);
    const aoFechar = vi.fn();
    await render(<Folha aoFechar={aoFechar} />);

    await arrastar(30);
    await esperar(300);

    expect(aoFechar).not.toHaveBeenCalled();
    const folha = document.querySelector("dialog")!;
    expect(folha.open).toBe(true);
    // De volta ao zero ("0 0", que o navegador escreve "0px").
    expect(folha.style.translate).toMatch(/^0px( 0px)?$/);
  });

  test("o X continua fechando", async () => {
    const aoFechar = vi.fn();
    await render(<Folha aoFechar={aoFechar} />);

    await page.getByRole("button", { name: "Fechar" }).click();
    expect(aoFechar).toHaveBeenCalled();
  });
});
