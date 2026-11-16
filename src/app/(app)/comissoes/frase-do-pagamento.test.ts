import { describe, expect, it } from "vitest";

import { fraseDoSaldo } from "./frase-do-pagamento";

/** O espaço do "R$ 1,00" do `Intl` é não separável; aqui, espaço comum. */
const frase = (restante: number) =>
  fraseDoSaldo({ restante, nome: "Maria", mes: "novembro de 2026" }).frase.replace(/\u00a0/g, " ");

describe("a frase do saldo depois do pagamento", () => {
  it("quitado: diz que não falta nada, com o nome e o mês", () => {
    expect(fraseDoSaldo({ restante: 0, nome: "Maria", mes: "novembro de 2026" }).situacao).toBe("quitado");
    expect(frase(0)).toBe("Tudo quitado — Maria não tem mais nada a receber em novembro de 2026.");
  });

  it("faltando: quanto ainda falta para quitar o mês", () => {
    expect(fraseDoSaldo({ restante: 600, nome: "Maria", mes: "novembro de 2026" }).situacao).toBe("faltando");
    expect(frase(600)).toBe("Ainda faltam R$ 600,00 para quitar novembro de 2026.");
  });

  it("pago a mais: o valor sem sinal, e que desconta no mês seguinte", () => {
    expect(fraseDoSaldo({ restante: -50, nome: "Maria", mes: "novembro de 2026" }).situacao).toBe("a-mais");
    expect(frase(-50)).toBe("Ficou R$ 50,00 pago a mais — desconta no mês seguinte.");
  });

  it("um resto de arredondamento não vira dívida de zero centavo", () => {
    expect(fraseDoSaldo({ restante: 0.1 + 0.2 - 0.3, nome: "Maria", mes: "novembro de 2026" }).situacao).toBe(
      "quitado",
    );
  });
});
