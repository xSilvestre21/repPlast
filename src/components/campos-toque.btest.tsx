/**
 * Testes de navegador do campo em tela de toque.
 *
 * O que se protege: no iPhone, campo com fonte menor que 16px faz o Safari dar
 * zoom sozinho ao ser tocado — e a tela fica ampliada e fora do centro. Os
 * campos do sistema são `text-corpo` (14px); a regra de `globals.css` os leva a
 * 16px quando o ponteiro é o dedo (`pointer: coarse`), e só aí.
 *
 * O toque é ligado pelo protocolo do Chromium, que é o que faz a media query
 * `pointer: coarse` valer — a mesma que o iPhone satisfaz.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test } from "vitest";
import { cdp } from "vitest/browser";
import { render } from "vitest-browser-react";

import { Campo } from "./campos";
import { CLASSE_CONTROLE_CELULA } from "./controle";

async function toque(ligado: boolean) {
  await cdp().send("Emulation.setTouchEmulationEnabled", { enabled: ligado, maxTouchPoints: 5 });
}

afterEach(() => toque(false));

async function montar() {
  await render(
    <form>
      <Campo name="busca" rotulo="Buscar" />
      <input name="quantidade" className={CLASSE_CONTROLE_CELULA} />
      <input name="marcado" type="checkbox" className="text-corpo" />
    </form>,
  );
  const fonte = (nome: string) =>
    getComputedStyle(document.querySelector(`[name="${nome}"]`)!).fontSize;
  return fonte;
}

describe("campo em tela de toque", () => {
  test("no computador, o campo continua com 14px", async () => {
    const fonte = await montar();
    expect(matchMedia("(pointer: coarse)").matches).toBe(false);
    expect(fonte("busca")).toBe("14px");
    expect(fonte("quantidade")).toBe("14px");
  });

  test("com o dedo, todo campo de texto tem 16px — e o Safari não dá zoom", async () => {
    await toque(true);
    const fonte = await montar();
    expect(matchMedia("(pointer: coarse)").matches).toBe(true);
    expect(fonte("busca")).toBe("16px");
    expect(fonte("quantidade")).toBe("16px");
    // A caixa de marcar não tem texto para ampliar: fica como está.
    expect(fonte("marcado")).toBe("14px");
  });

  test("a página não rola de lado", () => {
    expect(getComputedStyle(document.documentElement).overflowX).toBe("clip");
    expect(getComputedStyle(document.body).overflowX).toBe("clip");
  });
});
