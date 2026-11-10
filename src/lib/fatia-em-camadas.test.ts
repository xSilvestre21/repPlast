import { describe, expect, test, vi } from "vitest";

import { fatiaEmCamadas } from "./fatia-em-camadas";

/** Camadas de mentira: cada uma é uma lista, e o "where" é o índice dela. */
function camadasDe(listas: string[][]) {
  const buscar = vi.fn(async (i: number, pular: number, levar: number) => listas[i].slice(pular, pular + levar));
  const contar = vi.fn(async (i: number) => listas[i].length);
  return { camadas: listas.map((_, i) => i), buscar, contar };
}

const LISTAS = [["exato"], ["p1", "p2", "p3"], ["m1", "m2", "m3", "m4", "m5"]];
const TUDO = LISTAS.flat();

describe("fatiaEmCamadas", () => {
  test("a primeira fatia: as camadas em ordem, sem contar nenhuma", async () => {
    const { camadas, buscar, contar } = camadasDe(LISTAS);

    expect(await fatiaEmCamadas(camadas, { inicio: 0, quantos: 3 }, { buscar, contar })).toEqual([
      "exato",
      "p1",
      "p2",
    ]);
    expect(contar).not.toHaveBeenCalled();
  });

  test("qualquer fatia é a mesma da lista inteira, cortada no mesmo ponto", async () => {
    for (let inicio = 0; inicio <= TUDO.length + 1; inicio++) {
      for (const quantos of [1, 2, 3, 4, 10]) {
        const { camadas, buscar, contar } = camadasDe(LISTAS);
        expect(await fatiaEmCamadas(camadas, { inicio, quantos }, { buscar, contar })).toEqual(
          TUDO.slice(inicio, inicio + quantos),
        );
      }
    }
  });

  test("a última camada nunca é contada: depois dela não há outra a empurrar", async () => {
    const { camadas, buscar, contar } = camadasDe(LISTAS);

    await fatiaEmCamadas(camadas, { inicio: 5, quantos: 3 }, { buscar, contar });

    expect(contar.mock.calls.map(([i]) => i)).toEqual([0, 1]);
    // E só a camada que a fatia alcança é buscada.
    expect(buscar.mock.calls).toEqual([[2, 1, 3]]);
  });

  test("camada vazia no meio não atrapalha", async () => {
    const { camadas, buscar, contar } = camadasDe([["a"], [], ["b", "c"]]);
    expect(await fatiaEmCamadas(camadas, { inicio: 1, quantos: 5 }, { buscar, contar })).toEqual(["b", "c"]);
  });

  test("uma camada só é a consulta de sempre", async () => {
    const { camadas, buscar, contar } = camadasDe([["a", "b", "c"]]);
    expect(await fatiaEmCamadas(camadas, { inicio: 1, quantos: 1 }, { buscar, contar })).toEqual(["b"]);
    expect(contar).not.toHaveBeenCalled();
  });
});
