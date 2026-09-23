/**
 * A leitura do motivo escrito à mão.
 *
 * O que se protege aqui é a distinção entre "não opinei" e "não quis escrever":
 * é ela que decide se uma gravada apaga o texto anterior ou o deixa em paz. Foi
 * a mesma distinção que, no IPI, deu um defeito mudo de dinheiro quando se
 * perdeu (ver `ipi-do-formulario.ts`).
 */

import { describe, expect, it } from "vitest";

import { LIMITE_DO_MOTIVO, motivoDoFormulario } from "./motivo";

function formulario(pares: Record<string, string>) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries(pares)) dados.set(chave, valor);
  return dados;
}

describe("motivoDoFormulario", () => {
  it("lê o que foi escrito", () => {
    const dados = formulario({ motivo: "Cliente desistiu" });

    expect(motivoDoFormulario(dados)).toBe("Cliente desistiu");
  });

  it("campo ausente é `null` — não opinou", () => {
    // Formulário que nem mostra a caixa não pode apagar o que já estava lá.
    expect(motivoDoFormulario(formulario({ outro: "x" }))).toBeNull();
  });

  it("campo vazio é string vazia — quis não escrever", () => {
    // Diferente de `null`: aqui a pessoa viu a caixa e a deixou em branco.
    expect(motivoDoFormulario(formulario({ motivo: "" }))).toBe("");
    expect(motivoDoFormulario(formulario({ motivo: "   " }))).toBe("");
  });

  it("apara o espaço das pontas", () => {
    expect(motivoDoFormulario(formulario({ motivo: "  adiou a compra  " }))).toBe(
      "adiou a compra",
    );
  });

  it("corta no limite em vez de recusar", () => {
    // A caixa já tem `maxLength`; este corte é a rede embaixo dela, e recusar
    // aqui perderia o motivo inteiro por causa do excesso.
    const longo = "a".repeat(LIMITE_DO_MOTIVO + 50);

    expect(motivoDoFormulario(formulario({ motivo: longo }))).toHaveLength(LIMITE_DO_MOTIVO);
  });

  it("o nome do campo é escolhido por quem chama", () => {
    // Dois documentos, duas caixas: `motivoRecusa` na proposta e
    // `motivoCancelamento` no pedido.
    const dados = formulario({ motivoCancelamento: "Indústria não entregou" });

    expect(motivoDoFormulario(dados, "motivoCancelamento")).toBe("Indústria não entregou");
    expect(motivoDoFormulario(dados, "motivoRecusa")).toBeNull();
  });
});
