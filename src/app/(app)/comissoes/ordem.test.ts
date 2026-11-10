import { describe, expect, test } from "vitest";

import { ordemDoParametro, ordenarPorNumero } from "./ordem";

const item = (numero: number, parcela: number | null = null, status = "ENVIADO") => ({
  numero,
  status,
  parcela: parcela === null ? null : { numero: parcela },
});

describe("ordemDoParametro", () => {
  test("só 'numero' troca a ordem; o resto é a de sempre", () => {
    expect(ordemDoParametro("numero")).toBe("numero");
    expect(ordemDoParametro("entrega")).toBe("entrega");
    expect(ordemDoParametro(undefined)).toBe("entrega");
    expect(ordemDoParametro("NUMERO")).toBe("entrega");
    expect(ordemDoParametro(["numero"])).toBe("entrega");
  });
});

describe("ordenarPorNumero", () => {
  test("pelo número do pedido, crescente", () => {
    const ordenados = ordenarPorNumero([item(2253), item(17), item(310)]);
    expect(ordenados.map((i) => i.numero)).toEqual([17, 310, 2253]);
  });

  test("as parcelas do mesmo pedido ficam juntas, na ordem delas", () => {
    const ordenados = ordenarPorNumero([item(40, 3), item(12), item(40, 1), item(55), item(40, 2)]);
    expect(ordenados.map((i) => [i.numero, i.parcela?.numero ?? null])).toEqual([
      [12, null],
      [40, 1],
      [40, 2],
      [40, 3],
      [55, null],
    ]);
  });

  test("o cancelado entra no lugar do número dele, não no fim", () => {
    // Como a página monta: enviados primeiro, cancelados no fim.
    const ordenados = ordenarPorNumero([item(30), item(50), item(40, null, "CANCELADO")]);
    expect(ordenados.map((i) => i.numero)).toEqual([30, 40, 50]);
  });

  test("não mexe na lista recebida", () => {
    const lista = [item(2), item(1)];
    ordenarPorNumero(lista);
    expect(lista.map((i) => i.numero)).toEqual([2, 1]);
  });
});
