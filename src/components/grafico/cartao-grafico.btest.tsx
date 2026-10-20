/**
 * Testes de navegador do botão de baixar a imagem do cartão.
 *
 * O que se protege: o botão só aparece quando há gráfico para baixar. Na
 * visão de tabela ou de lista não há canvas, e o botão ficava lá sem fazer
 * nada. A troca de visão mora no cartão que chama, por isso o teste troca o
 * conteúdo de fora e espera o botão sumir e voltar.
 *
 * Rode com:  npm run test:navegador
 */

import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { CartaoGrafico } from "./cartao-grafico";

function Cartao({ inicial }: { inicial: "grafico" | "tabela" }) {
  const [visao, setVisao] = useState(inicial);
  return (
    <CartaoGrafico
      titulo="Comissão por cliente"
      icone={BarChart3}
      controles={
        <button type="button" onClick={() => setVisao((v) => (v === "grafico" ? "tabela" : "grafico"))}>
          trocar visão
        </button>
      }
    >
      {visao === "grafico" ? (
        <div data-grafico="" style={{ height: 100 }} />
      ) : (
        <table>
          <tbody>
            <tr>
              <td>SIGMA PACK</td>
            </tr>
          </tbody>
        </table>
      )}
    </CartaoGrafico>
  );
}

const baixar = () => page.getByRole("button", { name: "Baixar imagem" });

describe("baixar imagem do cartão", () => {
  test("com gráfico, o botão aparece", async () => {
    render(<Cartao inicial="grafico" />);
    await expect.element(baixar()).toBeInTheDocument();
  });

  test("na tabela, o botão nem aparece; volta junto com o gráfico", async () => {
    render(<Cartao inicial="tabela" />);
    await expect.element(page.getByText("SIGMA PACK")).toBeVisible();
    await expect.element(baixar()).not.toBeInTheDocument();

    await page.getByRole("button", { name: "trocar visão" }).click();
    await expect.element(baixar()).toBeInTheDocument();

    await page.getByRole("button", { name: "trocar visão" }).click();
    await expect.element(baixar()).not.toBeInTheDocument();
  });

  test("na tela cheia, o botão continua seguindo a visão", async () => {
    render(<Cartao inicial="grafico" />);
    await page.getByRole("button", { name: "Tela cheia" }).click();
    await expect.element(baixar()).toBeInTheDocument();

    await page.getByRole("button", { name: "trocar visão" }).click();
    await expect.element(baixar()).not.toBeInTheDocument();
  });
});
