/**
 * O item que fez o pedido ou a proposta aparecer na busca — "105x100x0,08 SF 15
 * PEAD · 10 MIL a R$ 1.134,00" —, embaixo da linha da lista.
 *
 * Em fonte mono, como a descrição na lista de produtos: é a mesma descrição,
 * e a pessoa a reconhece pela forma.
 *
 * Quebra em quantas linhas precisar, em vez de cortar com "…": a linha de
 * detalhe da lista é de uma linha só, e no celular sobrava "77x150x0,…" — a
 * medida, que é justamente o que distingue um saco do outro. Quantidade e
 * preço ficam numa peça que não se parte.
 */

import { Package } from "lucide-react";

import type { ItemAchado as Item } from "@/lib/item-procurado";

export function ItemAchado({ item }: { item: Item }) {
  return (
    // `whitespace-normal`: o detalhe da linha é `truncate`, e o nowrap dele se herda.
    <span className="flex items-start gap-1 text-tinta-2 mt-0.5 min-w-0 whitespace-normal">
      <Package size={11} strokeWidth={2} aria-hidden="true" className="shrink-0 mt-[3px]" />
      <span className="min-w-0 break-words">
        <span className="sr-only">Item encontrado: </span>
        <span className="font-mono">{item.descricao}</span>{" "}
        <span className="whitespace-nowrap numerico">
          · {item.quantidade} a {item.preco}
        </span>
      </span>
    </span>
  );
}
