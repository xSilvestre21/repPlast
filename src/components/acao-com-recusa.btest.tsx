/**
 * Testes de navegador da pergunta antes de excluir.
 *
 * A janela segura o envio e o refaz depois do "sim" — e o que se protege é
 * que esse refazer seja o MESMO envio: a ação só roda depois de confirmar,
 * nunca no Cancelar, e chega com os campos escondidos do formulário (é por
 * eles que "remover" sabe qual linha tirar). Precisa de `<dialog>` e
 * `requestSubmit` de verdade, por isso roda em Chromium.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { AcaoComRecusa } from "./acao-com-recusa";
import { usePerguntaAntes } from "./pergunta-antes";

function abrir() {
  const acao = vi.fn(async (_estado: object, formData: FormData) => {
    void formData;
    return {};
  });

  render(
    <AcaoComRecusa
      acao={acao}
      confirmar={{ titulo: "Remover “Saco 30x40”?", rotulo: "Remover" }}
    >
      <input type="hidden" name="itemId" value="item-7" />
      <button type="submit">remover</button>
    </AcaoComRecusa>,
  );

  return acao;
}

describe("pergunta antes de excluir", () => {
  test("o clique só abre a pergunta; o Cancelar não apaga", async () => {
    const acao = abrir();

    await page.getByRole("button", { name: "remover" }).click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect.element(page.getByText("Remover “Saco 30x40”?")).toBeVisible();
    await expect.element(page.getByText("Esta ação não pode ser desfeita.")).toBeVisible();
    // Aberta com o dedo ou o mouse, o foco fica na caixa: nenhum botão vem com
    // o anel de Tab aceso (no iPhone, o Cancelar vinha), e o Enter não apaga.
    await expect.element(page.getByRole("dialog")).toHaveFocus();

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(acao).not.toHaveBeenCalled();
  });

  test("aberta pelo teclado, o foco começa no Cancelar: o Enter distraído não apaga", async () => {
    const acao = abrir();

    const remover = page.getByRole("button", { name: "remover" });
    await expect.element(remover).toBeVisible();
    remover.element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(acao).not.toHaveBeenCalled();
  });

  test("confirmado, a ação roda uma vez, com os campos do formulário", async () => {
    const acao = abrir();

    await page.getByRole("button", { name: "remover" }).click();
    await page.getByRole("button", { name: "Remover", exact: true }).click();

    await vi.waitFor(() => expect(acao).toHaveBeenCalledTimes(1));
    const formData = acao.mock.calls[0][1];
    expect(formData.get("itemId")).toBe("item-7");
  });

  test("com impedimento, a janela diz o motivo e não oferece excluir", async () => {
    const acao = vi.fn(async () => ({}));
    render(
      <AcaoComRecusa
        acao={acao}
        confirmar={{
          titulo: "Excluir “GAMAPACK”?",
          rotulo: "Excluir",
          impedimento: "Esta indústria tem 12 produtos cadastrados e não pode ser excluída.",
        }}
      >
        <button type="submit">Excluir indústria</button>
      </AcaoComRecusa>,
    );

    await page.getByRole("button", { name: "Excluir indústria" }).click();
    await expect.element(page.getByText("Não é possível excluir “GAMAPACK”")).toBeVisible();
    await expect.element(page.getByText(/12 produtos cadastrados/)).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Excluir", exact: true })).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Entendi" }).click();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
    expect(acao).not.toHaveBeenCalled();
  });

  test("no botão com formAction, só ele pergunta — o outro envio segue direto", async () => {
    const salvar = vi.fn();
    const remover = vi.fn();
    const depois = vi.fn();

    function Logo() {
      const pergunta = usePerguntaAntes({ titulo: "Remover o logo?", rotulo: "Remover" }, depois);
      return (
        <form action={salvar}>
          <button type="submit">Salvar logo</button>
          <button type="submit" formAction={remover} onClick={pergunta.aoClicar}>
            remover logo atual
          </button>
          {pergunta.janela}
        </form>
      );
    }
    render(<Logo />);

    await page.getByRole("button", { name: "remover logo atual" }).click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(remover).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Remover", exact: true }).click();
    await vi.waitFor(() => expect(remover).toHaveBeenCalledTimes(1));
    expect(depois).toHaveBeenCalledTimes(1);
    expect(salvar).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "Salvar logo" }).click();
    await vi.waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
  });
});
