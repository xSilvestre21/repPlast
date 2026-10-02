/**
 * Testes da comissão e da meta pessoal.
 *
 * Os valores partem do pedido real 2253: base R$ 21.989,23 e 3% da QUALYPLAST.
 */

import { describe, expect, it } from "vitest";

import {
  contarPedidos,
  expandirParcelas,
  prepostoDoPedido,
  resumirComissao,
} from "./comissao-consulta";
import {
  comissaoDoPedido,
  competenciaDe,
  competenciaDoPedido,
  deslocarCompetencia,
  intervaloDaCompetencia,
  intervaloDaCompetenciaUtc,
  mesesDeMetaBatida,
  metaVigente,
  pontualidadeEntrega,
  progressoDaMeta,
  ratearComissao,
  saldoDoRepasse,
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

describe("a visão do administrador é o que fica com o escritório", () => {
  const pedidos = [
    // Do preposto, acertado a 3% em vez de 5%.
    {
      base: "10000",
      percentual: 5,
      percentualPreposto: 50,
      acerto: { base: "10000", percentual: 3 },
    },
    // Do preposto, ainda sem acerto.
    { base: "20000", percentual: 5, percentualPreposto: 50 },
    // Da casa, acertado cheio.
    { base: "4000", percentual: 5, acerto: { base: "4000", percentual: 5 } },
  ];

  it("as quatro caixas do escritório são o total menos a fatia do preposto", () => {
    const r = somarComissao(pedidos);

    // Total: previsto 1.700, recebido 500, a acertar 1.000, diferença −200.
    // Preposto: previsto 750, recebido 150, a acertar 500, diferença −100.
    expect(r.previstoDoEscritorio.toFixed(2)).toBe("950.00");
    expect(r.recebidoDoEscritorio.toFixed(2)).toBe("350.00");
    expect(r.aAcertarDoEscritorio.toFixed(2)).toBe("500.00");
    expect(r.diferencaDoEscritorio.toFixed(2)).toBe("-100.00");
  });

  it("escritório e preposto somam o total em cada caixa", () => {
    const r = somarComissao([
      { base: "1234.57", percentual: 3.75, percentualPreposto: 33.33 },
      {
        base: "987.65",
        percentual: 4,
        percentualPreposto: 66.666,
        acerto: { base: "900.01", percentual: 3.5 },
      },
    ]);

    expect(r.aAcertarDoPreposto.plus(r.aAcertarDoEscritorio).toString()).toBe(
      r.aAcertar.toString(),
    );
    expect(r.diferencaDoPreposto.plus(r.diferencaDoEscritorio).toString()).toBe(
      r.diferenca.toString(),
    );
  });

  it("sem preposto, a visão do escritório é o total", () => {
    const r = somarComissao([{ base: "4000", percentual: 5 }]);

    expect(r.previstoDoEscritorio.toFixed(2)).toBe(r.valor.toFixed(2));
    expect(r.aAcertarDoEscritorio.toFixed(2)).toBe(r.aAcertar.toFixed(2));
  });
});

describe("repasse ao preposto", () => {
  const devido = new Map([
    ["2026-07", "500"],
    ["2026-08", "300"],
    ["2026-09", "200"],
    ["2026-10", "400"],
  ]);

  it("sem nenhum repasse lançado, só o mês conta", () => {
    const s = saldoDoRepasse(devido, new Map(), "2026-09");

    expect(s.anterior.toFixed(2)).toBe("0.00");
    expect(s.devido.toFixed(2)).toBe("200.00");
    expect(s.aRepassar.toFixed(2)).toBe("200.00");
  });

  it("o saldo começa no primeiro repasse — o que veio antes foi acertado fora", () => {
    // Julho nunca teve repasse lançado e não vira dívida.
    const pago = new Map([["2026-08", "300"]]);
    const s = saldoDoRepasse(devido, pago, "2026-09");

    expect(s.anterior.toFixed(2)).toBe("0.00");
    expect(s.aRepassar.toFixed(2)).toBe("200.00");
  });

  it("pagamento parcial passa a diferença para o mês seguinte", () => {
    const pago = new Map([
      ["2026-08", "250"],
      ["2026-09", "200"],
    ]);

    const setembro = saldoDoRepasse(devido, pago, "2026-09");
    expect(setembro.anterior.toFixed(2)).toBe("50.00");
    expect(setembro.aRepassar.toFixed(2)).toBe("50.00");

    const outubro = saldoDoRepasse(devido, pago, "2026-10");
    expect(outubro.anterior.toFixed(2)).toBe("50.00");
    expect(outubro.aRepassar.toFixed(2)).toBe("450.00");
  });

  it("pagar a mais deixa crédito, que abate o mês seguinte", () => {
    const pago = new Map([["2026-08", "400"]]);
    const s = saldoDoRepasse(devido, pago, "2026-09");

    expect(s.anterior.toFixed(2)).toBe("-100.00");
    expect(s.aRepassar.toFixed(2)).toBe("100.00");
  });

  it("um mês antes do primeiro repasse não herda nada", () => {
    const pago = new Map([["2026-09", "200"]]);
    const s = saldoDoRepasse(devido, pago, "2026-08");

    expect(s.anterior.toFixed(2)).toBe("0.00");
    expect(s.aRepassar.toFixed(2)).toBe("300.00");
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
    motivoCancelamento: null,
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
    prazoPagamento: null,
    competencia: "2026-09",
    parcela: null,
    vendaDoPedido: "1000",
    parcelasDoPedido: [],
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

  it("fatia gravada sem preposto vinculado volta inteira para o escritório", () => {
    // O caso dos pedidos importados do SICOV: 50% de representante, ninguém vinculado.
    const r = resumirComissao([
      { ...base, comissaoPercentualPreposto: "50", representante: null },
      {
        ...base,
        comissaoPercentualPreposto: "50",
        representante: { id: "u2", nome: "Valquiria", papel: "ADMIN" },
      },
    ]);

    expect(r.previstoDoPreposto.toFixed(2)).toBe("0.00");
    expect(r.previstoDoEscritorio.toFixed(2)).toBe("100.00");
  });

  it("com preposto vinculado, a fatia gravada vale", () => {
    const r = resumirComissao([
      {
        ...base,
        comissaoPercentualPreposto: "50",
        representante: { id: "u1", nome: "Maria Augusta", papel: "REPRESENTANTE" },
      },
    ]);

    expect(r.previstoDoPreposto.toFixed(2)).toBe("25.00");
    expect(r.previstoDoEscritorio.toFixed(2)).toBe("25.00");
  });

  it("devolve null quando o pedido é do escritório", () => {
    expect(prepostoDoPedido({ ...base, representante: null })).toBeNull();
  });
});

describe("meta por mês", () => {
  // Setembro: 1.000. Dezembro: 5.000. Fevereiro: sem meta.
  const linhas = [
    { competencia: "2026-12", valor: "5000" },
    { competencia: "2026-09", valor: "1000" },
    { competencia: "2027-02", valor: null },
  ];

  it("vale do mês em que foi definida em diante, até a próxima", () => {
    expect(metaVigente(linhas, "2026-09")).toEqual({ valor: "1000", desde: "2026-09" });
    expect(metaVigente(linhas, "2026-11")).toEqual({ valor: "1000", desde: "2026-09" });
    expect(metaVigente(linhas, "2026-12")).toEqual({ valor: "5000", desde: "2026-12" });
    expect(metaVigente(linhas, "2027-01")).toEqual({ valor: "5000", desde: "2026-12" });
  });

  it("trocar a meta adiante não reescreve o passado", () => {
    // Dezembro subiu para 5.000; outubro continua medido contra 1.000.
    expect(metaVigente(linhas, "2026-10")?.valor).toBe("1000");
  });

  it("antes da primeira meta não há meta", () => {
    expect(metaVigente(linhas, "2026-08")).toBeNull();
    expect(metaVigente([], "2026-10")).toBeNull();
  });

  it("'sem meta' também vale em diante, interrompendo a herdada", () => {
    expect(metaVigente(linhas, "2027-03")).toEqual({ valor: null, desde: "2027-02" });
  });

  it("marca os meses batidos contra a meta de CADA mês", () => {
    const alcancado = new Map([
      ["2026-09", "1200"], // bateu 1.000
      ["2026-10", "800"], // não bateu 1.000
      ["2026-11", "1000"], // bateu no centavo
      ["2026-12", "1200"], // 1.200 batia a meta antiga, não a de 5.000
      ["2027-02", "9000"], // sem meta: não conta como batida
    ]);

    expect(mesesDeMetaBatida(linhas, alcancado, "2026-08", "2027-03")).toEqual([
      "2026-09",
      "2026-11",
    ]);
  });
});

describe("parcelas viram itens da comissão", () => {
  // Venda de R$ 9.765 a 5%, entregue em 27/07 — o #142 do SICOV.
  const pedido = {
    id: "p142",
    numero: 142,
    status: "ENVIADO",
    motivoCancelamento: null,
    criadoEm: new Date("2026-07-01T12:00:00Z"),
    enviadoEm: null,
    prazoEntrega: new Date("2026-07-27T00:00:00Z"),
    entregueEm: null,
    subtotalSemIpi: "9765",
    comissaoPercentual: "5",
    comissaoPercentualPreposto: null,
    representante: null,
    // Um acerto no pedido que o parcelado precisa ignorar.
    valorRecebido: "9765",
    comissaoPercentualRecebido: "5",
    cliente: { id: "c", apelido: "C" },
    fornecedor: { id: "f", nome: "F", comissaoPercentual: "5" },
    prazoPagamento: "28/35/42",
  };

  const parcela = (numero: number, vencimento: string, base: string, recebido?: string) => ({
    id: `parc-${numero}`,
    numero,
    vencimento: new Date(`${vencimento}T00:00:00Z`),
    base,
    valorRecebido: recebido ?? null,
    comissaoPercentualRecebido: recebido ? "5" : null,
  });

  it("sem parcela, é o pedido inteiro no mês da entrega", () => {
    const [item] = expandirParcelas(pedido, []);

    expect(item.competencia).toBe("2026-07");
    expect(item.parcela).toBeNull();
    expect(resumirComissao([item]).valor.toFixed(2)).toBe("488.25");
  });

  it("parcelado, cada parcela conta no mês do vencimento, com a fatia dela", () => {
    // Fora de ordem de propósito: o número manda, não a ordem que veio do banco.
    const itens = expandirParcelas(pedido, [
      parcela(3, "2026-09-07", "3255"),
      parcela(1, "2026-08-24", "3255"),
      parcela(2, "2026-08-31", "3255"),
    ]);

    expect(itens.map((i) => [i.competencia, i.parcela?.numero, i.parcela?.total])).toEqual([
      ["2026-08", 1, 3],
      ["2026-08", 2, 3],
      ["2026-09", 3, 3],
    ]);

    const agosto = itens.filter((i) => i.competencia === "2026-08");
    expect(resumirComissao(agosto).valor.toFixed(2)).toBe("325.50");
    expect(itens.every((i) => i.vendaDoPedido === "9765")).toBe(true);
  });

  it("o acerto é o de cada parcela, e o do pedido não conta", () => {
    const itens = expandirParcelas(pedido, [
      parcela(1, "2026-08-24", "3255", "3000"),
      parcela(2, "2026-08-31", "6510"),
    ]);

    const r = resumirComissao(itens);
    expect(r.acertados).toBe(1);
    expect(r.recebido.toFixed(2)).toBe("150.00");
  });

  it("duas parcelas no mesmo mês são um pedido só na contagem", () => {
    const itens = expandirParcelas(pedido, [
      parcela(1, "2026-10-10", "5000"),
      parcela(2, "2026-10-30", "4765"),
    ]);

    expect(itens).toHaveLength(2);
    expect(contarPedidos(itens)).toBe(1);
  });
});
