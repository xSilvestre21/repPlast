/**
 * Comissão.
 *
 * Regras confirmadas com o usuário:
 *   - conta a partir do momento em que o pedido é marcado como ENVIADO;
 *   - a base é só o valor dos produtos — sem IPI e sem frete;
 *   - o percentual é o da indústria, ajustável no pedido enquanto ele estiver
 *     aberto, e CONGELADO no pedido a partir daí.
 *
 * Houve uma versão com faixas por volume mensal, removida depois que o usuário
 * verificou que nenhuma indústria que ele representa trabalha assim. Com a
 * faixa fora, a comissão de um pedido não depende do que veio antes no mês —
 * o que torna a apuração derivável dos pedidos a qualquer momento, sem tabela
 * intermediária e sempre historicamente correta.
 *
 * A meta mensal que existe hoje é OUTRA coisa: é pessoal, do representante,
 * e não altera cálculo nenhum — serve para ele acompanhar o próprio objetivo.
 */

import Decimal from "decimal.js";

/** Comissão de um pedido: base × percentual, arredondada em centavos. */
export function comissaoDoPedido(base: Decimal.Value, percentual: Decimal.Value): Decimal {
  return new Decimal(base).times(percentual).dividedBy(100).toDecimalPlaces(2);
}

/**
 * O acerto de um pedido: o que a indústria pagou de fato.
 *
 * Os dois valores são digitados por quem recebeu, nunca deduzidos. Pagar menos
 * e pagar o cheio com percentual menor são acordos diferentes que dão no mesmo
 * dinheiro, e só quem negociou sabe qual foi.
 */
export interface AcertoComissao {
  base: Decimal.Value;
  percentual: Decimal.Value;
}

export interface PedidoComissionavel {
  base: Decimal.Value;
  percentual: Decimal.Value;
  /**
   * Fatia do preposto, em percentual DA COMISSÃO. Ausente quando o pedido é do
   * próprio escritório — que é o caso de todo escritório do plano Padrão.
   */
  percentualPreposto?: Decimal.Value | null;
  /** Ausente enquanto a indústria não acertou aquele pedido. */
  acerto?: AcertoComissao | null;
}

export interface Rateio {
  /** O que a indústria paga ao escritório. */
  total: Decimal;
  doPreposto: Decimal;
  doEscritorio: Decimal;
}

/**
 * Divide a comissão de um pedido entre o preposto e o escritório.
 *
 * O preposto recebe uma fatia DA COMISSÃO, não da venda: 50 quer dizer "metade
 * do que a indústria pagar". Se a indústria pagar menos, os dois perdem juntos,
 * na proporção — que é o acordo que o representante já tinha no sistema antigo.
 *
 * O escritório fica com o RESÍDUO, e não com um percentual próprio. Parece
 * detalhe e não é: assim `doPreposto + doEscritorio` devolve exatamente
 * `total`, sempre. Calculando os dois lados por percentual, dois
 * arredondamentos independentes deixariam centavos sobrando ou faltando no
 * fechamento do mês.
 */
export function ratearComissao(
  base: Decimal.Value,
  percentualIndustria: Decimal.Value,
  percentualPreposto: Decimal.Value | null | undefined,
): Rateio {
  const total = comissaoDoPedido(base, percentualIndustria);

  const doPreposto = total
    .times(percentualPreposto ?? 0)
    .dividedBy(100)
    .toDecimalPlaces(2);

  return { total, doPreposto, doEscritorio: total.minus(doPreposto) };
}

export interface ResumoComissao {
  base: Decimal;
  /** O que os pedidos do mês deveriam render, acertados ou não. */
  valor: Decimal;
  /** Percentual médio sobre a base. Só difere do fixo quando há pedido com percentual próprio. */
  percentualMedio: Decimal;
  /** Soma dos acertos já lançados. */
  recebido: Decimal;
  /** Previsto dos pedidos que ainda não têm acerto. */
  aAcertar: Decimal;
  /**
   * Recebido menos o previsto DOS PEDIDOS JÁ ACERTADOS.
   *
   * Comparar com o previsto total daria um número sem sentido enquanto o mês
   * corre: pedido ainda não acertado apareceria como prejuízo.
   */
  diferenca: Decimal;
  acertados: number;

