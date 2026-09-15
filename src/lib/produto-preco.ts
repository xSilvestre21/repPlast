/**
 * Preço e peso de um produto na unidade em que ele é vendido.
 *
 * É a ponte entre o cadastro de produto e o item de pedido: dada a família e a
 * unidade escolhida, devolve o preço unitário. Só o saco passa pela fórmula;
 * as outras famílias leem o preço de tabela.
 *
 * Módulo puro, sem I/O — roda igual no servidor e no navegador.
 */

import Decimal from "decimal.js";

import { type Aditivo, pesoMilheiroKg, precoMilheiroSaco } from "./precificacao";

export type Familia = "SACO" | "FITA" | "STRETCH" | "BOBINA" | "AVULSO";
export type UnidadeVenda = "MIL" | "KG" | "UN" | "CX";

export interface ProdutoPrecificavel {
  familia: Familia;

  // Saco
  larguraCm?: Decimal.Value | null;
  comprimentoCm?: Decimal.Value | null;
  espessuraMm?: Decimal.Value | null;
  fatorKg?: Decimal.Value | null;
  /** Densidade congelada no produto. Vazia cai em `DENSIDADE_PADRAO`. */
  densidade?: Decimal.Value | null;

  // Fita
  precoUnidade?: Decimal.Value | null;
  precoCaixa?: Decimal.Value | null;
  unidadesPorCaixa?: number | null;

  // Stretch e bobina
  precoKg?: Decimal.Value | null;

  // Avulso: um preço só, na unidade em que o item é vendido
  unidadeAvulsa?: UnidadeVenda | null;
  precoAvulso?: Decimal.Value | null;

  aditivos?: Aditivo[];
}

/** Rótulo da coluna de preço no PDF — muda por família, como nos pedidos reais. */
export const ROTULO_COLUNA_PRECO: Record<Familia, string> = {
  SACO: "MILHEIRO",
  FITA: "PREÇO/CX",
  STRETCH: "PREÇO/KG",
  BOBINA: "PREÇO/KG",
  AVULSO: "PREÇO UNIT.",
};

export const ROTULO_UNIDADE: Record<UnidadeVenda, string> = {
  MIL: "MIL",
  KG: "KG",
  UN: "un",
  CX: "cx",
};

/**
 * Unidades em que a família pode ser vendida.
 *
 * A fita aparece com as duas porque o usuário vende tanto rolo avulso quanto
 * caixa fechada; quais delas de fato valem depende de quais preços o produto
 * tem cadastrados (ver `unidadesComPreco`).
 */
export function unidadesDaFamilia(familia: Familia): UnidadeVenda[] {
  switch (familia) {
    case "SACO":
      return ["MIL"];
    case "FITA":
      return ["CX", "UN"];
    case "AVULSO":
      /*
       * O avulso não tem unidade fixa: ela é escolhida no cadastro do produto.
       * Devolvemos as candidatas e deixamos `precoUnitario` decidir — só a
       * unidade escolhida tem preço, então `unidadesComPreco` filtra sozinho.
       */
      return ["UN", "KG", "CX", "MIL"];
    default:
      return ["KG"];
  }
}

/** Unidades que o produto realmente pode usar, dado o que está preenchido. */
export function unidadesComPreco(produto: ProdutoPrecificavel): UnidadeVenda[] {
  return unidadesDaFamilia(produto.familia).filter(
    (unidade) => precoUnitario(produto, unidade) !== null,
  );
}

/**
 * Preço de uma unidade de venda. Devolve `null` quando o produto não tem o
 * dado necessário — um saco sem medidas, uma fita sem preço de caixa.
 *
 * O valor volta SEM arredondar: quem multiplica pela quantidade precisa da
 * precisão cheia, senão o total erra centavos (ver `totais.ts`).
 */
