/**
 * Testes de navegador da prévia do nome do escritório (cadastro e Configurações).
 *
 * A prévia promete mostrar o nome como o topo vai mostrar, no pior caso — e a
 * dica do cadastro promete que até uns 12 caracteres ficam no tamanho cheio.
 * As duas promessas são de geometria, com a fonte de verdade.
 *
 * Rode com:  npm run test:navegador
 */

import "@fontsource/plus-jakarta-sans/800.css";

import { beforeAll, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CampoNomeEscritorio } from "./campo-nome-escritorio";

beforeAll(async () => {
  document.documentElement.style.setProperty("--fonte-sans", '"Plus Jakarta Sans"');
  await document.fonts.load('800 18px "Plus Jakarta Sans"');
});

function nomeNaPrevia() {
  return document.querySelector<HTMLElement>("[data-previa-nome] [data-nome-escritorio]")!;
}

describe("prévia do nome do escritório", () => {
  test("acompanha o que é digitado", async () => {
    const tela = await render(<CampoNomeEscritorio dica="dica" />);
    expect(nomeNaPrevia().textContent).toBe("Seu escritório");

    await page.getByRole("textbox").fill("Vera & Assis");
    await expect.poll(() => nomeNaPrevia().textContent).toBe("Vera & Assis");
    await expect.poll(() => nomeNaPrevia().style.fontSize).toBe("18px");
    await tela.unmount();
  });

  test.each(["Vera & Assis", "Moreira Rep.", "Assis & Cia", "Grupo Moreira"])(
    "“%s” (até uns 12 caracteres) fica no tamanho cheio, mesmo no pior caso",
    async (nome) => {
      const tela = await render(<CampoNomeEscritorio valorInicial={nome} dica="dica" />);
      await expect.poll(() => nomeNaPrevia().style.fontSize).toBe("18px");
      expect(nomeNaPrevia().dataset.linhas).toBe("1");
      await tela.unmount();
    },
  );

  test("as abas da prévia ficam no mesmo lugar, qualquer que seja o nome", async () => {
    const tela = await render(<CampoNomeEscritorio dica="dica" />);
    const centroDasAbas = () => {
      const abas = document.querySelector<HTMLElement>("[data-previa-abas]")!.getBoundingClientRect();
      return abas.left + abas.width / 2;
    };

    const centros: number[] = [];
    for (const nome of ["Val", "Moreira & Guimarães Representações Ltda", "X".repeat(45)]) {
      await page.getByRole("textbox").fill(nome);
      await expect.poll(() => nomeNaPrevia().textContent).toBe(nome);
      centros.push(centroDasAbas());
    }

    for (const centro of centros) expect(Math.abs(centro - centros[0])).toBeLessThan(1);
    await tela.unmount();
  });

  test("avisa quando o nome não cabe", async () => {
    const tela = await render(<CampoNomeEscritorio dica="dica" />);
    await page.getByRole("textbox").fill("MOREIRA REPRESENTAÇÕES LTDA");
    await expect.element(page.getByText(/Não cabe inteiro no topo/)).toBeVisible();
    await tela.unmount();
  });
});
