/**
 * Testes de navegador do foco no calendário.
 *
 * O que se protege: aberto com o dedo, o dia não vem aceso com o anel de Tab —
 * no iPhone vinha, como se alguém tivesse navegado até ele —, e escolhido o
 * dia, o campo não volta aceso. Pelo teclado, o foco segue o dia destacado,
 * que é o que deixa andar pelas setas.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CampoData } from "./campo-data";

function Tela() {
  return <CampoData name="entrega" rotulo="Entrega" defaultValue="2026-10-15" />;
}

const campo = () => page.getByRole("button", { name: /^Entrega:/ });
/** O dia na grade (o calendário vai por portal para o <body>). */
const dia = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-dia="${iso}"]`);

describe("foco no calendário", () => {
  test("aberto com o dedo, nenhum dia vem com o foco; escolhido, o campo não volta aceso", async () => {
    render(<Tela />);
    await campo().click();

    await vi.waitFor(() => expect(dia("2026-10-15")).not.toBeNull());
    expect(document.activeElement).not.toBe(dia("2026-10-15"));

    await page.elementLocator(dia("2026-10-20")!).click();
    await vi.waitFor(() => expect(dia("2026-10-20")).toBeNull());
    expect(document.activeElement).not.toBe(campo().element());
  });

  test("aberto pelo teclado, o foco vai para o dia e volta ao campo no Esc", async () => {
    render(<Tela />);
    await expect.element(campo()).toBeVisible();
    campo().element().focus();
    await userEvent.keyboard("{Enter}");

    await vi.waitFor(() => expect(document.activeElement).toBe(dia("2026-10-15")));
    await userEvent.keyboard("{Escape}");
    await expect.element(campo()).toHaveFocus();
  });
});
