import { describe, expect, it } from "vitest";

import {
  dataCompleta,
  dataCurta,
  dataDigitada,
  dataValida,
  lerData,
  mascararData,
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

  it("recusa a data que não existe — o Date a empurraria para o mês seguinte", () => {
    expect(dataValida("2026-02-31")).toBe(false);
    expect(dataValida("2026-02-29")).toBe(false);
    expect(dataValida("2028-02-29")).toBe(true);
    expect(dataValida("2026-13-01")).toBe(false);
  });
});

describe("data digitada", () => {
  const HOJE = "2026-11-17";

  describe("mascararData", () => {
    it("põe as barras sozinha enquanto se digita", () => {
      const passos = ["1", "15/", "15/1", "15/10/", "15/10/2", "15/10/20", "15/10/202", "15/10/2026"];
      let texto = "";
      for (const [i, digito] of [..."15102026"].entries()) {
        texto = mascararData(texto + digito);
        expect(texto, `depois de ${i + 1} dígitos`).toBe(passos[i]);
      }
    });

    it("nunca passa de dd/mm/aaaa", () => {
      expect(mascararData("1510202699")).toBe("15/10/2026");
    });

    it("completa com zero onde só cabe uma leitura", () => {
      expect(mascararData("5")).toBe("05/");
      expect(mascararData("35")).toBe("03/05/");
      expect(mascararData("153")).toBe("15/03/");
      expect(mascararData("1532026")).toBe("15/03/2026");
      expect(mascararData("31")).toBe("31/");
      expect(mascararData("1513")).toBe("15/13/");
    });

    it("a barra que a pessoa escreveu fecha o dia ou o mês de um dígito", () => {
      expect(mascararData("1/10/2026")).toBe("01/10/2026");
      expect(mascararData("5/3/26")).toBe("05/03/26");
      expect(mascararData("15.1")).toBe("15/1");
      expect(mascararData("15-3-")).toBe("15/03/");
    });

    it("colar no formato de planilha também serve", () => {
      expect(mascararData("2026-10-15")).toBe("15/10/2026");
    });

    it("pontuar de novo o que já está pontuado não muda nada", () => {
      for (const texto of ["15/", "15/1", "05/03/", "15/10/2026", "03/05/26"]) {
        expect(mascararData(texto), texto).toBe(texto);
      }
    });

    it("sem número, fica vazio", () => {
      expect(mascararData("")).toBe("");
      expect(mascararData("abc")).toBe("");
    });
  });

  describe("lerData", () => {
    it("aceita a data inteira, com ou sem barras", () => {
      for (const texto of ["15102026", "15/10/2026", " 15/10/2026 ", "15.10.2026"]) {
        expect(lerData(texto, HOJE), texto).toBe("2026-10-15");
      }
    });

    it("ano de dois dígitos é deste século", () => {
      expect(lerData("151027", HOJE)).toBe("2027-10-15");
      expect(lerData("5/3/26", HOJE)).toBe("2026-03-05");
    });

    it("sem o ano, é o ano de hoje", () => {
      expect(lerData("1510", HOJE)).toBe("2026-10-15");
      expect(lerData("3112", HOJE)).toBe("2026-12-31");
    });

    it("recusa a data que não existe", () => {
      for (const texto of ["31022026", "29022026", "15132026", "00102026", "15", "1510202", "15100026", "15101999", ""]) {
        expect(lerData(texto, HOJE), texto).toBeNull();
      }
    });

    it("29 de fevereiro vale no ano bissexto", () => {
      expect(lerData("29022028", HOJE)).toBe("2028-02-29");
    });
  });

  describe("dataCompleta", () => {
    it("vale só com o ano de quatro dígitos", () => {
      expect(dataCompleta("15/10/2026")).toBe("2026-10-15");
      expect(dataCompleta("15/10/")).toBeNull();
      expect(dataCompleta("15/10/20")).toBeNull();
      expect(dataCompleta("31/02/2026")).toBeNull();
    });
  });

  it("dataDigitada é o caminho de volta", () => {
    expect(dataDigitada("2026-10-15")).toBe("15/10/2026");
    expect(dataDigitada("")).toBe("");
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
