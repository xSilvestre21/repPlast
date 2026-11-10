import { describe, expect, test } from "vitest";

import { digitosProcurados, numeroProcurado, numerosQueContem } from "./numero-procurado";

describe("digitosProcurados", () => {
  test("só número, com ou sem o # da tela", () => {
    expect(digitosProcurados("22")).toBe("22");
    expect(digitosProcurados("#22")).toBe("22");
    expect(digitosProcurados(" # 022 ")).toBe("022");
  });

  test("texto, ou número com texto, não é busca de número", () => {
    expect(digitosProcurados("")).toBeNull();
    expect(digitosProcurados("orion")).toBeNull();
    expect(digitosProcurados("22 orion")).toBeNull();
    expect(digitosProcurados("22x30")).toBeNull();
  });
});

describe("numeroProcurado", () => {
  test("o número exato, para ir ao topo", () => {
    expect(numeroProcurado("#2253")).toBe(2253);
    expect(numeroProcurado("orion")).toBeNull();
  });

  test("zero e o que não cabe no int do banco não são número de documento", () => {
    expect(numeroProcurado("0")).toBeNull();
    expect(numeroProcurado("99999999999")).toBeNull();
  });
});

describe("numerosQueContem", () => {
  test("o pedaço em qualquer ponto do número: 22 acha o 2224 e o 1220", () => {
    expect(numerosQueContem([22, 2224, 1220, 23, 300, 122], "22")).toEqual([22, 2224, 1220, 122]);
  });

  test("nenhum, quando nada tem o pedaço", () => {
    expect(numerosQueContem([1, 2, 3], "9")).toEqual([]);
  });
});
