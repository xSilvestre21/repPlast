import { describe, expect, test } from "vitest";

import { BOAS_PARA_ENCERRAR, LENTAS_PARA_LIGAR, janelaLenta, vereditoDaMedicao } from "./efeitos";

const quadros = (quantos: number, intervalo: number) => Array.from({ length: quantos }, () => intervalo);

describe("janelaLenta", () => {
  test("60 quadros por segundo, lisos, não é lenta", () => {
    expect(janelaLenta(quadros(120, 16.7))).toBe(false);
  });

  test("um engasgo isolado (a hidratação) não condena a janela", () => {
    expect(janelaLenta([...quadros(110, 16.7), 180])).toBe(false);
  });

  test("tela a 30 quadros por segundo é lenta", () => {
    expect(janelaLenta(quadros(60, 33.3))).toBe(true);
  });

  test("um em cada seis quadros travando é lenta, mesmo com a média boa", () => {
    const aosTrancos = Array.from({ length: 120 }, (_, i) => (i % 6 === 0 ? 50 : 12));
    expect(janelaLenta(aosTrancos)).toBe(true);
  });

  test("janela curta demais não diz nada", () => {
    expect(janelaLenta(quadros(5, 100))).toBeNull();
    expect(janelaLenta([])).toBeNull();
  });
});

describe("vereditoDaMedicao", () => {
  test("três janelas lentas ligam os efeitos leves", () => {
    expect(vereditoDaMedicao([true, false, true, true])).toBe("leves");
  });

  test("janela boa no meio não absolve o aparelho lento", () => {
    // As duas primeiras são a tela de entrada, leve; a quarta, uma página já guardada.
    expect(vereditoDaMedicao([false, false, true, false, true, true])).toBe("leves");
  });

  test("enquanto nenhum dos dois lados chegou lá, continua medindo", () => {
    expect(vereditoDaMedicao([])).toBeNull();
    expect(vereditoDaMedicao([true, false])).toBeNull();
    expect(vereditoDaMedicao([true, true, false, false, false, false, false])).toBeNull();
  });

  test("seis janelas boas encerram com os efeitos completos", () => {
    expect(vereditoDaMedicao([false, false, false, false, false, false])).toBe("completos");
    expect(vereditoDaMedicao([true, false, false, true, false, false, false, false])).toBe("completos");
  });

  test("a medição sempre termina", () => {
    const limite = LENTAS_PARA_LIGAR + BOAS_PARA_ENCERRAR - 1;
    for (let lentas = 0; lentas <= limite; lentas++) {
      const janelas = Array.from({ length: limite }, (_, i) => i < lentas);
      expect(vereditoDaMedicao(janelas)).not.toBeNull();
    }
  });
});
