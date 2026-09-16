/**
 * Testes da comissão e da meta pessoal.
 *
 * Os valores partem do pedido real 2253: base R$ 21.989,23 e 3% da QUALYPLAST.
 */

import { describe, expect, it } from "vitest";

import { prepostoDoPedido } from "./comissao-consulta";
import {
  comissaoDoPedido,
  competenciaDe,
  competenciaDoPedido,
  deslocarCompetencia,
  intervaloDaCompetencia,
  intervaloDaCompetenciaUtc,
  pontualidadeEntrega,
  progressoDaMeta,
  ratearComissao,
  somarComissao,
} from "./comissao";

describe("comissão de um pedido", () => {
  it("aplica o percentual sobre a base do pedido real", () => {
    expect(comissaoDoPedido("21989.23", 3).toFixed(2)).toBe("659.68");
  });

  it("arredonda em centavos", () => {
    // 21.989,23 × 3% = 659,6769.
    expect(comissaoDoPedido("21989.23", 3).toString()).toBe("659.68");
  });

  it("aceita percentual fracionário", () => {
    expect(comissaoDoPedido(10000, "3.5").toFixed(2)).toBe("350.00");
  });

  it("percentual zero não gera comissão", () => {
    expect(comissaoDoPedido("21989.23", 0).toFixed(2)).toBe("0.00");
  });
});

describe("soma de vários pedidos", () => {
  it("cada pedido rende o próprio percentual", () => {
    const resumo = somarComissao([
      { base: "20000", percentual: 3 },
      { base: "10000", percentual: 5 },
    ]);

    expect(resumo.base.toFixed(2)).toBe("30000.00");
    // 600 + 500.
    expect(resumo.valor.toFixed(2)).toBe("1100.00");
  });

  it("o percentual médio reflete a mistura", () => {
    const resumo = somarComissao([
      { base: "20000", percentual: 3 },
      { base: "10000", percentual: 5 },
    ]);

    // 1.100 sobre 30.000 = 3,6667%.
    expect(resumo.percentualMedio.toFixed(4)).toBe("3.6667");
  });

  it("com percentual único o médio é o próprio percentual", () => {
    const resumo = somarComissao([
      { base: "10000", percentual: 3 },
      { base: "30000", percentual: 3 },
    ]);

    expect(resumo.percentualMedio.toFixed(2)).toBe("3.00");
  });

  it("mês sem pedido não quebra a divisão", () => {
    const resumo = somarComissao([]);

    expect(resumo.base.toFixed(2)).toBe("0.00");
    expect(resumo.valor.toFixed(2)).toBe("0.00");
    expect(resumo.percentualMedio.toFixed(2)).toBe("0.00");
  });
});

describe("meta pessoal", () => {
  it("mede o progresso rumo à meta", () => {
    const progresso = progressoDaMeta("8000", "2000");

    expect(progresso?.percentual).toBe(25);
    expect(progresso?.batida).toBe(false);
    expect(progresso?.falta.toFixed(2)).toBe("6000.00");
  });

  it("bate exatamente no valor da meta", () => {
    const progresso = progressoDaMeta("8000", "8000");

    expect(progresso?.batida).toBe(true);
    expect(progresso?.percentual).toBe(100);
    expect(progresso?.falta.toFixed(2)).toBe("0.00");
  });

  it("passar da meta não estoura a barra nem gera falta negativa", () => {
    const progresso = progressoDaMeta("8000", "12000");

    expect(progresso?.batida).toBe(true);
    expect(progresso?.percentual).toBe(100);
    expect(progresso?.falta.toFixed(2)).toBe("0.00");
  });

  it("sem meta definida não há progresso a mostrar", () => {
    expect(progressoDaMeta(null, "5000")).toBeNull();
    expect(progressoDaMeta(undefined, "5000")).toBeNull();
    expect(progressoDaMeta("", "5000")).toBeNull();
  });

  it("meta zero ou negativa é tratada como ausente", () => {
    expect(progressoDaMeta(0, "5000")).toBeNull();
    expect(progressoDaMeta(-100, "5000")).toBeNull();
  });
});

describe("competência", () => {
  it("formata como AAAA-MM", () => {
    expect(competenciaDe(new Date(2026, 8, 10))).toBe("2026-09");
    expect(competenciaDe(new Date(2026, 11, 31))).toBe("2026-12");
  });

  it("o intervalo cobre o mês e para no primeiro dia do seguinte", () => {
    const { de, ate } = intervaloDaCompetencia("2026-09");

    expect(de.getMonth()).toBe(8);
    expect(de.getDate()).toBe(1);
    expect(ate.getMonth()).toBe(9);
    expect(ate.getDate()).toBe(1);
  });

  it("anda meses virando o ano", () => {
    expect(deslocarCompetencia("2026-01", -1)).toBe("2025-12");
    expect(deslocarCompetencia("2026-12", 1)).toBe("2027-01");
    expect(deslocarCompetencia("2026-09", 3)).toBe("2026-12");
  });
});

