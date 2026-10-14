/**
 * Os planos que o RepPlast vende — fonte única.
 *
 * Os cartões da tela de entrada, os do cadastro e o valor que vai para o
 * Asaas leem todos daqui. Preço escrito em dois lugares acaba divergindo, e o
 * que divergiria seria a cobrança contra o que a pessoa viu ao assinar.
 *
 * "Solo" e "Max" são só nomes de vitrine: no banco continuam `PADRAO` e `PLUS`,
 * que o sistema inteiro já usa para decidir se existem telas de preposto.
 *
 * Módulo puro — sem banco, sem `server-only` —, porque a tela de entrada é
 * desenhada no servidor e os cartões animados rodam no navegador.
 */

import Decimal from "decimal.js";

export type CodigoPlano = "PADRAO" | "PLUS";

export interface Plano {
  codigo: CodigoPlano;
  /** Como o plano aparece na URL do cadastro: `/comecar?plano=solo`. */
  slug: "solo" | "max";
  nome: string;
  /** Uma linha: para quem é. */
  publico: string;
  precoMensal: Decimal;
  /** Prepostos que a mensalidade já cobre. */
  prepostosInclusos: number;
  /** Mensalidade de cada preposto além dos inclusos. `null`: o plano não tem preposto. */
  precoPrepostoExtra: Decimal | null;
  destaques: string[];
  /** O cartão que ganha o realce e o selo "Para começar". */
  recomendado: boolean;
}

export const PLANOS: Record<CodigoPlano, Plano> = {
  PADRAO: {
    codigo: "PADRAO",
    slug: "solo",
    nome: "Solo",
    publico: "Para o representante que vende sozinho.",
    precoMensal: new Decimal("79"),
    prepostosInclusos: 0,
    precoPrepostoExtra: null,
    destaques: [
      "Pedidos e orçamentos ilimitados",
      "Preço calculado pelas medidas do saco",
      "PDF no formato de cada indústria",
      "Comissões, parcelas e metas",
      "Agenda, painel e gráficos",
      "Envio por e-mail direto do sistema",
    ],
    recomendado: true,
  },
  PLUS: {
    codigo: "PLUS",
    slug: "max",
    nome: "Max",
    publico: "Para o escritório que tem prepostos vendendo.",
    precoMensal: new Decimal("189"),
    prepostosInclusos: 3,
    precoPrepostoExtra: new Decimal("49"),
    destaques: [
      "Tudo do Solo",
      "3 prepostos inclusos",
      "Cada preposto vê só a carteira dele",
      "Rateio da comissão e repasse ao preposto",
      "Gráficos por preposto",
      "Indústrias liberadas preposto a preposto",
    ],
    recomendado: false,
  },
};

/** Na ordem dos cartões: do menor para o maior. */
export const LISTA_PLANOS: Plano[] = [PLANOS.PADRAO, PLANOS.PLUS];

/** O plano pelo `?plano=` da URL, ou `null` quando o texto não é de nenhum. */
export function planoDaUrl(slug: string | null | undefined): Plano | null {
  return LISTA_PLANOS.find((plano) => plano.slug === slug) ?? null;
}

/**
 * Prepostos cobrados à parte: os ativos que passam dos inclusos.
 *
 * No Solo é sempre zero — ali não existe preposto, e a conta não deve inventar
 * cobrança por um que tenha sobrado de quando o escritório era Max.
 */
export function prepostosExtras(codigo: CodigoPlano, prepostosAtivos: number): number {
  const plano = PLANOS[codigo];
  if (plano.precoPrepostoExtra === null) return 0;

  return Math.max(0, prepostosAtivos - plano.prepostosInclusos);
}

/** Mensalidade do escritório: o plano mais os prepostos além dos inclusos. */
export function valorMensal(codigo: CodigoPlano, prepostosAtivos = 0): Decimal {
  const plano = PLANOS[codigo];
  const extras = prepostosExtras(codigo, prepostosAtivos);

  return plano.precoMensal.plus(
    (plano.precoPrepostoExtra ?? new Decimal(0)).times(extras),
  );
}