  /** Rateio do previsto: o que sai para os prepostos e o que fica na casa. */
  previstoDoPreposto: Decimal;
  previstoDoEscritorio: Decimal;
  /** Rateio do que já foi acertado. */
  recebidoDoPreposto: Decimal;
  recebidoDoEscritorio: Decimal;
  /**
   * Os mesmos "a acertar" e "diferença", na fatia do preposto.
   *
   * Existem porque a tela do preposto mostra as quatro caixas como qualquer
   * outra, e usar ali os números do escritório seria mostrar a ele um total que
   * não é o dele.
   */
  aAcertarDoPreposto: Decimal;
  diferencaDoPreposto: Decimal;
}

/**
 * Soma a comissão de vários pedidos.
 *
 * Cada pedido rende o SEU percentual — daí somar pedido a pedido em vez de
 * aplicar uma taxa única ao total. O percentual médio existe só para exibição.
 */
export function somarComissao(pedidos: PedidoComissionavel[]): ResumoComissao {
  const zero = new Decimal(0);

  const base = pedidos.reduce((acc, p) => acc.plus(p.base), zero);
  const valor = pedidos.reduce(
    (acc, p) => acc.plus(comissaoDoPedido(p.base, p.percentual)),
    zero,
  );

  const comAcerto = pedidos.filter((p) => p.acerto);

  const recebido = comAcerto.reduce(
    (acc, p) => acc.plus(comissaoDoPedido(p.acerto!.base, p.acerto!.percentual)),
    zero,
  );
  const previstoDosAcertados = comAcerto.reduce(
    (acc, p) => acc.plus(comissaoDoPedido(p.base, p.percentual)),
    zero,
  );

  /*
   * O rateio é somado pedido a pedido, nunca aplicado ao total do mês: cada
   * preposto tem o próprio percentual, e uma taxa média em cima da soma daria
   * um número que não é o de ninguém.
   */
  const somarFatia = (
    lista: PedidoComissionavel[],
    deOndeVem: (p: PedidoComissionavel) => { base: Decimal.Value; percentual: Decimal.Value },
  ) =>
    lista.reduce((acc, p) => {
      const { base: b, percentual } = deOndeVem(p);
      return acc.plus(ratearComissao(b, percentual, p.percentualPreposto).doPreposto);
    }, zero);

  const previstoDoPreposto = somarFatia(pedidos, (p) => p);
  const recebidoDoPreposto = somarFatia(comAcerto, (p) => p.acerto!);
  const previstoDoPrepostoNosAcertados = somarFatia(comAcerto, (p) => p);

  return {
    base,
    valor,
    percentualMedio: base.isZero() ? zero : valor.dividedBy(base).times(100),
    recebido,
    aAcertar: valor.minus(previstoDosAcertados),
    diferenca: recebido.minus(previstoDosAcertados),
    acertados: comAcerto.length,
    previstoDoPreposto,
    previstoDoEscritorio: valor.minus(previstoDoPreposto),
    recebidoDoPreposto,
    recebidoDoEscritorio: recebido.minus(recebidoDoPreposto),
    aAcertarDoPreposto: previstoDoPreposto.minus(previstoDoPrepostoNosAcertados),
    diferencaDoPreposto: recebidoDoPreposto.minus(previstoDoPrepostoNosAcertados),
  };
}

/* -------------------------------------------------------------------------- */
/* Pontualidade da entrega                                                    */
/* -------------------------------------------------------------------------- */

export type SituacaoEntrega = "no_prazo" | "atrasado" | "adiantado";

export interface Pontualidade {
  situacao: SituacaoEntrega;
  /** Dias de diferença, sempre positivo. Zero quando saiu no dia. */
  dias: number;
}

/**
 * Compara a entrega real com a prometida.
 *
 * Devolve `null` quando falta uma das duas datas — não há o que comparar, e
 * fingir pontualidade por ausência de dado seria pior que não mostrar nada.
 *
 * A conta é feita em UTC de propósito: as duas datas são colunas `date`, sem
 * hora, e converter para o fuso local faria uma delas voltar um dia em parte
 * do ano — um pedido entregue no prazo apareceria com um dia de atraso.
 */
