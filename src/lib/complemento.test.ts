/**
 * As etiquetas de complemento.
 *
 * O complemento sai impresso, e a promessa aqui é que ele saia padronizado: a
 * ordem dos cliques não muda o texto, e o que foi digitado à mão não se perde.
 */

import { describe, expect, it } from "vitest";

import {
  type GrupoComplemento,
  alternarOpcao,
  comTextoDigitado,
  gruposVisiveis,
  opcoesMarcadas,
  textoDigitado,
} from "./complemento";
import { COMPLEMENTOS_TAMPA, TIPOS, tipoPorValor } from "./tipos-produto";

const GRUPOS: GrupoComplemento[] = [
  { titulo: "Fechamento", umaSo: true, opcoes: ["Tampa Fixa", "Tampa Removível"] },
  { titulo: "Segurança", opcoes: ["C/ Lacre", "Cinta de Segurança"] },
  { titulo: "Cor", umaSo: true, opcoes: ["Natural", "Azul"] },
];

describe("marcar e desmarcar", () => {
  it("escreve a opção no texto, e clicar de novo tira", () => {
    const marcado = alternarOpcao("", GRUPOS, "C/ Lacre");
    expect(marcado).toBe("C/ Lacre");
    expect(alternarOpcao(marcado, GRUPOS, "C/ Lacre")).toBe("");
  });

  it("a ordem dos cliques não muda o texto", () => {
    const assim = ["Azul", "C/ Lacre", "Tampa Removível"].reduce(
      (texto, opcao) => alternarOpcao(texto, GRUPOS, opcao),
      "",
    );
    const assado = ["Tampa Removível", "Azul", "C/ Lacre"].reduce(
      (texto, opcao) => alternarOpcao(texto, GRUPOS, opcao),
      "",
    );

    expect(assim).toBe("Tampa Removível C/ Lacre Azul");
    expect(assado).toBe(assim);
  });

  it("no grupo de uma opção só, marcar outra troca a anterior", () => {
    expect(alternarOpcao("Natural", GRUPOS, "Azul")).toBe("Azul");
  });

  it("no grupo de várias, as duas ficam", () => {
    expect(alternarOpcao("C/ Lacre", GRUPOS, "Cinta de Segurança")).toBe(
      "C/ Lacre Cinta de Segurança",
    );
  });

  it("o que foi digitado à mão fica, depois das opções", () => {
    expect(alternarOpcao("para azeite", GRUPOS, "Azul")).toBe("Azul para azeite");
    expect(alternarOpcao("Azul para azeite", GRUPOS, "Azul")).toBe("para azeite");
  });
});

describe("ler o texto", () => {
  it("acende a etiqueta do que foi digitado, sem olhar a caixa", () => {
    expect(opcoesMarcadas("tampa removível azul", GRUPOS)).toEqual(
      new Set(["Tampa Removível", "Azul"]),
    );
  });

  it("não acende por um pedaço de palavra", () => {
    expect(opcoesMarcadas("Azulado", GRUPOS).size).toBe(0);
  });

  it("a opção mais longa ganha da que está dentro dela", () => {
    expect(opcoesMarcadas("C/ Disco Ventilado Por Rosca", COMPLEMENTOS_TAMPA)).toEqual(
      new Set(["C/ Disco Ventilado", "Por Rosca"]),
    );
  });

  it("aceita opção com caractere de expressão regular", () => {
    const { complementos } = tipoPorValor("PAPELAO");
    expect(alternarOpcao("", complementos, "Maleta (FEFCO 0201)")).toBe("Maleta (FEFCO 0201)");
    expect(opcoesMarcadas("Maleta (FEFCO 0201)", complementos).size).toBe(1);
  });
});

describe("o que foi digitado à mão", () => {
  it("separa o digitado das opções", () => {
    expect(textoDigitado("Tampa Fixa Azul marinho", GRUPOS)).toBe("marinho");
    expect(textoDigitado("Tampa Fixa", GRUPOS)).toBe("");
  });

  it("troca o digitado sem mexer nas opções", () => {
    expect(comTextoDigitado("Azul marinho", GRUPOS, "fosco")).toBe("Azul fosco");
    expect(comTextoDigitado("Azul marinho", GRUPOS, "")).toBe("Azul");
  });
});

describe("buscar", () => {
  const nada = new Set<string>();
  const opcoes = (grupos: GrupoComplemento[]) => grupos.flatMap((g) => g.opcoes);

  it("sem busca, mostra tudo", () => {
    expect(gruposVisiveis(GRUPOS, "  ", nada)).toEqual(GRUPOS);
  });

  it("acha pela opção, sem acento e sem caixa", () => {
    expect(opcoes(gruposVisiveis(GRUPOS, "removivel", nada))).toEqual(["Tampa Removível"]);
  });

  it("acha pelo nome do grupo", () => {
    expect(opcoes(gruposVisiveis(GRUPOS, "cor", nada))).toEqual(["Natural", "Azul"]);
  });

  it("aceita os pedaços em qualquer ordem", () => {
    expect(opcoes(gruposVisiveis(GRUPOS, "lacre c/", nada))).toEqual(["C/ Lacre"]);
  });

  it("a marcada continua na tela, mesmo fora da busca", () => {
    const marcadas = new Set(["Azul"]);
    expect(opcoes(gruposVisiveis(GRUPOS, "lacre", marcadas))).toEqual(["C/ Lacre", "Azul"]);
  });

  it("some o grupo que ficou sem opção", () => {
    expect(gruposVisiveis(GRUPOS, "lacre", nada).map((g) => g.titulo)).toEqual(["Segurança"]);
  });

  it("devolve vazio quando nada casa", () => {
    expect(gruposVisiveis(GRUPOS, "zzz", nada)).toEqual([]);
  });
});

describe("o catálogo", () => {
  it("não repete opção dentro do mesmo tipo", () => {
    for (const tipo of TIPOS) {
      const todas = tipo.complementos.flatMap((g) => g.opcoes);
      expect(new Set(todas).size, tipo.rotulo).toBe(todas.length);
    }
  });
});