export function precoUnitario(
  produto: ProdutoPrecificavel,
  unidade: UnidadeVenda,
): Decimal | null {
  if (produto.familia === "SACO") {
    if (unidade !== "MIL") return null;

    const { larguraCm, comprimentoCm, espessuraMm, fatorKg } = produto;
    if (larguraCm == null || comprimentoCm == null || espessuraMm == null || fatorKg == null) {
      return null;
    }

    return precoMilheiroSaco({
      larguraCm,
      comprimentoCm,
      espessuraMm,
      fatorKg,
      densidade: produto.densidade,
      aditivos: produto.aditivos,
    });
  }

  if (produto.familia === "FITA") {
    if (unidade === "CX") return produto.precoCaixa == null ? null : new Decimal(produto.precoCaixa);

    if (unidade === "UN") {
      if (produto.precoUnidade != null) return new Decimal(produto.precoUnidade);

      // Sem preço de unidade, derivamos da caixa — desde que saibamos quantas
      // unidades ela traz.
      if (produto.precoCaixa != null && produto.unidadesPorCaixa) {
        return new Decimal(produto.precoCaixa).dividedBy(produto.unidadesPorCaixa);
      }
    }

    return null;
  }

  if (produto.familia === "AVULSO") {
    // Preço digitado, e só vale na unidade em que o item é vendido.
    if (produto.precoAvulso == null || produto.unidadeAvulsa !== unidade) return null;
    return new Decimal(produto.precoAvulso);
  }

  // STRETCH e BOBINA
  if (unidade !== "KG") return null;
  return produto.precoKg == null ? null : new Decimal(produto.precoKg);
}

/**
 * Peso do item, em quilos — usado nas metas de comissão medidas em kg.
 *
 * Para o saco é `pesoMilheiroKg` — medidas × densidade, a mesma conta que forma
 * o preço. Para fita não há peso cadastrado, então devolve zero: uma indústria
 * de fitas com meta em quilos ficaria sem base, e isso precisa ser resolvido
 * antes da fase 6.
 */
export function pesoDoItem(
  produto: ProdutoPrecificavel,
  unidade: UnidadeVenda,
  quantidade: Decimal.Value,
): Decimal {
  if (unidade === "KG") return new Decimal(quantidade);

  if (produto.familia === "SACO" && unidade === "MIL") {
    const { larguraCm, comprimentoCm, espessuraMm } = produto;
    if (larguraCm == null || comprimentoCm == null || espessuraMm == null) return new Decimal(0);

    return pesoMilheiroKg(
      { larguraCm, comprimentoCm, espessuraMm },
      produto.densidade,
    ).times(quantidade);
  }

  return new Decimal(0);
}

/**
 * Converte o produto do banco no formato que o motor de preço entende.
 *
 * Vive aqui, e não na ação do pedido, porque o orçamento precisa exatamente do
 * mesmo — e duas cópias divergiriam na primeira família nova. Foi o que quase
 * aconteceu com o AVULSO.
 *
 * Os `unknown` são os `Decimal` do Prisma: só o `toString()` deles interessa.
 */
export function paraPrecificavel(produto: {
  familia: string;
  larguraCm: unknown;
  comprimentoCm: unknown;
  espessuraMm: unknown;
  fatorKg: unknown;
  densidade: unknown;
  precoUnidade: unknown;
  precoCaixa: unknown;
  precoKg: unknown;
  unidadeAvulsa: unknown;
  precoAvulso: unknown;
  unidadesPorCaixa: number | null;
  aditivos: { aditivo: { nome: string; sufixoDescricao: string; tipo: string; valor: unknown } }[];
}): ProdutoPrecificavel {
  const texto = (v: unknown) => (v === null || v === undefined ? null : String(v));

  return {
    familia: produto.familia as Familia,
    larguraCm: texto(produto.larguraCm),
    comprimentoCm: texto(produto.comprimentoCm),
    espessuraMm: texto(produto.espessuraMm),
    fatorKg: texto(produto.fatorKg),
    densidade: texto(produto.densidade),
    precoUnidade: texto(produto.precoUnidade),
    precoCaixa: texto(produto.precoCaixa),
    precoKg: texto(produto.precoKg),
    unidadeAvulsa: (texto(produto.unidadeAvulsa) as UnidadeVenda | null) ?? null,
    precoAvulso: texto(produto.precoAvulso),
    unidadesPorCaixa: produto.unidadesPorCaixa,
    aditivos: produto.aditivos.map(({ aditivo }) => ({
      nome: aditivo.nome,
      sufixoDescricao: aditivo.sufixoDescricao,
      tipo: aditivo.tipo as Aditivo["tipo"],
      valor: String(aditivo.valor),
    })),
  };
}
