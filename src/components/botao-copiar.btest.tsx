/**
 * Testes de navegador do botão Copiar: o texto vai inteiro para a área de
 * transferência, o "Copiado" volta sozinho, e a recusa do navegador vira frase.
 *
 * A área de transferência é trocada por uma falsa: a de verdade pede foco e
 * permissão, que o Chromium dos testes não dá sempre.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { BotaoCopiar } from "./botao-copiar";

const TEXTO = "PIX (CNPJ): 12.345.678/0001-95\nBanco Itaú · Ag. 1234 · CC 56789-0";

function areaFalsa(escrever: (texto: string) => Promise<void>) {
  vi.spyOn(navigator, "clipboard", "get").mockReturnValue({ writeText: escrever } as Clipboard);
}

afterEach(() => vi.restoreAllMocks());

describe("BotaoCopiar", () => {
  test("copia o texto inteiro, com as quebras de linha, e diz Copiado", async () => {
    const escrito: string[] = [];
    areaFalsa(async (texto) => void escrito.push(texto));
    await render(<BotaoCopiar texto={TEXTO} />);

    await page.getByRole("button", { name: "Copiar" }).click();

    expect(escrito).toEqual([TEXTO]);
    await expect.element(page.getByRole("button", { name: "Copiado" })).toBeVisible();
  });

  test("o Copiado volta a Copiar sozinho", async () => {
    areaFalsa(async () => {});
    await render(<BotaoCopiar texto={TEXTO} />);

    await page.getByRole("button", { name: "Copiar" }).click();
    await expect.element(page.getByRole("button", { name: "Copiado" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Copiar" }), { timeout: 4000 }).toBeVisible();
  });

  test("navegador recusou: manda selecionar e copiar", async () => {
    areaFalsa(() => Promise.reject(new DOMException("negado", "NotAllowedError")));
    await render(<BotaoCopiar texto={TEXTO} />);

    await page.getByRole("button", { name: "Copiar" }).click();

    await expect.element(page.getByText("Não deu para copiar. Selecione o texto e copie.")).toBeVisible();
  });
});
