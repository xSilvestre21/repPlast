/**
 * As agregações dos cartões de gráfico, feitas no navegador sobre a base.
 *
 * Tudo puro e em CENTAVOS inteiros: a soma de inteiros é exata, e a conversão
 * para reais acontece só na borda — no rótulo, no tooltip. É o que garante que
 * o total de um mês aqui seja o mesmo da tela de Comissões, centavo a centavo.
 */

import { deslocarCompetencia } from "@/lib/comissao";
import { clientesSumidos } from "@/lib/positivacao";

import type { BaseDosGraficos, CanceladoGrafico, ItemGrafico, SituacaoEntregaGrafico } from "./base";

/** De centavos para reais, só para exibir. */
export const reais = (centavos: number) => centavos / 100;

/** Previsto ou recebido — o que um cartão está medindo. */
export type Metrica = "previsto" | "recebido";

/** O valor de um item na métrica. Sem acerto, o recebido é zero. */
export function valorNa(item: ItemGrafico, metrica: Metrica): number {
  return metrica === "previsto" ? item.previsto : (item.recebido ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Períodos                                                                   */
/* -------------------------------------------------------------------------- */

/** Os `n` meses que terminam em `fim`, do mais antigo ao mais novo. */
export function mesesAte(fim: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => deslocarCompetencia(fim, -(n - 1 - i)));
}

/** Só os itens das competências pedidas. */
export function noPeriodo<T extends { competencia: string }>(lista: T[], meses: string[]): T[] {
  const dentro = new Set(meses);
  return lista.filter((item) => dentro.has(item.competencia));
}

/* -------------------------------------------------------------------------- */
/* Quatro caixas do topo                                                      */
/* -------------------------------------------------------------------------- */

export interface Kpis {
  previsto: number;
  recebido: number;
  /** Previsto dos itens ainda sem acerto. */
  aAcertar: number;
  /** Recebido menos o previsto DOS ACERTADOS — como em `somarComissao`. */
  diferenca: number;
  pedidos: number;
  acertados: number;
}

export function kpisDoMes(itens: ItemGrafico[], competencia: string): Kpis {
  const doMes = itens.filter((item) => item.competencia === competencia);
  const acertados = doMes.filter((item) => item.recebido !== null);

  return {
    previsto: soma(doMes, (i) => i.previsto),
    recebido: soma(acertados, (i) => i.recebido!),
    aAcertar: soma(
      doMes.filter((i) => i.recebido === null),
      (i) => i.previsto,
    ),
    diferenca: soma(acertados, (i) => i.recebido! - i.previsto),
    pedidos: new Set(doMes.map((i) => i.pedidoId)).size,
    acertados: acertados.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Rankings                                                                   */
/* -------------------------------------------------------------------------- */

export interface Fatia {
  chave: string;
  rotulo: string;
  /** Centavos. */
  valor: number;
  pedidos: number;
}

/**
 * Soma por uma chave e ordena do maior para o menor.
 *
 * Empate desempata pelo nome, para a ordem não mudar entre um render e outro —
 * uma barra que troca de lugar sozinha parece um número que mudou.
 */
export function somarPor(
  itens: ItemGrafico[],
  chave: (item: ItemGrafico) => string | null,
  rotulo: (item: ItemGrafico) => string,
  valor: (item: ItemGrafico) => number,
): Fatia[] {
  const grupos = new Map<string, { rotulo: string; valor: number; pedidos: Set<string> }>();

  for (const item of itens) {
    const k = chave(item);
    if (k === null) continue;
    const g = grupos.get(k) ?? { rotulo: rotulo(item), valor: 0, pedidos: new Set<string>() };
    g.valor += valor(item);
    g.pedidos.add(item.pedidoId);
    grupos.set(k, g);
  }

  return [...grupos]
    .map(([k, g]) => ({ chave: k, rotulo: g.rotulo, valor: g.valor, pedidos: g.pedidos.size }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export const porCliente = (itens: ItemGrafico[], metrica: Metrica) =>
  somarPor(
    itens,
    (i) => i.clienteId,
    (i) => i.cliente,
    (i) => valorNa(i, metrica),
  );

export const porIndustria = (itens: ItemGrafico[], metrica: Metrica) =>
  somarPor(
    itens,
    (i) => i.fornecedorId,
    (i) => i.fornecedor,
    (i) => valorNa(i, metrica),
  );

/**
 * O que é do preposto num item, na visão do administrador.
 *
 * "fatia": o que cabe a ele — o bruto menos o que fica com o escritório.
 * "gerada": a comissão inteira que o pedido dele trouxe.
 */
export type MedidaPreposto = "fatia" | "gerada";

export function doPreposto(item: ItemGrafico, metrica: Metrica, medida: MedidaPreposto): number {
  if (item.prepostoId === null || item.bruto === null) return 0;

  const bruto = metrica === "previsto" ? item.bruto : (item.brutoRecebido ?? 0);
  if (medida === "gerada") return bruto;

  const escritorio = valorNa(item, metrica);
  return bruto - escritorio;
}

/* -------------------------------------------------------------------------- */
/* Séries mensais                                                             */
/* -------------------------------------------------------------------------- */

/** Uma soma por mês, na ordem dos meses — mês sem item é ZERO, não buraco. */
export function somaPorMes<T extends { competencia: string }>(
  lista: T[],
  meses: string[],
  valor: (item: T) => number,
): number[] {
  const total = new Map(meses.map((m) => [m, 0]));
  for (const item of lista) {
    if (total.has(item.competencia)) {
      total.set(item.competencia, total.get(item.competencia)! + valor(item));
    }
  }
  return meses.map((m) => total.get(m)!);
}

/** O acumulado de uma série: cada ponto soma os anteriores. */
export function acumular(valores: number[]): number[] {
  let corrente = 0;
  return valores.map((v) => (corrente += v));
}

/* -------------------------------------------------------------------------- */
/* Hierarquia e grade                                                         */
/* -------------------------------------------------------------------------- */

export interface NoArvore {
  id: string;
  name: string;
  /** Centavos. */
  value: number;
  children?: NoArvore[];
}

/** Indústria e, dentro dela, os clientes — os blocos do mapa de indústrias. */
export function industriaCliente(itens: ItemGrafico[], metrica: Metrica): NoArvore[] {
  return porIndustria(itens, metrica)
    .filter((industria) => industria.valor > 0)
    .map((industria) => ({
      id: industria.chave,
      name: industria.rotulo,
      value: industria.valor,
      children: porCliente(
        itens.filter((i) => i.fornecedorId === industria.chave),
        metrica,
      )
        .filter((c) => c.valor > 0)
        .map((c) => ({ id: `${industria.chave}:${c.chave}`, name: c.rotulo, value: c.valor })),
    }));
}

export interface NoFluxo {
  /** "i:<indústria>", "c:<cliente>" ou "c:outros" — único entre os dois lados. */
  id: string;
  nome: string;
  lado: "industria" | "cliente";
  /** Centavos. */
  valor: number;
  outros?: boolean;
}

export interface LigacaoFluxo {
  origem: string;
  destino: string;
  /** Centavos. */
  valor: number;
}

/**
 * Indústria → cliente, para o diagrama de fluxo (Sankey).
 *
 * O cliente é UM nó só, mesmo comprando de várias indústrias: as faixas delas
 * convergem nele — é justamente o que o diagrama mostra e o mapa não mostrava.
 * Ficam os `maxClientes` maiores no total; o resto vira um nó "Outros"
 * (só quando são dois ou mais — "Outros (1)" não ajuda ninguém).
 *
 * A ordem é a do maior para o menor nos dois lados, "Outros" no fim: o
 * diagrama usa essa ordem como está, então ela é a ordem de leitura.
 */
export function fluxoIndustriaCliente(
  arvore: NoArvore[],
  maxClientes = 10,
): { nos: NoFluxo[]; ligacoes: LigacaoFluxo[] } {
  const totalDoCliente = new Map<string, { nome: string; valor: number }>();
  for (const industria of arvore) {
    for (const filho of industria.children ?? []) {
      const cliente = filho.id.split(":")[1] ?? filho.id;
      const atual = totalDoCliente.get(cliente) ?? { nome: filho.name, valor: 0 };
      atual.valor += filho.value;
      totalDoCliente.set(cliente, atual);
    }
  }

  const ordenados = [...totalDoCliente.entries()].sort((a, b) => b[1].valor - a[1].valor);
  const resto = ordenados.slice(maxClientes);
  const agrupa = resto.length >= 2;
  const visiveis = new Set((agrupa ? ordenados.slice(0, maxClientes) : ordenados).map(([id]) => id));
  const noDoCliente = (cliente: string) => (visiveis.has(cliente) ? `c:${cliente}` : "c:outros");

  const somaLigacao = new Map<string, LigacaoFluxo>();
  for (const industria of arvore) {
    for (const filho of industria.children ?? []) {
      const destino = noDoCliente(filho.id.split(":")[1] ?? filho.id);
      const chave = `i:${industria.id}>${destino}`;
      const ligacao = somaLigacao.get(chave) ?? { origem: `i:${industria.id}`, destino, valor: 0 };
      ligacao.valor += filho.value;
      somaLigacao.set(chave, ligacao);
    }
  }

  const nos: NoFluxo[] = [
    ...[...arvore]
      .sort((a, b) => b.value - a.value)
      .map((i) => ({ id: `i:${i.id}`, nome: i.name, lado: "industria" as const, valor: i.value })),
    ...ordenados
      .filter(([id]) => visiveis.has(id))
      .map(([id, c]) => ({ id: `c:${id}`, nome: c.nome, lado: "cliente" as const, valor: c.valor })),
    ...(agrupa
      ? [
          {
            id: "c:outros",
            nome: `Outros (${resto.length})`,
            lado: "cliente" as const,
            valor: resto.reduce((acc, [, c]) => acc + c.valor, 0),
            outros: true,
          },
        ]
      : []),
  ];

  return { nos, ligacoes: [...somaLigacao.values()].filter((l) => l.valor > 0) };
}

export interface Grade {
  linhas: { chave: string; rotulo: string; total: number }[];
  meses: string[];
  /** [indiceDoMes, indiceDaLinha, centavos] — o formato do heatmap. */
  celulas: [number, number, number][];
  maximo: number;
}

/**
 * Cliente × mês: os `limite` clientes de maior soma no período, um mês por
 * coluna. Célula sem pedido é zero — no heatmap, "não comprou" é informação.
 */
export function gradeClienteMes(
  itens: ItemGrafico[],
  meses: string[],
  metrica: Metrica,
  limite: number,
): Grade {
  const doPeriodo = noPeriodo(itens, meses);
  const linhas = porCliente(doPeriodo, metrica)
    .filter((c) => c.valor > 0)
    .slice(0, limite)
    .map((c) => ({ chave: c.chave, rotulo: c.rotulo, total: c.valor }));

  const celulas: [number, number, number][] = [];
  let maximo = 0;

  linhas.forEach((linha, y) => {
    const doCliente = doPeriodo.filter((i) => i.clienteId === linha.chave);
    somaPorMes(doCliente, meses, (i) => valorNa(i, metrica)).forEach((valor, x) => {
      celulas.push([x, y, valor]);
      maximo = Math.max(maximo, valor);
    });
  });

  return { linhas, meses, celulas, maximo };
}

/* -------------------------------------------------------------------------- */
/* Os cartões que não são de comissão                                         */
/* -------------------------------------------------------------------------- */

export function canceladosPorMes(lista: CanceladoGrafico[], meses: string[]) {
  return {
    valor: somaPorMes(lista, meses, (c) => c.valor),
    quantidade: somaPorMes(lista, meses, () => 1),
  };
}

export function conversaoNoPeriodo(base: BaseDosGraficos, meses: string[]) {
  const doPeriodo = noPeriodo(base.orcamentos, meses);
  const viraram = doPeriodo.filter((o) => o.virou).length;

  return {
    criadas: doPeriodo.length,
    viraram,
    porMes: {
      criadas: somaPorMes(doPeriodo, meses, () => 1),
      viraram: somaPorMes(doPeriodo, meses, (o) => (o.virou ? 1 : 0)),
    },
  };
}

export const SITUACOES: SituacaoEntregaGrafico[] = ["no_prazo", "adiantado", "atrasado"];

export function pontualidadeNoPeriodo(base: BaseDosGraficos, meses: string[]) {
  const doPeriodo = noPeriodo(base.entregas, meses);

  return {
    total: doPeriodo.length,
    contagem: Object.fromEntries(
      SITUACOES.map((s) => [s, doPeriodo.filter((e) => e.situacao === s).length]),
    ) as Record<SituacaoEntregaGrafico, number>,
    porMes: Object.fromEntries(
      SITUACOES.map((s) => [s, somaPorMes(doPeriodo, meses, (e) => (e.situacao === s ? 1 : 0))]),
    ) as Record<SituacaoEntregaGrafico, number[]>,
  };
}

/**
 * Quem não compra há mais de `dias`, o mais abandonado primeiro.
 *
 * A regra é a de `clientesSumidos`, a mesma do painel inicial — a base só
 * traz a data em milissegundos, porque `Date` não atravessa para o navegador.
 */
export function sumidos(base: BaseDosGraficos, dias: number) {
  const clientes = base.clientes.map((c) => ({
    ...c,
    ultimaCompra: c.ultimaCompra === null ? null : new Date(c.ultimaCompra),
  }));

  return clientesSumidos(clientes, dias, base.agora).map((s) => ({
    id: s.cliente.id,
    apelido: s.cliente.apelido,
    dias: s.diasSemComprar,
    ultimoValor: s.cliente.ultimoValor ?? 0,
  }));
}

function soma<T>(lista: T[], valor: (item: T) => number): number {
  return lista.reduce((acc, item) => acc + valor(item), 0);
}
