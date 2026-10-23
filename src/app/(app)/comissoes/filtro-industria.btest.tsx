/**
 * Testes de navegador do filtro de indústria de Comissões: qual pílula fica
 * marcada e para onde cada uma leva — o mês aberto vai junto em todas.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

const navegou = vi.hoisted(() => [] as string[]);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: (href: string) => navegou.push(href) }) }));

import { FiltroIndustria, MAXIMO_DE_PILULAS } from "./filtro-industria";

const INDUSTRIAS = [
  { id: "eri", nome: "ERIPACK", pedidos: 2 },
  { id: "qua", nome: "QUALYPLAST", pedidos: 5 },
  { id: "vega", nome: "VEGAPACK", pedidos: 1 },
];

const endereco = (fornecedor: string | null) =>
  fornecedor ? `/comissoes?mes=2026-09&fornecedor=${fornecedor}` : "/comissoes?mes=2026-09";

describe("FiltroIndustria", () => {
  test("marca só a escolhida, com o número de pedidos de cada uma", async () => {
    await render(<FiltroIndustria industrias={INDUSTRIAS} escolhida="qua" endereco={endereco} />);

    const marcadas = page.getByRole("link").elements().filter((a) => a.getAttribute("aria-current") === "true");
    expect(marcadas.map((a) => a.textContent)).toEqual(["QUALYPLAST5"]);
    await expect.element(page.getByRole("link", { name: /ERIPACK/ })).toHaveTextContent("ERIPACK2");
  });

  test("cada pílula leva o mês aberto; Todas tira só a indústria", async () => {
    await render(<FiltroIndustria industrias={INDUSTRIAS} escolhida="qua" endereco={endereco} />);

    await expect
      .element(page.getByRole("link", { name: /VEGAPACK/ }))
      .toHaveAttribute("href", "/comissoes?mes=2026-09&fornecedor=vega");
    await expect.element(page.getByRole("link", { name: "Todas" })).toHaveAttribute("href", "/comissoes?mes=2026-09");
  });

  test("sem escolhida, Todas é a marcada", async () => {
    await render(<FiltroIndustria industrias={INDUSTRIAS} escolhida={null} endereco={endereco} />);

    await expect.element(page.getByRole("link", { name: "Todas" })).toHaveAttribute("aria-current", "true");
  });

  test("com muitas indústrias, vira a caixa de busca — e escolher navega", async () => {
    const muitas = Array.from({ length: MAXIMO_DE_PILULAS + 4 }, (_, i) => ({
      id: `f${i}`,
      nome: i === 7 ? "QUALYPLAST EMBALAGENS" : `INDÚSTRIA ${i}`,
      pedidos: i + 1,
    }));
    await render(<FiltroIndustria industrias={muitas} escolhida={null} endereco={endereco} />);

    // Nada de pílula: uma linha só, não importa quantas sejam.
    expect(page.getByRole("link").elements()).toHaveLength(0);

    await userEvent.type(page.getByPlaceholder("Digite o nome da indústria"), "qual");
    await page.getByRole("option", { name: /QUALYPLAST EMBALAGENS/ }).click();

    expect(navegou.at(-1)).toBe("/comissoes?mes=2026-09&fornecedor=f7");
  });
});
