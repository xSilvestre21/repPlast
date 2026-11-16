/**
 * Testes de navegador do resumo no alto do cartão de cada indústria.
 *
 * O que se protege: cada indústria diz o previsto, o recebido e a diferença —
 * recebido − previsto, do mês inteiro, a mesma conta do topo da página. A
 * diferença se divide embaixo em duas partes: o que ainda não foi pago, em
 * cinza, e o que a indústria pagou a mais ou a menos, em cor. O número leva
 * vermelho ou verde pelo sinal, o padrão do app. No celular, os três ficam um
 * embaixo do outro, sem estourar.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { somarComissao } from "@/lib/comissao";

import { ResumoDaIndustria } from "./resumo-da-industria";

/** Dois pedidos de 5%: um de 9.765,00 acertado com `acertoA`, outro de 4.200,00 com `acertoB`. */
function resumo(acertoA: string | null, acertoB: string | null = null) {
  return somarComissao([
    {
      base: "9765.00",
      percentual: "5",
      percentualPreposto: "40",
      acerto: acertoA ? { base: "9765.00", percentual: acertoA } : null,
    },
    {
      base: "4200.00",
      percentual: "5",
      percentualPreposto: "40",
      acerto: acertoB ? { base: "4200.00", percentual: acertoB } : null,
    },
  ]);
}

/** O cartão, com as contagens de pedidos que a página tira dos mesmos dois. */
function Cartao({ a, b = null, ehAdmin = true }: { a: string | null; b?: string | null; ehAdmin?: boolean }) {
  const pagos = [a, b].filter((x) => x !== null).length;
  return <ResumoDaIndustria resumo={resumo(a, b)} ehAdmin={ehAdmin} pagos={pagos} pendentes={2 - pagos} />;
}

/** A célula de um dos três números: o `<dt>` com o rótulo e o `<dd>` do lado. */
const celula = (rotulo: string) =>
  [...document.querySelectorAll("dt")].find((dt) => dt.textContent === rotulo)!.parentElement as HTMLElement;

/** O texto da célula, com o espaço do "R$ 1,00" (não separável, do `Intl`) como espaço comum. */
const texto = (rotulo: string) => celula(rotulo).textContent!.replace(/\u00a0/g, " ");

/** A cor do número grande da célula. */
const numero = (rotulo: string) => celula(rotulo).querySelector("dd > span")!;

describe("o resumo da indústria", () => {
  afterEach(async () => {
    await page.viewport(1280, 720);
  });

  test("um pago a menos e um por pagar: a diferença é recebido − previsto, em vermelho", async () => {
    await render(<Cartao a="4.5" />);

    // 488,25 + 210,00 previstos; o primeiro pago a 4,5% (439,43).
    expect(texto("Previsto")).toContain("R$ 698,25");
    expect(texto("Recebido")).toContain("R$ 439,43");
    expect(texto("Recebido")).toContain("1 pedido pago");
    // 439,43 − 698,25: os 210,00 que faltam e os 48,82 pagos a menos.
    expect(texto("Diferença")).toContain("-R$ 258,82");
    expect(texto("Diferença")).toContain("R$ 210,00 ainda não pagos");
    expect(texto("Diferença")).toContain("pagou R$ 48,82 a menos");
    // Abaixo do previsto: vermelho, como no resto do app.
    expect(numero("Diferença").className).toContain("text-perigo");
    // O "ainda não pagos" fica cinza; o "a menos", vermelho.
    expect(celula("Diferença").querySelector("dd .text-tinta-2")?.textContent).toContain("ainda não pagos");
  });

  test("pagou a mais: com o sinal e em verde", async () => {
    await render(<Cartao a="5" b="6" />);

    expect(texto("Recebido")).toContain("tudo pago");
    expect(texto("Diferença")).toContain("+R$ 42,00");
    expect(texto("Diferença")).toContain("pagou R$ 42,00 a mais");
    expect(numero("Diferença").className).toContain("text-verde");
  });

  test("pagou o previsto, e nada pago ainda", async () => {
    const { rerender } = await render(<Cartao a="5" b="5" />);
    expect(texto("Diferença")).toContain("pagou o previsto");

    // Sem acerto nenhum, "R$ 0,00 recebido" diria que a indústria pagou zero.
    await rerender(<Cartao a={null} />);
    expect(texto("Recebido")).toContain("—");
    expect(texto("Recebido")).toContain("nada pago ainda");
    expect(texto("Diferença")).toContain("-R$ 698,25");
    expect(texto("Diferença")).toContain("R$ 698,25 ainda não pagos");
    expect(numero("Diferença").className).toContain("text-perigo");
  });

  test("o preposto vê a fatia dele", async () => {
    await render(<Cartao a="4.5" ehAdmin={false} />);

    // 40% da comissão: 40% de 698,25 previstos; do acertado, 40% de 439,43.
    expect(texto("Previsto")).toContain("R$ 279,30");
    expect(texto("Previsto")).toContain("sua fatia");
    expect(texto("Recebido")).toContain("R$ 175,77");
    expect(texto("Diferença")).toContain("-R$ 103,53");
  });

  test("no celular, um embaixo do outro e sem passar da largura", async () => {
    await page.viewport(360, 780);
    await render(
      <div style={{ width: 296 }}>
        <Cartao a="4.5" />
      </div>,
    );

    const [previsto, recebido, diferenca] = ["Previsto", "Recebido", "Diferença"].map((r) =>
      celula(r).getBoundingClientRect(),
    );
    expect(recebido.top).toBeGreaterThanOrEqual(previsto.bottom);
    expect(diferenca.top).toBeGreaterThanOrEqual(recebido.bottom);
    for (const caixa of [previsto, recebido, diferenca]) expect(caixa.right).toBeLessThanOrEqual(296 + 0.5);
  });
});
