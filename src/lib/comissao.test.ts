/**
 * Testes da apuração de comissão.
 *
 * O cenário base usa a configuração real da QUALYPLAST no sistema: 3% de
 * comissão base e uma faixa de 4,5% a partir de R$ 50.000 no mês.
 */

import { describe, expect, it } from "vitest";

import {
  type ConfigComissao,
  apurar,
  competenciaDe,
  intervaloDaCompetencia,
  percentualEfetivo,
  percentualNaFaixa,
} from "./comissao";

const PROGRESSIVA: ConfigComissao = {
  percentualBase: 3,
  faixas: [{ minimo: 50000, percentual: 4.5 }],
  modo: "PROGRESSIVA",
  unidadeMeta: "REAIS",
};

const RETROATIVA: ConfigComissao = { ...PROGRESSIVA, modo: "RETROATIVA" };

const SEM_FAIXA: ConfigComissao = { ...PROGRESSIVA, faixas: [] };

describe("percentual da faixa alcançada", () => {
  it("abaixo da primeira faixa vale a comissão base", () => {
    expect(percentualNaFaixa(PROGRESSIVA, 0).toFixed(2)).toBe("3.00");
    expect(percentualNaFaixa(PROGRESSIVA, 49999).toFixed(2)).toBe("3.00");
  });

  it("no mínimo exato a faixa já vale", () => {
    expect(percentualNaFaixa(PROGRESSIVA, 50000).toFixed(2)).toBe("4.50");
  });

  it("escolhe a faixa mais alta alcançada, mesmo fora de ordem", () => {
    const config: ConfigComissao = {
      ...PROGRESSIVA,
      faixas: [
        { minimo: 100000, percentual: 6 },
        { minimo: 50000, percentual: 4.5 },
      ],
    };

    expect(percentualNaFaixa(config, 120000).toFixed(2)).toBe("6.00");
    expect(percentualNaFaixa(config, 70000).toFixed(2)).toBe("4.50");
  });
});

describe("modo RETROATIVA — o percentual maior vale para o mês inteiro", () => {
  it("aplica a faixa a toda a base", () => {
    // 60.000 cruzou a faixa: tudo rende 4,5%.
    const resultado = apurar(RETROATIVA, { volumeMeta: 60000, baseReais: 60000 });

    expect(resultado.percentualEfetivo.toFixed(2)).toBe("4.50");
    expect(resultado.valor.toFixed(2)).toBe("2700.00");
  });

  it("abaixo da faixa rende a base", () => {
    const resultado = apurar(RETROATIVA, { volumeMeta: 40000, baseReais: 40000 });

    expect(resultado.valor.toFixed(2)).toBe("1200.00");
  });
});

describe("modo PROGRESSIVA — só o excedente rende mais", () => {
  it("divide o volume entre as faixas", () => {
    // 50.000 a 3% = 1.500 e 10.000 a 4,5% = 450, somando 1.950.
    const resultado = apurar(PROGRESSIVA, { volumeMeta: 60000, baseReais: 60000 });

    expect(resultado.valor.toFixed(2)).toBe("1950.00");
    // 1.950 sobre 60.000 = 3,25%.
    expect(resultado.percentualEfetivo.toFixed(4)).toBe("3.2500");
  });

  it("rende menos que o retroativo no mesmo volume", () => {
    const volumes = { volumeMeta: 60000, baseReais: 60000 };

    expect(
      apurar(PROGRESSIVA, volumes).valor.lessThan(apurar(RETROATIVA, volumes).valor),
    ).toBe(true);
  });

  it("atravessa várias faixas", () => {
    const config: ConfigComissao = {
      ...PROGRESSIVA,
      faixas: [
        { minimo: 50000, percentual: 4.5 },
        { minimo: 100000, percentual: 6 },
      ],
    };

    // 50.000 a 3% = 1.500 · 50.000 a 4,5% = 2.250 · 20.000 a 6% = 1.200.
    const resultado = apurar(config, { volumeMeta: 120000, baseReais: 120000 });

    expect(resultado.valor.toFixed(2)).toBe("4950.00");
  });

  it("exatamente no mínimo ainda não gerou excedente", () => {
    const resultado = apurar(PROGRESSIVA, { volumeMeta: 50000, baseReais: 50000 });

    expect(resultado.valor.toFixed(2)).toBe("1500.00");
    expect(resultado.percentualEfetivo.toFixed(2)).toBe("3.00");
  });
});