export function pontualidadeEntrega(
  prometida: Date | null | undefined,
  real: Date | null | undefined,
): Pontualidade | null {
  if (!prometida || !real) return null;

  const dia = 24 * 60 * 60 * 1000;
  const emUtc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diferenca = Math.round((emUtc(real) - emUtc(prometida)) / dia);

  if (diferenca === 0) return { situacao: "no_prazo", dias: 0 };
  if (diferenca > 0) return { situacao: "atrasado", dias: diferenca };
  return { situacao: "adiantado", dias: Math.abs(diferenca) };
}

/** Competência no formato "AAAA-MM", que é como o mês é identificado nas telas. */
export function competenciaDe(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/** Primeiro e último instante da competência, para filtrar os pedidos do mês. */
export function intervaloDaCompetencia(competencia: string): { de: Date; ate: Date } {
  const [ano, mes] = competencia.split("-").map(Number);

  return {
    de: new Date(ano, mes - 1, 1, 0, 0, 0, 0),
    ate: new Date(ano, mes, 1, 0, 0, 0, 0),
  };
}

/**
 * O mesmo intervalo, em UTC.
 *
 * É o que vale para `prazoEntrega`, que é coluna `date` — sem hora, gravada na
 * meia-noite UTC. Filtrada pelo intervalo local, uma entrega marcada para o dia
 * 1º cairia ANTES do começo do mês (meia-noite local do Brasil é 03:00 UTC) e o
 * pedido apareceria no mês anterior. É a mesma armadilha que `pontualidadeEntrega`
 * já evita.
 */
export function intervaloDaCompetenciaUtc(competencia: string): { de: Date; ate: Date } {
  const [ano, mes] = competencia.split("-").map(Number);

  return {
    de: new Date(Date.UTC(ano, mes - 1, 1)),
    ate: new Date(Date.UTC(ano, mes, 1)),
  };
}

/**
 * Em que mês a comissão de um pedido cai.
 *
 * **É a data de ENTREGA**, não a de envio. A indústria paga depois de entregar,
 * e é assim que o escritório sempre apurou — o sistema anterior fazia
 * `deliveryDate || createdAt` (`orderController.js:195`), e trocar esse critério
 * moveu R$ 22,8 mil entre meses sem que nada tivesse mudado no negócio.
 *
 * O `criadoEm` é o mesmo recurso do sistema antigo para o pedido que ainda não
 * tem prazo marcado: melhor cair no mês em que nasceu do que sumir da apuração.
 *
 * Tudo em UTC, pela razão descrita em `intervaloDaCompetenciaUtc`.
 */
export function competenciaDoPedido(
  prazoEntrega: Date | null | undefined,
  criadoEm: Date,
): string {
  const referencia = prazoEntrega ?? criadoEm;
  const mes = String(referencia.getUTCMonth() + 1).padStart(2, "0");

  return `${referencia.getUTCFullYear()}-${mes}`;
}

/** Anda meses na competência "AAAA-MM" sem depender de fuso. */
export function deslocarCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);

  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export interface ProgressoMeta {
  meta: Decimal;
  alcancado: Decimal;
  /** De 0 a 100, limitado no teto para a barra não estourar. */
  percentual: number;
  batida: boolean;
  /** Quanto falta; zero quando a meta já foi batida. */
  falta: Decimal;
}

/** Progresso da meta pessoal do mês. `null` quando não há meta definida. */
export function progressoDaMeta(
  meta: Decimal.Value | null | undefined,
  alcancado: Decimal.Value,
): ProgressoMeta | null {
  if (meta === null || meta === undefined || meta === "") return null;

  const alvo = new Decimal(meta);
  if (alvo.lessThanOrEqualTo(0)) return null;

  const atual = new Decimal(alcancado);
  const razao = atual.dividedBy(alvo).times(100);

  return {
    meta: alvo,
    alcancado: atual,
    percentual: Math.min(100, Math.max(0, razao.toNumber())),
    batida: atual.greaterThanOrEqualTo(alvo),
    falta: Decimal.max(0, alvo.minus(atual)),
  };
}
