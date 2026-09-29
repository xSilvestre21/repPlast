import { describe, expect, it } from "vitest";

import {
  dataCurta,
  dataValida,
  diasUteisEntre,
  ehDiaUtil,
  nomeDoFeriado,
  somarDiasUteis,
  distanciaDeHoje,
  hojeIso,
  nomeDoMes,
  semanasDoMes,
  somarDias,
  somarMeses,
} from "./calendario";

describe("contas de data", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-09-29", 15)).toBe("2026-10-14");
    expect(somarDias("2026-12-25", 10)).toBe("2027-01-04");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("soma meses sem pular para o mês seguinte no dia 31", () => {
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2026-10-15", -1)).toBe("2026-09-15");
  });

  it("usa o dia do relógio local, não o de UTC", () => {
    // 22h de 29/09 em São Paulo já é 30/09 em UTC.
    expect(hojeIso(new Date(2026, 8, 29, 22, 0))).toBe("2026-09-29");
  });

  it("recusa texto que não é data", () => {
    expect(dataValida("2026-10-09")).toBe(true);
    expect(dataValida("")).toBe(false);
    expect(dataValida("09/10/2026")).toBe(false);
  });
});

describe("grade do mês", () => {
  it("começa no domingo e tem sempre seis semanas", () => {
    const semanas = semanasDoMes("2026-10-01");
    expect(semanas).toHaveLength(6);
    expect(semanas[0][0]).toBe("2026-09-27"); // 01/10/2026 é quinta
    expect(semanas[0][4]).toBe("2026-10-01");
    expect(semanas.flat()).toContain("2026-10-31");
  });
});

describe("textos", () => {
  it("escreve como gente", () => {
    expect(nomeDoMes("2026-10-09")).toBe("Outubro de 2026");
    expect(dataCurta("2026-10-09")).toMatch(/^Sex.*09 de out.* de 2026$/);
    // No mesmo ano, sem o ano; em outro, com.
    expect(dataCurta("2026-10-09", "2026-09-29")).toMatch(/^Sex.*09 de out\.?$/);
    expect(dataCurta("2027-01-08", "2026-09-29")).toMatch(/de 2027$/);
    expect(distanciaDeHoje("2026-10-09", "2026-09-29")).toBe("em 10 dias");
    expect(distanciaDeHoje("2026-09-30", "2026-09-29")).toBe("amanhã");
    expect(distanciaDeHoje("2026-09-26", "2026-09-29")).toBe("há 3 dias");
  });
});

describe("feriados e dias úteis", () => {
  it("acha a Páscoa e os feriados que andam com ela", () => {
    // Páscoa de 2026: 5 de abril.
    expect(nomeDoFeriado("2026-04-03")).toBe("Sexta-feira Santa");
    expect(nomeDoFeriado("2026-02-16")).toBe("Carnaval");
    expect(nomeDoFeriado("2026-02-17")).toBe("Carnaval");
    expect(nomeDoFeriado("2026-06-04")).toBe("Corpus Christi");
    // Páscoa de 2027: 28 de março.
    expect(nomeDoFeriado("2027-03-26")).toBe("Sexta-feira Santa");
  });

  it("conhece os fixos, inclusive a Consciência Negra", () => {
    expect(nomeDoFeriado("2026-11-20")).toBe("Consciência Negra");
    expect(nomeDoFeriado("2026-10-12")).toBe("Nossa Senhora Aparecida");
    expect(nomeDoFeriado("2026-10-13")).toBeNull();
  });

  it("dia útil é de semana e não é feriado", () => {
    expect(ehDiaUtil("2026-10-09")).toBe(true); // sexta comum
    expect(ehDiaUtil("2026-10-10")).toBe(false); // sábado
    expect(ehDiaUtil("2026-10-12")).toBe(false); // segunda, Aparecida
  });

  it("soma dias úteis pulando fim de semana e feriado, sem contar o dia de partida", () => {
    // Terça 29/09: +5 úteis = qua 30, qui 01, sex 02, seg 05, ter 06.
    expect(somarDiasUteis("2026-09-29", 5)).toBe("2026-10-06");
    // Sexta 09/10: +1 útil pula sábado, domingo e a segunda de Aparecida.
    expect(somarDiasUteis("2026-10-09", 1)).toBe("2026-10-13");
    expect(diasUteisEntre("2026-10-09", "2026-10-13")).toBe(1);
  });
});
