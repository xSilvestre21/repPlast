/**
 * Testes de navegador da comemoração da meta.
 *
 * O que se protege:
 *   - bater a meta solta o confete, na tela inteira (no `<body>`, fora da página);
 *   - recarregar com a meta já batida não repete a festa;
 *   - cair abaixo da meta e bater de novo comemora de novo — antes, a marca
 *     "já comemorou" valia para sempre, e o segundo acerto parecia quebrado;
 *   - com a folha do acerto aberta (o caso do celular), o confete espera ela
 *     fechar — por baixo da janela, ninguém via a festa.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { PainelMeta } from "./painel-meta";

function Painel({ batida }: { batida: boolean }) {
  return (
    <PainelMeta
      competencia="2026-10"
      meta="3000"
      nomeDoMes="outubro de 2026"
      herdadaDe={null}
      alcancado={batida ? 3100 : 1500}
      progresso={batida ? 1 : 0.5}
      batida={batida}
      falta={batida ? 0 : 1500}
      definirMeta={async () => ({})}
    />
  );
}

const confete = () => document.body.querySelector<HTMLElement>(":scope > .confete");
const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));

beforeEach(async () => {
  localStorage.clear();
  await page.viewport(390, 844);
});
afterEach(async () => {
  await page.viewport(1280, 720);
});

describe("comemoração da meta", () => {
  test("bater a meta solta o confete, direto no body", async () => {
    const tela = await render(<Painel batida={false} />);
    await quadro();
    expect(confete()?.hidden).toBe(true);

    await tela.rerender(<Painel batida />);
    await quadro();

    expect(confete()?.hidden).toBe(false);
  });

  test("recarregar com a meta já batida não repete a festa", async () => {
    const primeira = await render(<Painel batida />);
    await quadro();
    expect(confete()?.hidden).toBe(false);
    await primeira.unmount();

    await render(<Painel batida />);
    await quadro();

    expect(confete()?.hidden).toBe(true);
  });

  test("cair abaixo da meta e bater de novo comemora de novo", async () => {
    const tela = await render(<Painel batida />);
    await quadro();
    await tela.rerender(<Painel batida={false} />);
    await quadro();
    confete()!.hidden = true; // a primeira festa já terminou

    await tela.rerender(<Painel batida />);
    await quadro();

    expect(confete()?.hidden).toBe(false);
  });

  test("com a folha do acerto aberta, o confete espera ela fechar", async () => {
    const folha = document.createElement("dialog");
    document.body.append(folha);
    folha.showModal();

    const tela = await render(<Painel batida={false} />);
    await tela.rerender(<Painel batida />);
    await quadro();
    expect(confete()?.hidden).toBe(true);

    folha.close();
    await quadro();

    expect(confete()?.hidden).toBe(false);
    folha.remove();
  });
});
