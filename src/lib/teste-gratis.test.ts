import { describe, expect, test } from "vitest";

import { fimDoPeriodoPago } from "./acesso-assinatura";
import {
  datasDoTeste,
  diasDeTesteRestantes,
  emTesteGratis,
  escreverDia,
  hojeEmBrasilia,
  primeiraCobranca,
  ultimoDiaGratis,
} from "./teste-gratis";

describe("primeiraCobranca", () => {
  test("7 dias depois do cadastro: no dia 9, a cobrança é no 16", () => {
    expect(primeiraCobranca(new Date("2026-11-09T15:00:00Z"))).toBe("2026-11-16");
  });

  test("conta o dia de Brasília: às 22h de lá, já é o dia seguinte em UTC", () => {
    // 01:30 UTC do dia 10 ainda é 22:30 do dia 9 em Brasília.
    expect(hojeEmBrasilia(new Date("2026-11-10T01:30:00Z"))).toBe("2026-11-09");
    expect(primeiraCobranca(new Date("2026-11-10T01:30:00Z"))).toBe("2026-11-16");
  });

  test("vira o mês e o ano", () => {
    expect(primeiraCobranca(new Date("2026-11-28T15:00:00Z"))).toBe("2026-12-05");
    expect(primeiraCobranca(new Date("2026-12-29T15:00:00Z"))).toBe("2027-01-05");
    expect(primeiraCobranca(new Date("2028-02-25T15:00:00Z"))).toBe("2028-03-03");
  });
});

describe("emTesteGratis", () => {
  const testeAte = fimDoPeriodoPago("2026-11-16");

  test("em dia e antes da cobrança: está no teste", () => {
    expect(emTesteGratis({ assinatura: "ATIVA", testeAte }, new Date("2026-11-15T23:00:00Z"))).toBe(true);
  });

  test("da meia-noite do dia da cobrança em diante, o teste acabou", () => {
    expect(emTesteGratis({ assinatura: "ATIVA", testeAte }, new Date("2026-11-16T03:00:00Z"))).toBe(false);
  });

  test("quem não ganhou o teste, ou cancelou, ou atrasou, não está nele", () => {
    const antes = new Date("2026-11-10T12:00:00Z");
    expect(emTesteGratis({ assinatura: "ATIVA", testeAte: null }, antes)).toBe(false);
    expect(emTesteGratis({ assinatura: "CANCELADA", testeAte }, antes)).toBe(false);
    expect(emTesteGratis({ assinatura: "AGUARDANDO_PAGAMENTO", testeAte }, antes)).toBe(false);
  });
});

describe("diasDeTesteRestantes", () => {
  const testeAte = fimDoPeriodoPago("2026-11-16");

  test("7 no dia do cadastro, 1 na véspera da cobrança", () => {
    expect(diasDeTesteRestantes(testeAte, new Date("2026-11-09T12:00:00Z"))).toBe(7);
    expect(diasDeTesteRestantes(testeAte, new Date("2026-11-15T12:00:00Z"))).toBe(1);
  });

  test("a noite de Brasília ainda conta como o mesmo dia", () => {
    // 02:00 UTC do dia 16 é 23:00 do dia 15 em Brasília: ainda falta 1.
    expect(diasDeTesteRestantes(testeAte, new Date("2026-11-16T02:00:00Z"))).toBe(1);
  });

  test("passado o teste, zero — nunca negativo", () => {
    expect(diasDeTesteRestantes(testeAte, new Date("2026-11-20T12:00:00Z"))).toBe(0);
  });
});

describe("as datas escritas", () => {
  const testeAte = fimDoPeriodoPago("2026-11-16");

  test("o dia da cobrança e o último dia grátis", () => {
    expect(escreverDia(testeAte)).toBe("16/11/2026");
    expect(escreverDia("2026-11-16", { curto: true })).toBe("16/11");
    expect(ultimoDiaGratis(testeAte)).toBe("15/11/2026");
    expect(ultimoDiaGratis(testeAte, { curto: true })).toBe("15/11");
  });

  test("as três datas do cadastro, para quem começa agora", () => {
    expect(datasDoTeste(new Date("2026-11-09T15:00:00Z"))).toEqual({
      hoje: "09/11",
      ultimoDia: "15/11",
      cobranca: "16/11",
    });
  });
});
