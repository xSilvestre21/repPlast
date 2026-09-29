import { describe, expect, it } from "vitest";

import { filtrarVariaveis, gatilhoNoCursor, inserirVariavel } from "./sugestao-variaveis";

const VARIAVEIS = [
  { nome: "numero", rotulo: "Número do pedido" },
  { nome: "cliente", rotulo: "Razão social do cliente" },
  { nome: "pedido_cliente", rotulo: "Nº do pedido do cliente" },
];

describe("gatilho", () => {
  it("abre na chave e acompanha o que vem depois dela", () => {
    expect(gatilhoNoCursor("Pedido {", 8)).toEqual({ inicio: 7, termo: "" });
    expect(gatilhoNoCursor("Pedido {nu", 10)).toEqual({ inicio: 7, termo: "nu" });
  });

  it("aceita espaço no meio do termo, para buscar como se fala", () => {
    expect(gatilhoNoCursor("Oi {pedido do", 13)).toEqual({ inicio: 3, termo: "pedido do" });
    expect(gatilhoNoCursor("Oi {nº do", 9)).toEqual({ inicio: 3, termo: "nº do" });
  });

  it("não abre com a chave já fechada nem com espaço logo depois dela", () => {
    expect(gatilhoNoCursor("Pedido {numero} e", 17)).toBeNull();
    expect(gatilhoNoCursor("{ texto", 7)).toBeNull();
    expect(gatilhoNoCursor("sem chave", 9)).toBeNull();
  });
});

describe("filtro", () => {
  it("acha pelo rótulo, sem acento, e põe quem começa com o termo na frente", () => {
    expect(filtrarVariaveis(VARIAVEIS, "razao").map((v) => v.nome)).toEqual(["cliente"]);
    expect(filtrarVariaveis(VARIAVEIS, "ped").map((v) => v.nome)).toEqual([
      "pedido_cliente",
      "numero",
    ]);
    expect(filtrarVariaveis(VARIAVEIS, "")).toHaveLength(3);
    expect(filtrarVariaveis(VARIAVEIS, "xyz")).toEqual([]);
    expect(filtrarVariaveis(VARIAVEIS, "pedido do cli").map((v) => v.nome)).toEqual([
      "pedido_cliente",
    ]);
    expect(filtrarVariaveis(VARIAVEIS, "nº do ped").map((v) => v.nome)).toEqual([
      "pedido_cliente",
    ]);
    expect(filtrarVariaveis(VARIAVEIS, "cliente razao").map((v) => v.nome)).toEqual(["cliente"]);
  });
});

describe("inserção", () => {
  it("troca o pedaço digitado pela variável inteira", () => {
    expect(inserirVariavel("Pedido {nu e mais", 7, 10, "{numero}")).toEqual({
      texto: "Pedido {numero} e mais",
      cursor: 15,
    });
  });

  it("aproveita a chave de fechamento que já estava lá", () => {
    expect(inserirVariavel("Pedido {nu}", 7, 10, "{numero}").texto).toBe("Pedido {numero}");
  });

  it("põe o fim do trecho condicional e deixa o cursor entre os dois", () => {
    expect(inserirVariavel("Oi {se", 3, 6, "{se cnpj}", "{fim}")).toEqual({
      texto: "Oi {se cnpj}{fim}",
      cursor: 12,
    });
  });
});
