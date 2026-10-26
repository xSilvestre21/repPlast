/**
 * Testes de navegador da chegada de uma página.
 *
 * O que se protege: a página nova chega sempre no topo. Vindo de uma página
 * rolada um pouco, ela abria rolada também, com o título colado no cabeçalho —
 * o Next só rola quando o começo da página nova está fora da tela. Voltando
 * pelo histórico, não: a posição é a que a pessoa espera reencontrar. E
 * chegando pelo menu do celular, que ainda está fechando, de novo quando ele
 * fecha — o Safari do iPhone devolvia a posição antiga ao destravar a rolagem.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { Pagina } from "./pagina";

const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));

let alto: HTMLDivElement;

beforeEach(() => {
  // Uma página comprida, para ter o que rolar.
  alto = document.createElement("div");
  alto.style.height = "3000px";
  document.body.append(alto);
  window.scrollTo(0, 400);
});

afterEach(() => {
  alto.remove();
  window.scrollTo(0, 0);
});

describe("Pagina", () => {
  test("chega no topo, mesmo vindo de uma página rolada", async () => {
    expect(window.scrollY).toBeGreaterThan(0);

    await render(<Pagina>Pedidos</Pagina>);
    await quadro();

    expect(window.scrollY).toBe(0);
  });

  test("chegando com o menu ainda fechando, volta ao topo quando ele fecha", async () => {
    const menu = document.createElement("dialog");
    document.body.append(menu);
    menu.showModal();

    await render(<Pagina>Painel</Pagina>);
    await quadro();
    // O que o Safari do iPhone faz ao destravar: devolve a posição antiga.
    window.scrollTo(0, 400);
    menu.close();
    await quadro();
    await quadro();

    expect(window.scrollY).toBe(0);
    menu.remove();
  });

  test("voltando pelo histórico, a rolagem fica como estava", async () => {
    window.dispatchEvent(new PopStateEvent("popstate"));

    await render(<Pagina>Pedidos</Pagina>);
    await quadro();

    expect(window.scrollY).toBe(400);
  });
});
