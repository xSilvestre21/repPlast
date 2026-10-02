import { describe, expect, it } from "vitest";

import {
  colunaDoDia,
  deveAvisar,
  diaDaColuna,
  eventoDeEntrega,
  eventoDeParcela,
  eventoDeSumido,
  ordenarDoDia,
  type EventoAgenda,
} from "./agenda";

describe("colunas de data", () => {
  it("a coluna date vira o dia certo, sem escorregar pelo fuso", () => {
    expect(diaDaColuna(new Date("2026-10-01T00:00:00.000Z"))).toBe("2026-10-01");
  });

  it("ida e volta", () => {
    expect(diaDaColuna(colunaDoDia("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("aviso no Painel", () => {
  const HOJE = "2026-10-15";
  const AGORA = new Date("2026-10-15T12:00:00Z").getTime();
  const c = (importancia: "NORMAL" | "IMPORTANTE" | "URGENTE", dia: string, concluido = false) => ({
    importancia,
    dia,
    concluido,
  });

  it("urgente avisa no dia e na véspera, mas não dois dias antes", () => {
    expect(deveAvisar(c("URGENTE", HOJE), HOJE, AGORA, null)).toBe(true);
    expect(deveAvisar(c("URGENTE", "2026-10-16"), HOJE, AGORA, null)).toBe(true);
    expect(deveAvisar(c("URGENTE", "2026-10-17"), HOJE, AGORA, null)).toBe(false);
  });

  it("importante e normal nunca abrem a janela — ficam na faixa Hoje e no calendário", () => {
    expect(deveAvisar(c("IMPORTANTE", HOJE), HOJE, AGORA, null)).toBe(false);
    expect(deveAvisar(c("IMPORTANTE", "2026-10-10"), HOJE, AGORA, null)).toBe(false);
    expect(deveAvisar(c("NORMAL", HOJE), HOJE, AGORA, null)).toBe(false);
  });

  it("o urgente que passou sem ser feito continua avisando", () => {
    expect(deveAvisar(c("URGENTE", "2026-10-10"), HOJE, AGORA, null)).toBe(true);
  });

  it("feito não avisa mais", () => {
    expect(deveAvisar(c("URGENTE", HOJE, true), HOJE, AGORA, null)).toBe(false);
  });

  it("lembrar depois cala até a hora marcada, e só até ela", () => {
    expect(deveAvisar(c("URGENTE", HOJE), HOJE, AGORA, AGORA + 1000)).toBe(false);
    expect(deveAvisar(c("URGENTE", HOJE), HOJE, AGORA, AGORA - 1000)).toBe(true);
  });
});

describe("eventos automáticos", () => {
  const HOJE = "2026-10-15";

  it("entrega passada sem registro de entrega é atrasada", () => {
    const e = eventoDeEntrega(
      {
        id: "p1",
        numero: 2287,
        cliente: "AKILAH",
        prazoEntrega: new Date("2026-10-10T00:00:00Z"),
        entregueEm: null,
      },
      HOJE,
    );

    expect(e.dia).toBe("2026-10-10");
    expect(e.situacao).toBe("atrasada");
    expect(e.href).toBe("/pedidos/p1");
  });

  it("entrega registrada não é atrasada, mesmo com prazo passado", () => {
    const e = eventoDeEntrega(
      {
        id: "p1",
        numero: 1,
        cliente: "X",
        prazoEntrega: new Date("2026-10-10T00:00:00Z"),
        entregueEm: new Date("2026-10-12T00:00:00Z"),
      },
      HOJE,
    );
    expect(e.situacao).toBeUndefined();
  });

  it("a parcela cai no dia do vencimento e leva à apuração daquele mês", () => {
    const e = eventoDeParcela({
      id: "pc1",
      numero: 1,
      total: 2,
      vencimento: new Date("2026-11-11T00:00:00Z"),
      pago: false,
      pedidoNumero: 2287,
      cliente: "CLIENTE TESTE",
    });

    expect(e.dia).toBe("2026-11-11");
    expect(e.href).toBe("/comissoes?mes=2026-11");
    expect(e.titulo).toBe("Parcela 1/2 · #2287");
  });

  it("cliente sumido aparece 60 dias depois da última compra", () => {
    const e = eventoDeSumido({ id: "c1", apelido: "ALBRAS", ultimaCompra: new Date(2026, 7, 1, 15) });
    expect(e.dia).toBe("2026-09-30");
  });
});

describe("ordem dentro do dia", () => {
  const ev = (dados: Partial<EventoAgenda> & { chave: string }): EventoAgenda => ({
    tipo: "compromisso",
    dia: "2026-10-15",
    titulo: dados.chave,
    ...dados,
  });

  it("urgente, atrasado e com hora antes; feito e pago por último", () => {
    const ordem = ordenarDoDia([
      ev({ chave: "pago", tipo: "parcela", situacao: "paga" }),
      ev({ chave: "normal-15h", hora: "15:00" }),
      ev({ chave: "urgente", importancia: "URGENTE" }),
      ev({ chave: "feito", importancia: "URGENTE", situacao: "concluido" }),
      ev({ chave: "atrasada", tipo: "entrega", situacao: "atrasada" }),
      ev({ chave: "normal-09h", hora: "09:00" }),
    ]).map((e) => e.chave);

    expect(ordem).toEqual(["atrasada", "urgente", "normal-09h", "normal-15h", "feito", "pago"]);
  });
});
