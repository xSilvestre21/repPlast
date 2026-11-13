/**
 * Testes de navegador do resumo no alto do cartão de cada indústria.
 *
 * O que se protege: cada indústria diz o previsto, o recebido e a diferença —
 * e "pagou a menos" só quando o ACERTO veio abaixo do previsto dos pedidos
 * acertados. O pedido que ainda não foi acertado vira "falta acertar", e não
 * prejuízo. No celular, os três ficam um embaixo do outro, sem estourar.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { somarComissao } from "@/lib/comissao";

import { ResumoDaIndustria } from "./resumo-da-industria";

/** Dois pedidos de 5%: um de 9.765,00 acertado com `acertoA`, outro de 4.200,00 sem acerto. */
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

/** A célula de um dos três números: o `<dt>` com o rótulo e o `<dd>` do lado. */
const celula = (rotulo: string) =>
  [...document.querySelectorAll("dt")].find((dt) => dt.textContent === rotulo)!.parentElement as HTMLElement;

/** O texto da célula, com o espaço do "R$ 1,00" (não separável, do `Intl`) como espaço comum. */
const texto = (rotulo: string) => celula(rotulo).textContent!.replace(/\u00a0/g, " ");

describe("o resumo da indústria", () => {
  afterEach(async () => {
    await page.viewport(1280, 720);
  });

  test("pagou a menos: a diferença em vermelho, sobre o que já foi acertado", async () => {
    await render(<ResumoDaIndustria resumo={resumo("4.5")} ehAdmin />);

    // 488,25 + 210,00 previstos; o primeiro pago a 4,5% (439,43).
    expect(texto("Previsto")).toContain("R$ 698,25");
    expect(texto("Recebido")).toContain("R$ 439,43");
    // O segundo, sem acerto, é o que falta — não entra na diferença.
    expect(texto("Recebido")).toContain("falta acertar R$ 210,00");
    expect(texto("Diferença")).toContain("-R$ 48,82");
    expect(texto("Diferença")).toContain("pagou a menos");
    expect(celula("Diferença").querySelector(".text-perigo")).not.toBeNull();
  });

  test("pagou a mais: com o sinal e em verde", async () => {
    await render(<ResumoDaIndustria resumo={resumo("5", "6")} ehAdmin />);

    expect(texto("Recebido")).toContain("tudo acertado");
    expect(texto("Diferença")).toContain("+R$ 42,00");
    expect(texto("Diferença")).toContain("pagou a mais");
    expect(celula("Diferença").querySelector(".text-verde")).not.toBeNull();
  });

  test("pagou o previsto, e nada acertado ainda", async () => {
    const { rerender } = await render(<ResumoDaIndustria resumo={resumo("5", "5")} ehAdmin />);
    expect(texto("Diferença")).toContain("pagou o previsto");

    // Sem acerto nenhum, "R$ 0,00 recebido" diria que a indústria pagou zero.
    await rerender(<ResumoDaIndustria resumo={resumo(null)} ehAdmin />);
    expect(texto("Recebido")).toContain("—");
    expect(texto("Recebido")).toContain("falta acertar R$ 698,25");
    expect(texto("Diferença")).toContain("nada acertado");
  });

  test("o preposto vê a fatia dele", async () => {
    await render(<ResumoDaIndustria resumo={resumo("4.5")} ehAdmin={false} />);

    // 40% da comissão: 40% de 698,25 previstos; do acertado, 40% de 439,43.
    expect(texto("Previsto")).toContain("R$ 279,30");
    expect(texto("Previsto")).toContain("sua fatia");
    expect(texto("Recebido")).toContain("R$ 175,77");
  });

  test("no celular, um embaixo do outro e sem passar da largura", async () => {
    await page.viewport(360, 780);
    await render(
      <div style={{ width: 296 }}>
        <ResumoDaIndustria resumo={resumo("4.5")} ehAdmin />
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
