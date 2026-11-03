import { describe, expect, it } from "vitest";

import { assinaturaLiberada, fimDoPeriodoPago, ultimoDiaDeAcesso } from "./acesso-assinatura";

const agora = new Date("2026-11-03T15:00:00Z");
const daqui = (dias: number) => new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);

describe("assinaturaLiberada", () => {
  it("ATIVA usa, com ou sem data", () => {
    expect(assinaturaLiberada({ assinatura: "ATIVA", acessoAte: null }, agora)).toBe(true);
    expect(assinaturaLiberada({ assinatura: "ATIVA", acessoAte: daqui(-40) }, agora)).toBe(true);
  });

  it("CANCELADA usa até o fim do mês pago, e não depois", () => {
    expect(assinaturaLiberada({ assinatura: "CANCELADA", acessoAte: daqui(10) }, agora)).toBe(true);
    expect(assinaturaLiberada({ assinatura: "CANCELADA", acessoAte: daqui(-1) }, agora)).toBe(false);
    expect(assinaturaLiberada({ assinatura: "CANCELADA", acessoAte: agora }, agora)).toBe(false);
  });

  it("CANCELADA sem data (pelo painel do Asaas, ou em atraso) corta na hora", () => {
    expect(assinaturaLiberada({ assinatura: "CANCELADA", acessoAte: null }, agora)).toBe(false);
  });

  it("atraso e pagamento pendente não usam — nem com uma data antiga esquecida", () => {
    expect(assinaturaLiberada({ assinatura: "ATRASADA", acessoAte: daqui(10) }, agora)).toBe(false);
    expect(assinaturaLiberada({ assinatura: "AGUARDANDO_PAGAMENTO", acessoAte: daqui(10) }, agora)).toBe(false);
  });
});

describe("fimDoPeriodoPago e ultimoDiaDeAcesso", () => {
  it("vencimento em 03/12: entra até 02/12 inteiro, corta à meia-noite de Brasília", () => {
    const fim = fimDoPeriodoPago("2026-12-03");
    expect(fim.toISOString()).toBe("2026-12-03T03:00:00.000Z");
    expect(ultimoDiaDeAcesso(fim)).toBe("02/12/2026");

    // 23h59 do dia 2 em Brasília ainda entra; meia-noite do dia 3, não.
    const quaseMeiaNoite = new Date("2026-12-03T02:59:00Z");
    expect(assinaturaLiberada({ assinatura: "CANCELADA", acessoAte: fim }, quaseMeiaNoite)).toBe(true);
    expect(assinaturaLiberada({ assinatura: "CANCELADA", acessoAte: fim }, fim)).toBe(false);
  });

  it("recusa a data fora do formato do Asaas", () => {
    expect(() => fimDoPeriodoPago("03/12/2026")).toThrow(/AAAA-MM-DD/);
  });
});
