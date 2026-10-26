/**
 * Testes de navegador do campo de dinheiro no celular.
 *
 * O que se protege: o cursor do `CampoMoeda` fica no fim também depois de um
 * toque no meio do valor. No Android o teclado virtual manda as teclas como
 * "Unidentified", e o cuidado que o computador faz pela tecla não funcionava —
 * o dígito entrava no meio e a máscara montava outro número.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { CampoMoeda } from "./campo-mascarado";

describe("CampoMoeda", () => {
  test("um toque no meio do valor devolve o cursor ao fim", async () => {
    await render(<CampoMoeda name="valor" rotulo="Valor recebido" defaultValue="1234.56" />);
    const campo = document.querySelector<HTMLInputElement>('input[name="valor"]')!;

    campo.focus();
    // O toque no meio: o navegador põe o cursor depois do "1".
    campo.setSelectionRange(1, 1);
    campo.dispatchEvent(new Event("select", { bubbles: true }));

    await vi.waitFor(() => expect(campo.selectionStart).toBe(campo.value.length));
  });

  test("selecionar um trecho continua valendo (para apagar ou trocar)", async () => {
    await render(<CampoMoeda name="valor" rotulo="Valor recebido" defaultValue="1234.56" />);
    const campo = document.querySelector<HTMLInputElement>('input[name="valor"]')!;

    campo.focus();
    campo.setSelectionRange(0, campo.value.length);
    campo.dispatchEvent(new Event("select", { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(campo.selectionStart).toBe(0);
    expect(campo.selectionEnd).toBe(campo.value.length);
  });
});
