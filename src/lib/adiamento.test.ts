import { describe, expect, it } from "vitest";

import {
  competenciaDoItem,
  mesSugerido,
  mesesParaAdiar,
  nomeCurtoDaCompetencia,
  nomeDaCompetencia,
  problemaNoAdiamento,
} from "./adiamento";

describe("competenciaDoItem", () => {
  it("sem adiamento, é o mês dele", () => {
    expect(competenciaDoItem("2026-08", null)).toBe("2026-08");
  });

  it("adiado, conta no mês em que a indústria paga", () => {
    expect(competenciaDoItem("2026-08", "2026-11")).toBe("2026-11");
  });
});

describe("problemaNoAdiamento", () => {
  it("aceita um mês depois do da comissão, inclusive em outro ano", () => {
    expect(problemaNoAdiamento("2026-08", "2026-09")).toBeNull();
    expect(problemaNoAdiamento("2026-12", "2027-01")).toBeNull();
  });

  it("recusa o próprio mês e os anteriores, dizendo qual escolher", () => {
    expect(problemaNoAdiamento("2026-08", "2026-08")).toContain("depois de agosto de 2026");
    expect(problemaNoAdiamento("2026-08", "2026-07")).toContain("setembro de 2026");
  });

  it("recusa o que não é mês", () => {
    expect(problemaNoAdiamento("2026-08", "")).toContain("Escolha no calendário");
    expect(problemaNoAdiamento("2026-08", "2026-13")).toContain("Escolha no calendário");
  });
});

describe("mesesParaAdiar", () => {
  it("vai do mês seguinte ao da comissão até um ano depois de hoje", () => {
    const meses = mesesParaAdiar("2026-08", "2026-11");
    expect(meses[0]).toBe("2026-09");
    expect(meses.at(-1)).toBe("2027-11");
    expect(meses).toContain("2026-11");
  });

  it("no pedido que ainda vai chegar ao mês dele, conta a partir dele", () => {
    const meses = mesesParaAdiar("2027-02", "2026-11");
    expect(meses[0]).toBe("2027-03");
    expect(meses.at(-1)).toBe("2028-02");
  });
});

describe("mesSugerido", () => {
  it("abre no mês de hoje quando a comissão é de um mês passado", () => {
    expect(mesSugerido("2026-08", "2026-11", null)).toBe("2026-11");
  });

  it("abre no mês seguinte quando a comissão é deste mês ou de um futuro", () => {
    expect(mesSugerido("2026-11", "2026-11", null)).toBe("2026-12");
    expect(mesSugerido("2027-02", "2026-11", null)).toBe("2027-03");
  });

  it("reabre no que já está gravado", () => {
    expect(mesSugerido("2026-08", "2026-11", "2026-10")).toBe("2026-10");
  });
});

describe("nomes", () => {
  it("o mês por extenso, em minúsculas", () => {
    expect(nomeDaCompetencia("2026-11")).toBe("novembro de 2026");
  });

  it("o selo só leva o ano quando ele muda", () => {
    expect(nomeCurtoDaCompetencia("2026-11", "2026-08")).toBe("novembro");
    expect(nomeCurtoDaCompetencia("2027-01", "2026-12")).toBe("janeiro de 2027");
  });
});
