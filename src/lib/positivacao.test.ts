import { describe, expect, it } from "vitest";

import { clientesSumidos } from "./positivacao";

const AGORA = new Date(2026, 8, 10, 12).getTime();
const DIA = 24 * 60 * 60 * 1000;

/** Cliente cuja última compra foi há `dias` dias. */
const ha = (id: string, dias: number | null) => ({
  id,
  apelido: id,
  ultimaCompra: dias === null ? null : new Date(AGORA - dias * DIA),
});

describe("clientes sumidos", () => {
  it("traz quem passou do corte e ignora quem comprou dentro dele", () => {
    const sumidos = clientesSumidos([ha("A", 90), ha("B", 10)], 60, AGORA);

    expect(sumidos.map((s) => s.cliente.id)).toEqual(["A"]);
  });

  it("ordena do mais abandonado para o menos", () => {
    const sumidos = clientesSumidos([ha("A", 70), ha("B", 200), ha("C", 90)], 60, AGORA);

    expect(sumidos.map((s) => s.cliente.id)).toEqual(["B", "C", "A"]);
  });

  it("conta os dias sem comprar", () => {
    const sumidos = clientesSumidos([ha("A", 75)], 60, AGORA);

    expect(sumidos[0].diasSemComprar).toBe(75);
  });

  it("quem nunca comprou não conta como sumido", () => {
    // É assunto de prospecção, não de positivação.
    const sumidos = clientesSumidos([ha("NOVO", null), ha("A", 90)], 60, AGORA);

    expect(sumidos.map((s) => s.cliente.id)).toEqual(["A"]);
  });

  it("exatamente no corte ainda não está sumido", () => {
    expect(clientesSumidos([ha("A", 60)], 60, AGORA)).toHaveLength(0);
    expect(clientesSumidos([ha("A", 61)], 60, AGORA)).toHaveLength(1);
  });

  it("mudar o corte muda quem aparece", () => {
    const clientes = [ha("A", 45), ha("B", 100), ha("C", 200)];

    expect(clientesSumidos(clientes, 30, AGORA).map((s) => s.cliente.id)).toEqual([
      "C",
      "B",
      "A",
    ]);
    expect(clientesSumidos(clientes, 90, AGORA).map((s) => s.cliente.id)).toEqual(["C", "B"]);
    expect(clientesSumidos(clientes, 180, AGORA).map((s) => s.cliente.id)).toEqual(["C"]);
  });

  it("lista vazia não quebra", () => {
    expect(clientesSumidos([], 60, AGORA)).toEqual([]);
  });
});
