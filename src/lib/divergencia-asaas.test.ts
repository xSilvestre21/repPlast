import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { concluir, type EscritorioConferido, type Vista } from "./divergencia-asaas";

const AGORA = new Date("2026-11-17T12:00:00Z");
const DAQUI_A_5_DIAS = new Date("2026-11-22T03:00:00Z");
const ONTEM = new Date("2026-11-16T03:00:00Z");

const ESCRITORIO: EscritorioConferido = {
  assinatura: "ATIVA",
  acessoAte: null,
  testeAte: null,
  devido: new Decimal(189),
};

function gravada(...status: string[]): Vista["gravada"] {
  return { ativa: true, valor: new Decimal(189), cobrancas: status.map((s) => ({ status: s })) };
}

describe("concluir", () => {
  it("em dia aqui e lá: nada", () => {
    expect(concluir(ESCRITORIO, { gravada: gravada("CONFIRMED", "PENDING") }, AGORA)).toEqual({
      correcao: null,
      alertas: [],
    });
  });

  describe("libera quem pagou", () => {
    it.each(["AGUARDANDO_PAGAMENTO", "ATRASADA"] as const)("%s com cobrança paga e nenhuma vencida", (situacao) => {
      const { correcao } = concluir(
        { ...ESCRITORIO, assinatura: situacao },
        { gravada: gravada("RECEIVED", "PENDING") },
        AGORA,
      );
      expect(correcao).toMatchObject({ situacao: "ATIVA", ligar: null, bloqueia: false });
    });

    it("o teste grátis libera sem nada pago — o SUBSCRIPTION_CREATED que não chegou", () => {
      const { correcao } = concluir(
        { ...ESCRITORIO, assinatura: "AGUARDANDO_PAGAMENTO", testeAte: DAQUI_A_5_DIAS },
        { gravada: gravada("PENDING") },
        AGORA,
      );
      expect(correcao).toMatchObject({ situacao: "ATIVA", bloqueia: false });
    });

    it("sem nada pago nem vencido, fora do teste: sem opinião (a cobrança está sendo processada)", () => {
      expect(
        concluir({ ...ESCRITORIO, assinatura: "AGUARDANDO_PAGAMENTO" }, { gravada: gravada("PENDING") }, AGORA)
          .correcao,
      ).toBeNull();
      expect(
        concluir(
          { ...ESCRITORIO, assinatura: "AGUARDANDO_PAGAMENTO" },
          { gravada: gravada("AWAITING_RISK_ANALYSIS") },
          AGORA,
        ).correcao,
      ).toBeNull();
    });
  });

  describe("bloqueia quem tem fatura vencida", () => {
    it("ATIVA com cobrança vencida vira ATRASADA, e é bloqueio", () => {
      const { correcao } = concluir(ESCRITORIO, { gravada: gravada("CONFIRMED", "OVERDUE") }, AGORA);
      expect(correcao).toMatchObject({ situacao: "ATRASADA", bloqueia: true });
    });

    it("aguardando com cobrança vencida também vira ATRASADA — já estava bloqueado, e a tela passa a mostrar a fatura", () => {
      const { correcao } = concluir(
        { ...ESCRITORIO, assinatura: "AGUARDANDO_PAGAMENTO" },
        { gravada: gravada("OVERDUE") },
        AGORA,
      );
      expect(correcao).toMatchObject({ situacao: "ATRASADA", bloqueia: false });
    });
  });

  describe("assinatura encerrada no Asaas", () => {
    it("ATIVA vira CANCELADA, guardando o prazo que o cancelamento pela tela gravou", () => {
      const { correcao } = concluir(
        { ...ESCRITORIO, acessoAte: DAQUI_A_5_DIAS },
        { gravada: { ativa: false, valor: new Decimal(189), cobrancas: [] } },
        AGORA,
      );
      // Com o prazo ainda correndo, continua entrando: não é bloqueio.
      expect(correcao).toMatchObject({ situacao: "CANCELADA", bloqueia: false });
    });

    it("sem prazo, CANCELADA bloqueia — e o Asaas que não conhece mais a assinatura (404) conta igual", () => {
      const { correcao } = concluir(ESCRITORIO, { gravada: null }, AGORA);
      expect(correcao).toMatchObject({ situacao: "CANCELADA", bloqueia: true });
    });

    it("aguardando pagamento fica como está: pode ser um checkout novo em andamento", () => {
      expect(concluir({ ...ESCRITORIO, assinatura: "AGUARDANDO_PAGAMENTO" }, { gravada: null }, AGORA).correcao).toBeNull();
    });

    it("já cancelado: nada", () => {
      expect(
        concluir({ ...ESCRITORIO, assinatura: "CANCELADA", acessoAte: ONTEM }, { gravada: null }, AGORA),
      ).toEqual({ correcao: null, alertas: [] });
    });
  });

  describe("assinatura nova do cliente, que o aviso não ligou", () => {
    const nova = (deOutro = false): Vista["nova"] => ({
      id: "sub_nova",
      valor: new Decimal(189),
      cobrancas: [{ status: "CONFIRMED" }],
      deOutro,
    });

    it("liga e libera quem cancelou e assinou de novo", () => {
      const { correcao } = concluir(
        { ...ESCRITORIO, assinatura: "CANCELADA", acessoAte: ONTEM },
        { gravada: null, nova: nova() },
        AGORA,
      );
      expect(correcao).toMatchObject({ situacao: "ATIVA", ligar: "sub_nova", bloqueia: false });
      expect(correcao?.motivo).toMatch(/sub_nova/);
    });

    it("de outro escritório: não liga, só alerta", () => {
      const conclusao = concluir(
        { ...ESCRITORIO, assinatura: "CANCELADA", acessoAte: ONTEM },
        { gravada: null, nova: nova(true) },
        AGORA,
      );
      expect(conclusao.correcao).toBeNull();
      expect(conclusao.alertas).toEqual([expect.stringMatching(/sub_nova.*outro escritório/)]);
    });
  });

  describe("só alerta", () => {
    it("cancelado aqui com a assinatura gravada ainda cobrando", () => {
      const conclusao = concluir(
        { ...ESCRITORIO, assinatura: "CANCELADA", acessoAte: DAQUI_A_5_DIAS },
        { gravada: gravada("CONFIRMED") },
        AGORA,
      );
      expect(conclusao.correcao).toBeNull();
      expect(conclusao.alertas).toEqual([expect.stringMatching(/^cancelado no sistema.*vai continuar cobrando/)]);
    });

    it("liberado sem assinatura nenhuma no Asaas", () => {
      expect(concluir(ESCRITORIO, {}, AGORA)).toEqual({
        correcao: null,
        alertas: [expect.stringMatching(/^liberado sem nenhuma assinatura.*"sem cobrança"/)],
      });
    });

    it("o Asaas cobrando menos que o devido — e o valor nunca é corrigido", () => {
      const conclusao = concluir(
        { ...ESCRITORIO, devido: new Decimal(238) },
        { gravada: gravada("CONFIRMED") },
        AGORA,
      );
      expect(conclusao.correcao).toBeNull();
      expect(conclusao.alertas).toEqual([expect.stringMatching(/R\$\s189,00.*R\$\s238,00.*aumento não chegou/)]);
    });

    it("cobrando mais: é a redução esperando a fatura em aberto — salvo no teste grátis", () => {
      const reduziu = { ...ESCRITORIO, devido: new Decimal(79) };
      expect(concluir(reduziu, { gravada: gravada("CONFIRMED") }, AGORA).alertas).toEqual([]);
      expect(
        concluir({ ...reduziu, testeAte: DAQUI_A_5_DIAS }, { gravada: gravada("PENDING") }, AGORA).alertas,
      ).toEqual([expect.stringMatching(/teste grátis.*redução não chegou/)]);
    });
  });
});