describe("em que mês a comissão cai", () => {
  /*
   * A regra é a do sistema anterior: vale a data de ENTREGA, e só na falta dela
   * a de criação. Trocar isso por "data de envio" moveu R$ 22,8 mil entre meses
   * em 104 dos 187 pedidos importados, sem nada ter mudado no negócio — e
   * setembro/2026 passou a mostrar R$ 15.331 no lugar de R$ 38.110.
   */
  const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("o pedido 2253 cai em outubro, o mês da entrega, não em setembro", () => {
    // Criado em 03/09/2026, entrega marcada para 09/10/2026.
    expect(competenciaDoPedido(dia("2026-10-09"), new Date("2026-09-03T14:30:00Z"))).toBe(
      "2026-10",
    );
  });

  it("sem prazo marcado, cai no mês em que nasceu", () => {
    expect(competenciaDoPedido(null, new Date("2026-09-03T14:30:00Z"))).toBe("2026-09");
    expect(competenciaDoPedido(undefined, new Date("2026-11-20T09:00:00Z"))).toBe("2026-11");
  });

  it("entrega no dia 1º fica no próprio mês, não no anterior", () => {
    // `prazoEntrega` é coluna `date`: meia-noite UTC. Lida em fuso local do
    // Brasil isso seria 21h do último dia do mês anterior.
    expect(competenciaDoPedido(dia("2026-09-01"), new Date("2026-08-15T12:00:00Z"))).toBe(
      "2026-09",
    );
  });

  it("entrega no último dia do mês não escorrega para o seguinte", () => {
    expect(competenciaDoPedido(dia("2026-09-30"), new Date("2026-09-01T12:00:00Z"))).toBe(
      "2026-09",
    );
  });

  it("o intervalo em UTC começa e termina na virada do mês", () => {
    const { de, ate } = intervaloDaCompetenciaUtc("2026-09");

    expect(de.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(ate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("o intervalo em UTC contém a entrega do dia 1º e exclui a do dia 1º seguinte", () => {
    const { de, ate } = intervaloDaCompetenciaUtc("2026-09");

    expect(dia("2026-09-01") >= de && dia("2026-09-01") < ate).toBe(true);
    expect(dia("2026-10-01") < ate).toBe(false);
  });
});


describe("acerto da comissão", () => {
  /*
   * O acerto é sempre digitado. Estes testes guardam as duas formas de a
   * indústria pagar menos — base menor e percentual menor — e que as duas
   * chegam ao mesmo lugar sem o sistema decidir nada sozinho.
   */
  const previsto = { base: "10000", percentual: 5 };

  it("sem acerto, tudo fica no previsto", () => {
    const r = somarComissao([previsto]);

    expect(r.valor.toFixed(2)).toBe("500.00");
    expect(r.recebido.toFixed(2)).toBe("0.00");
    expect(r.aAcertar.toFixed(2)).toBe("500.00");
    expect(r.diferenca.toFixed(2)).toBe("0.00");
    expect(r.acertados).toBe(0);
  });

  it("percentual menor no acerto — o caso dos 3%", () => {
    const r = somarComissao([{ ...previsto, acerto: { base: "10000", percentual: 3 } }]);

    expect(r.recebido.toFixed(2)).toBe("300.00");
    expect(r.diferenca.toFixed(2)).toBe("-200.00");
    expect(r.aAcertar.toFixed(2)).toBe("0.00");
  });

  it("base menor no acerto", () => {
    const r = somarComissao([{ ...previsto, acerto: { base: "9000", percentual: 5 } }]);

    expect(r.recebido.toFixed(2)).toBe("450.00");
    expect(r.diferenca.toFixed(2)).toBe("-50.00");
  });

  it("acerto acima do previsto dá diferença positiva", () => {
    const r = somarComissao([{ ...previsto, acerto: { base: "11000", percentual: 5 } }]);

    expect(r.diferenca.toFixed(2)).toBe("50.00");
  });

  it("a diferença só olha os pedidos já acertados", () => {
    const r = somarComissao([
      { ...previsto, acerto: { base: "10000", percentual: 3 } },
      { base: "20000", percentual: 5 },
    ]);

    expect(r.valor.toFixed(2)).toBe("1500.00");
    expect(r.recebido.toFixed(2)).toBe("300.00");
    // Os 1.000 do pedido sem acerto não entram como prejuízo.
    expect(r.diferenca.toFixed(2)).toBe("-200.00");
    expect(r.aAcertar.toFixed(2)).toBe("1000.00");
    expect(r.acertados).toBe(1);
  });
});

describe("pontualidade da entrega", () => {
  const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("no dia prometido", () => {
    expect(pontualidadeEntrega(dia("2026-09-28"), dia("2026-09-28"))).toEqual({
      situacao: "no_prazo",
      dias: 0,
    });
  });

  it("atraso conta dias corridos", () => {
    expect(pontualidadeEntrega(dia("2026-09-28"), dia("2026-10-15"))).toEqual({
      situacao: "atrasado",
      dias: 17,
    });
  });

  it("adiantamento volta sempre positivo", () => {
    expect(pontualidadeEntrega(dia("2026-09-28"), dia("2026-09-20"))).toEqual({
      situacao: "adiantado",
      dias: 8,
    });
  });

  it("sem uma das datas não há o que comparar", () => {
    expect(pontualidadeEntrega(null, dia("2026-09-28"))).toBeNull();
    expect(pontualidadeEntrega(dia("2026-09-28"), null)).toBeNull();
    expect(pontualidadeEntrega(null, null)).toBeNull();
  });

  it("atravessa o horário de verão sem escorregar um dia", () => {
    // Outubro tem virada de fuso em parte do mundo; a conta é em UTC.
    expect(pontualidadeEntrega(dia("2026-10-15"), dia("2026-10-16"))?.dias).toBe(1);
    expect(pontualidadeEntrega(dia("2026-02-14"), dia("2026-02-15"))?.dias).toBe(1);
  });
});


describe("rateio entre escritório e preposto", () => {
  /*
   * Os números são do backup do SICOV, pedido 2020: base 2.413,95 sem IPI,
   * comissão de 5% dando pool 120,70. Os percentuais 0 / 50 / 60 são os
   * `defaultCommissionPercentage` reais dos prepostos daquele escritório.
   */
  const BASE = "2413.95";

  it("reproduz o pool do pedido 2020", () => {
    expect(ratearComissao(BASE, 5, 0).total.toFixed(2)).toBe("120.70");
  });

  it("sem preposto, tudo fica no escritório", () => {
    const r = ratearComissao(BASE, 5, 0);

    expect(r.doPreposto.toFixed(2)).toBe("0.00");
    expect(r.doEscritorio.toFixed(2)).toBe("120.70");
  });

  it("percentual nulo é o mesmo que zero — pedido do próprio escritório", () => {
    expect(ratearComissao(BASE, 5, null).doEscritorio.toFixed(2)).toBe("120.70");
    expect(ratearComissao(BASE, 5, undefined).doEscritorio.toFixed(2)).toBe("120.70");
  });

  it("divide meio a meio a 50%", () => {
    const r = ratearComissao(BASE, 5, 50);

    expect(r.doPreposto.toFixed(2)).toBe("60.35");
    expect(r.doEscritorio.toFixed(2)).toBe("60.35");
  });

  it("a 60% o preposto leva mais que a casa", () => {
    const r = ratearComissao(BASE, 5, 60);

    expect(r.doPreposto.toFixed(2)).toBe("72.42");
    expect(r.doEscritorio.toFixed(2)).toBe("48.28");
  });

  it("a fatia é da COMISSÃO, não da venda", () => {
    // 50% da venda seriam 1.206,98. O que o preposto leva é 50% de 120,70.
    expect(ratearComissao(BASE, 5, 50).doPreposto.toFixed(2)).toBe("60.35");
  });

  it("as duas partes sempre somam o total, sem sobrar centavo", () => {
    // 33,33% de um total ímpar é onde dois arredondamentos independentes
    // deixariam a soma escapar.
    for (const pct of [1, 7, 33.33, 49.99, 66.666, 99.9]) {
      const r = ratearComissao("1234.57", 3.75, pct);
      expect(r.doPreposto.plus(r.doEscritorio).toString()).toBe(r.total.toString());
    }
  });

  it("quando a indústria paga menos, os dois perdem na proporção", () => {
    const combinado = ratearComissao(BASE, 5, 50);
    const reduzido = ratearComissao(BASE, 3, 50);

    expect(reduzido.total.toFixed(2)).toBe("72.42");
    expect(reduzido.doPreposto.toFixed(2)).toBe("36.21");
    expect(reduzido.doEscritorio.toFixed(2)).toBe("36.21");
    expect(reduzido.doPreposto.lessThan(combinado.doPreposto)).toBe(true);
  });
});

describe("rateio somado no mês", () => {
  it("cada pedido rende a fatia do SEU preposto", () => {
    const r = somarComissao([
      { base: "10000", percentual: 5, percentualPreposto: 50 },
      { base: "10000", percentual: 5, percentualPreposto: 60 },
      { base: "10000", percentual: 5 },
    ]);

    expect(r.valor.toFixed(2)).toBe("1500.00");
    // 250 + 300 + 0
    expect(r.previstoDoPreposto.toFixed(2)).toBe("550.00");
    expect(r.previstoDoEscritorio.toFixed(2)).toBe("950.00");
  });

  it("o acerto passa pelo mesmo rateio", () => {
    const r = somarComissao([
      {
        base: "10000",
        percentual: 5,
        percentualPreposto: 50,
        acerto: { base: "10000", percentual: 3 },
      },
    ]);

    expect(r.recebido.toFixed(2)).toBe("300.00");
    expect(r.recebidoDoPreposto.toFixed(2)).toBe("150.00");
    expect(r.recebidoDoEscritorio.toFixed(2)).toBe("150.00");
    // O previsto continua sendo o que deveria ter entrado.
    expect(r.previstoDoPreposto.toFixed(2)).toBe("250.00");
  });

  it("pedido sem acerto não entra no recebido de ninguém", () => {
    const r = somarComissao([{ base: "10000", percentual: 5, percentualPreposto: 50 }]);

    expect(r.recebidoDoPreposto.toFixed(2)).toBe("0.00");
    expect(r.recebidoDoEscritorio.toFixed(2)).toBe("0.00");
  });
});

describe("a visão do preposto tem as quatro caixas na fatia dele", () => {
  const pedidos = [
    {
      base: "10000",
      percentual: 5,
      percentualPreposto: 50,
      acerto: { base: "10000", percentual: 3 },
    },
    { base: "20000", percentual: 5, percentualPreposto: 50 },
  ];

  it("a acertar e diferença acompanham o rateio", () => {
    const r = somarComissao(pedidos);

    // Total: previsto 1.500, recebido 300, a acertar 1.000, diferença −200.
    expect(r.aAcertar.toFixed(2)).toBe("1000.00");
    expect(r.diferenca.toFixed(2)).toBe("-200.00");

    // Fatia do preposto: metade de cada um.
    expect(r.previstoDoPreposto.toFixed(2)).toBe("750.00");
    expect(r.recebidoDoPreposto.toFixed(2)).toBe("150.00");
    expect(r.aAcertarDoPreposto.toFixed(2)).toBe("500.00");
    expect(r.diferencaDoPreposto.toFixed(2)).toBe("-100.00");
  });
});

describe("o dono do escritório não é preposto de si mesmo", () => {
  /*
   * Isto foi um bug de verdade: a importação carimbou os 193 pedidos da dona
   * com o id DELA em `representanteId`, e a tela passou a mostrar o nome dela
   * onde deveria estar o de quem vende por ela — além de uma linha em "por
   * preposto" dizendo que ela devia a si mesma.
   *
   * Nada no banco impede esse carimbo, então a regra vive aqui.
   */
  const base = {
    id: "p1",
    numero: 1,
    status: "ENVIADO",
    criadoEm: new Date("2026-09-03T12:00:00Z"),
    enviadoEm: null,
    prazoEntrega: null,
    entregueEm: null,
    subtotalSemIpi: "1000",
    comissaoPercentual: "5",
    comissaoPercentualPreposto: null,
    valorRecebido: null,
    comissaoPercentualRecebido: null,
    cliente: { id: "cli-x", apelido: "X" },
    fornecedor: { id: "f1", nome: "F", comissaoPercentual: "5" },
  };

  it("devolve o preposto quando o pedido é de um", () => {
    const p = prepostoDoPedido({
      ...base,
      representante: { id: "u1", nome: "Maria Augusta", papel: "REPRESENTANTE" },
    });

    expect(p?.nome).toBe("Maria Augusta");
  });

  it("devolve null quando quem consta é um administrador", () => {
    const p = prepostoDoPedido({
      ...base,
      representante: { id: "u2", nome: "Valquiria", papel: "ADMIN" },
    });

    expect(p).toBeNull();
  });

  it("devolve null quando o pedido é do escritório", () => {
    expect(prepostoDoPedido({ ...base, representante: null })).toBeNull();
  });
});