describe("meta medida em quilos", () => {
  const emQuilos: ConfigComissao = {
    percentualBase: 3,
    faixas: [{ minimo: 5000, percentual: 4.5 }],
    modo: "PROGRESSIVA",
    unidadeMeta: "KG",
  };

  it("a faixa segue os quilos, mas a comissão incide sobre os reais", () => {
    // 8.000 kg: 5.000 na base e 3.000 no excedente. A média ponderada é
    // (5000×3 + 3000×4,5) / 8000 = 3,5625%, aplicada sobre os R$ 100.000.
    const resultado = apurar(emQuilos, { volumeMeta: 8000, baseReais: 100000 });

    expect(resultado.percentualEfetivo.toFixed(4)).toBe("3.5625");
    expect(resultado.valor.toFixed(2)).toBe("3562.50");
  });

  it("no modo retroativo os quilos definem o percentual de toda a base", () => {
    const resultado = apurar(
      { ...emQuilos, modo: "RETROATIVA" },
      { volumeMeta: 8000, baseReais: 100000 },
    );

    expect(resultado.valor.toFixed(2)).toBe("4500.00");
  });
});

describe("sem faixas cadastradas", () => {
  it("a comissão base vale para todo o volume", () => {
    expect(percentualEfetivo(SEM_FAIXA, 999999).toFixed(2)).toBe("3.00");
    expect(apurar(SEM_FAIXA, { volumeMeta: 80000, baseReais: 80000 }).valor.toFixed(2)).toBe(
      "2400.00",
    );
  });
});

describe("mês sem venda", () => {
  it("não gera comissão e não quebra a divisão", () => {
    const resultado = apurar(PROGRESSIVA, { volumeMeta: 0, baseReais: 0 });

    expect(resultado.valor.toFixed(2)).toBe("0.00");
    expect(resultado.percentualEfetivo.toFixed(2)).toBe("3.00");
  });
});

describe("distância até a próxima faixa", () => {
  it("aponta quanto falta para subir", () => {
    const resultado = apurar(PROGRESSIVA, { volumeMeta: 38000, baseReais: 38000 });

    expect(resultado.faixaAtual).toBeNull();
    expect(resultado.proximaFaixa?.percentual).toBe(4.5);
    expect(resultado.faltaParaProxima?.toFixed(2)).toBe("12000.00");
  });

  it("na última faixa não há próxima", () => {
    const resultado = apurar(PROGRESSIVA, { volumeMeta: 60000, baseReais: 60000 });

    expect(resultado.faixaAtual?.percentual).toBe(4.5);
    expect(resultado.proximaFaixa).toBeNull();
    expect(resultado.faltaParaProxima).toBeNull();
  });
});

describe("competência", () => {
  it("formata como AAAA-MM", () => {
    expect(competenciaDe(new Date(2026, 8, 10))).toBe("2026-09");
    expect(competenciaDe(new Date(2026, 11, 31))).toBe("2026-12");
  });

  it("o intervalo cobre o mês inteiro e para no primeiro dia do seguinte", () => {
    const { de, ate } = intervaloDaCompetencia("2026-09");

    expect(de.getMonth()).toBe(8);
    expect(de.getDate()).toBe(1);
    expect(ate.getMonth()).toBe(9);
    expect(ate.getDate()).toBe(1);
  });
});
