/**
 * Testes de navegador do campo de número (`Campo` com `numero`).
 *
 * O que se protege: medida e valor só aceitam número. "20L" na capacidade da
 * bombona entrava, a descrição não mostrava nada (não era número) e só o
 * servidor recusava, ao salvar. Agora a letra não entra — nem digitada, nem
 * colada — e o cursor não pula quando ela sai.
 *
 * Rode com:  npm run test:navegador
 */

import { useState } from "react";
import { describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { Campo } from "./ui";

function Controlado({ numero = "decimal" as const }: { numero?: "decimal" | "inteiro" }) {
  const [valor, setValor] = useState("");
  return (
    <>
      <Campo name="medida" rotulo="Medida" numero={numero} value={valor} onChange={(e) => setValor(e.target.value)} />
      <output data-valor="">{valor}</output>
    </>
  );
}

const caixa = () => document.querySelector<HTMLInputElement>('input[name="medida"]')!;
const guardado = () => document.querySelector("[data-valor]")!.textContent;

describe("só número", () => {
  test("a letra não entra: 20L fica 20, na caixa e no estado", async () => {
    const tela = await render(<Controlado />);

    await userEvent.type(tela.getByRole("textbox", { name: "Medida" }), "20L");

    expect(caixa().value).toBe("20");
    expect(guardado()).toBe("20");
  });

  test("aceita vírgula e ponto de milhar", async () => {
    const tela = await render(<Controlado />);

    await userEvent.type(tela.getByRole("textbox", { name: "Medida" }), "1.250,50");

    expect(caixa().value).toBe("1.250,50");
  });

  test("colar (ou o preenchimento automático) deixa só o número", async () => {
    const tela = await render(<Controlado />);

    // `fill` põe o texto inteiro de uma vez, como colar.
    await userEvent.fill(tela.getByRole("textbox", { name: "Medida" }), "R$ 13,50 por kg");

    expect(caixa().value).toBe("13,50");
    expect(guardado()).toBe("13,50");
  });

  test("a letra digitada no meio sai, e o cursor fica onde estava", async () => {
    const tela = await render(<Controlado />);
    const campo = tela.getByRole("textbox", { name: "Medida" });

    await userEvent.type(campo, "1250");
    caixa().setSelectionRange(2, 2);
    await userEvent.keyboard("x");

    expect(caixa().value).toBe("1250");
    expect(caixa().selectionStart).toBe(2);

    await userEvent.keyboard("3");
    expect(caixa().value).toBe("12350");
  });

  test("o inteiro não aceita nem vírgula", async () => {
    const tela = await render(<Controlado numero="inteiro" />);

    await userEvent.type(tela.getByRole("textbox", { name: "Medida" }), "36,5cx");

    expect(caixa().value).toBe("365");
  });

  test("o celular abre o teclado de números", async () => {
    await render(<Controlado />);
    expect(caixa().inputMode).toBe("decimal");
  });

  test("também no campo não controlado", async () => {
    const tela = await render(<Campo name="medida" rotulo="Medida" numero="decimal" defaultValue="" />);

    await userEvent.type(tela.getByRole("textbox", { name: "Medida" }), "0,08mm");

    expect(caixa().value).toBe("0,08");
  });
});
