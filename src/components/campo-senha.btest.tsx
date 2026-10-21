/**
 * Testes de navegador do olho do campo de senha.
 *
 * O que se protege: o olho mostra e esconde o que foi digitado sem perder o
 * valor, e clicar nele não envia o formulário nem tira o rótulo da caixa.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { CampoSenha } from "./campos";

describe("campo de senha", () => {
  test("o olho mostra e esconde a senha, sem enviar o formulário", async () => {
    let enviou = false;
    const tela = await render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviou = true;
        }}
      >
        <CampoSenha name="senha" rotulo="Senha" />
      </form>,
    );
    const campo = tela.container.querySelector<HTMLInputElement>('input[name="senha"]')!;

    await page.getByLabelText("Senha", { exact: true }).fill("abcd efgh");
    expect(campo.type).toBe("password");

    await page.getByRole("button", { name: "Mostrar a senha" }).click();
    expect(campo.type).toBe("text");
    expect(campo.value).toBe("abcd efgh");

    await page.getByRole("button", { name: "Esconder a senha" }).click();
    expect(campo.type).toBe("password");
    expect(enviou).toBe(false);
    await tela.unmount();
  });
});
