/**
 * Testes de navegador do número no topo das listas: o texto e a ponte entre a
 * lista (que sabe quantos a busca achou) e o cabeçalho (onde o número fica).
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { ContagemDaLista, ContagemProvider, textoDaContagem, useDefinirContagem } from "./contagem-lista";

describe("textoDaContagem", () => {
  test("sem busca, só o total; buscando, quantos de quantos", () => {
    expect(textoDaContagem(128, 128, "cliente", "clientes")).toBe("128 clientes");
    expect(textoDaContagem(3, 128, "cliente", "clientes")).toBe("3 de 128 clientes");
    expect(textoDaContagem(0, 128, "cliente", "clientes")).toBe("0 de 128 clientes");
  });

  test("o singular, e o milhar com ponto", () => {
    expect(textoDaContagem(1, 1, "cliente", "clientes")).toBe("1 cliente");
    expect(textoDaContagem(12, 1444, "produto", "produtos")).toBe("12 de 1.444 produtos");
  });
});

/** Faz o papel da lista: recebe uma busca nova e avisa o cabeçalho. */
function ListaFalsa({ achou }: { achou: number }) {
  const definir = useDefinirContagem();
  return (
    <button type="button" onClick={() => definir(achou)}>
      buscar
    </button>
  );
}

describe("ContagemDaLista", () => {
  test("começa com o número do servidor e acompanha a lista", async () => {
    await render(
      <ContagemProvider total={128} inicial={128}>
        <ContagemDaLista singular="cliente" plural="clientes" />
        <ListaFalsa achou={3} />
      </ContagemProvider>,
    );

    await expect.element(page.getByRole("status")).toHaveTextContent("128 clientes");
    await page.getByRole("button", { name: "buscar" }).click();
    await expect.element(page.getByRole("status")).toHaveTextContent("3 de 128 clientes");
  });

  test("sem cadastro nenhum, não mostra número (o estado vazio já diz)", async () => {
    const tela = await render(
      <ContagemProvider total={0} inicial={0}>
        <ContagemDaLista singular="cliente" plural="clientes" />
      </ContagemProvider>,
    );

    expect(tela.container.textContent).toBe("");
  });
});
