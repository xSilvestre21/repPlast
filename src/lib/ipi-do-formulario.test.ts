/**
 * A leitura do IPI que vem da linha de item.
 *
 * Mexe com dinheiro: o IPI entra no total do documento que vai para a indústria
 * e, por tabela, na base do que o representante recebe. O defeito que deu
 * origem a estes testes era mudo nas duas direções — marcar a caixa não surtia
 * efeito, e salvar a quantidade de uma linha tributada a isentava —, e só se
 * via conferindo o total à mão.
 */

import { describe, expect, it } from "vitest";

import {
  CAMPO_IPI,
  CAMPO_IPI_DEFINIDO,
  ipiDoFormulario,
  ipiParaGravar,
} from "./ipi-do-formulario";

/** Reproduz o que o navegador envia: caixa marcada vai como "on", desmarcada não vai. */
function formulario({ mostraIpi, marcada }: { mostraIpi: boolean; marcada?: boolean }) {
  const dados = new FormData();
  dados.set("quantidade", "10");
  if (mostraIpi) dados.set(CAMPO_IPI_DEFINIDO, "1");
  if (mostraIpi && marcada) dados.set(CAMPO_IPI, "on");
  return dados;
}

describe("ipiDoFormulario", () => {
  it("caixa marcada é cobrar", () => {
    expect(ipiDoFormulario(formulario({ mostraIpi: true, marcada: true }))).toBe(true);
  });

  it("caixa desmarcada é isentar", () => {
    // O caso que o marcador existe para salvar: o navegador não envia caixa
    // desmarcada, então sem ele isto seria indistinguível de "não opinou".
    expect(ipiDoFormulario(formulario({ mostraIpi: true, marcada: false }))).toBe(false);
  });

  it("formulário sem a caixa não opina", () => {
    expect(ipiDoFormulario(formulario({ mostraIpi: false }))).toBeNull();
  });
});

describe("ipiParaGravar", () => {
  it("cobrar grava verdadeiro", () => {
    expect(ipiParaGravar(formulario({ mostraIpi: true, marcada: true }))).toEqual({
      comIpi: true,
    });
  });

  it("isentar grava falso", () => {
    expect(ipiParaGravar(formulario({ mostraIpi: true, marcada: false }))).toEqual({
      comIpi: false,
    });
  });

  it("sem opinião não toca na coluna", () => {
    // Espalhar objeto vazio no `data` do Prisma deixa o valor como está. Era
    // isto que faltava: a gravação antiga escrevia `false` sempre, e cada
    // salvada de quantidade zerava o IPI de uma linha que ninguém quis isentar.
    expect(ipiParaGravar(formulario({ mostraIpi: false }))).toEqual({});
    expect(ipiParaGravar(formulario({ mostraIpi: false }))).not.toHaveProperty("comIpi");
  });
});

describe("o nome do campo", () => {
  it("é o que o navegador manda, e não um parecido", () => {
    /*
     * Esta é a asserção que teria pego o defeito: lia-se `comIpi` e a caixa se
     * chama `comIpiItem`. Ler o nome errado não estoura — devolve `null`, que
     * vira `false`, e o IPI some sem uma linha de erro em lugar nenhum.
     */
    const dados = new FormData();
    dados.set(CAMPO_IPI_DEFINIDO, "1");
    dados.set("comIpi", "on");

    expect(ipiDoFormulario(dados)).toBe(false);
    expect(CAMPO_IPI).toBe("comIpiItem");
    expect(CAMPO_IPI_DEFINIDO).toBe("comIpiItemDefinido");
  });
});
