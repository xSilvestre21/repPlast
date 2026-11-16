import { describe, expect, it } from "vitest";

import { explicarDiferenca, pedidosNaoPagos } from "./diferenca";

/** O espaço do "R$ 1,00" do `Intl` é não separável; aqui, espaço comum. */
const frase = (...args: Parameters<typeof explicarDiferenca>) =>
  explicarDiferenca(...args).replace(/\u00a0/g, " ");

describe("a frase da diferença", () => {
  it("outubro/2026: falta o não pago, menos o que veio a mais", () => {
    // Os números reais de outubro: −5.317,47 = 690,87 − 6.008,34.
    expect(
      frase({ diferenca: "-5317.47", aAcertar: "6008.34", nosAcertados: "690.87", pendentes: 10 }),
    ).toBe(
      "Faltam R$ 5.317,47: R$ 6.008,34 de 10 pedidos ainda não pagos, menos R$ 690,87 que as indústrias pagaram a mais.",
    );
  });

  it("falta o não pago, mais o que veio a menos", () => {
    expect(frase({ diferenca: "-1200", aAcertar: "1000", nosAcertados: "-200", pendentes: 1 })).toBe(
      "Faltam R$ 1.200,00: R$ 1.000,00 de 1 pedido ainda não pago, mais R$ 200,00 que as indústrias pagaram a menos.",
    );
  });

  it("só falta o que ainda não foi pago", () => {
    expect(frase({ diferenca: "-500", aAcertar: "500", nosAcertados: "0", pendentes: 3 })).toBe(
      "Faltam R$ 500,00: são R$ 500,00 de 3 pedidos ainda não pagos.",
    );
  });

  it("o que veio a mais passa do que falta", () => {
    expect(frase({ diferenca: "50", aAcertar: "100", nosAcertados: "150", pendentes: 2 })).toBe(
      "Já entrou R$ 50,00 a mais que o previsto: as indústrias pagaram R$ 150,00 a mais, e ainda faltam R$ 100,00 de 2 pedidos ainda não pagos.",
    );
    expect(frase({ diferenca: "0", aAcertar: "100", nosAcertados: "100", pendentes: 2 })).toMatch(
      /^O recebido já empata com o previsto: /,
    );
  });

  it("tudo pago", () => {
    expect(frase({ diferenca: "0", aAcertar: "0", nosAcertados: "0", pendentes: 0 })).toBe(
      "Tudo pago, exatamente o previsto.",
    );
    expect(frase({ diferenca: "640.4", aAcertar: "0", nosAcertados: "640.4", pendentes: 0 })).toBe(
      "Tudo pago. As indústrias pagaram R$ 640,40 a mais do que o previsto.",
    );
    expect(
      frase({ diferenca: "-94.45", aAcertar: "0", nosAcertados: "-94.45", pendentes: 0, quem: "a indústria" }),
    ).toBe("Tudo pago. A indústria pagou R$ 94,45 a menos do que o previsto.");
  });

  it("o plural dos pedidos", () => {
    expect(pedidosNaoPagos(1)).toBe("1 pedido ainda não pago");
    expect(pedidosNaoPagos(2)).toBe("2 pedidos ainda não pagos");
  });
});
