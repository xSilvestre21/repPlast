/**
 * Buscar pedido e orçamento pelo PRODUTO: "os últimos pedidos com aquele saco".
 *
 * Procura nos itens, e não no catálogo: cada item guarda a descrição e os
 * códigos como saíram impressos (`PedidoItem.descricao`). Assim acha também o
 * item de um produto que já foi apagado e a linha de proposta feita na conta,
 * sem produto nenhum.
 *
 * Serve às duas listas gêmeas (`pedidos/consulta.ts`, `orcamentos/consulta.ts`):
 * os dois itens têm as mesmas colunas.
 */

import type { UnidadeVenda } from "@/generated/prisma/enums";
import { formatarMoeda } from "@/components/ui";

import { escreverNumeroBr } from "./numero-br";
import { ROTULO_UNIDADE } from "./produto-preco";

const INSENSIVEL = "insensitive" as const;

/**
 * O filtro de um item: CADA palavra digitada aparece na descrição ou num dos
 * códigos daquele MESMO item, em qualquer ordem. "pead 105" acha
 * "105x100x0,08 SF 15 PEAD"; a frase inteira não precisaria estar na ordem
 * em que foi impressa. `null` sem busca.
 */
export function itemProcurado(busca: string) {
  const termos = busca.trim().split(/\s+/).filter(Boolean);
  if (termos.length === 0) return null;

  return {
    AND: termos.map((termo) => ({
      OR: [
        { descricao: { contains: termo, mode: INSENSIVEL } },
        { codigoFornecedor: { contains: termo, mode: INSENSIVEL } },
        { codigoCliente: { contains: termo, mode: INSENSIVEL } },
      ],
    })),
  };
}

/** O item que fez a linha aparecer, pronto para desenhar. */
export type ItemAchado = {
  descricao: string;
  /** "10 MIL", "2,5 KG". */
  quantidade: string;
  /** Preço unitário, na unidade do item. */
  preco: string;
};

/**
 * O primeiro item que bateu, escrito — ou `null` quando a busca achou o
 * documento por outra coisa (número, cliente, indústria).
 *
 * Mostrado na linha porque, se dá para procurar por ele, ele precisa estar
 * visível: senão o pedido aparece e nada nele explica por quê. E já responde a
 * pergunta seguinte — quanto foi, e a que preço.
 */
export function itemAchado(
  itens:
    | { descricao: string; quantidade: { toString(): string }; unidade: UnidadeVenda; precoUnitario: { toString(): string } }[]
    | undefined,
): ItemAchado | null {
  const item = itens?.[0];
  if (!item) return null;

  return {
    descricao: item.descricao,
    quantidade: `${escreverNumeroBr(item.quantidade.toString(), 0, 3)} ${ROTULO_UNIDADE[item.unidade]}`,
    preco: formatarMoeda(item.precoUnitario.toString()),
  };
}

/** O `include` do item achado: só o primeiro que bate, na ordem do documento. */
export function incluirItemAchado(filtro: ReturnType<typeof itemProcurado>) {
  if (!filtro) return {};
  return {
    itens: {
      where: filtro,
      orderBy: { ordem: "asc" as const },
      take: 1,
      select: { descricao: true, quantidade: true, unidade: true, precoUnitario: true },
    },
  };
}
