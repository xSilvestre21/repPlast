/**
 * Testes de navegador do pagamento ao preposto.
 *
 * O que se protege: registrado o pagamento, o painel da linha FECHA sozinho —
 * o pagamento aparece nos valores da linha, e o painel aberto deixava a dúvida
 * se o clique tinha gravado. Recusado, fica aberto com a frase embaixo do
 * campo, para corrigir sem procurar de novo. `hidden` só se mede com layout de
 * verdade, por isso roda em Chromium.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import type { EstadoFormulario } from "./acoes";
import { type DadosRepasse, LinhaRepasse } from "./repasse";

const DADOS: DadosRepasse = {
  nome: "Iara Celina",
  cor: null,
  pedidos: 3,
  previsto: 1000,
  devido: 1000,
  pago: 0,
  anterior: 0,
  aRepassar: 1000,
  extrato: [],
  pagamentos: [],
};

function abrir(registrar: () => Promise<EstadoFormulario>) {
  render(<LinhaRepasse dados={DADOS} registrar={registrar} sugestao="1.000,00" hoje="2026-10-19" />);
}

const seta = () => page.getByRole("button", { name: "Extrato e pagamentos de Iara Celina" });

describe("registrar pagamento", () => {
  test("gravou: o painel fecha sozinho", async () => {
    abrir(async () => ({}));

    await seta().click();
    await expect.element(seta()).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect.element(seta()).toHaveAttribute("aria-expanded", "false");
  });

  test("recusado: continua aberto, com o motivo", async () => {
    abrir(async () => ({ erro: "Digite o valor pago, como 1.250,00." }));

    await seta().click();
    await page.getByRole("button", { name: "Registrar pagamento" }).click();

    await expect.element(page.getByText("Digite o valor pago, como 1.250,00.")).toBeVisible();
    await expect.element(seta()).toHaveAttribute("aria-expanded", "true");
  });
});
