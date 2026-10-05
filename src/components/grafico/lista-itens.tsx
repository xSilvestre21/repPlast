"use client";

/**
 * A lista que um cartão abre quando o gráfico agrega coisas que se abrem uma
 * a uma — pedidos cancelados, propostas, entregas.
 *
 * Uma barra de "setembro" é uma soma; quem clica nela quer ver o que está
 * dentro e abrir o pedido. Então o clique no gráfico filtra esta lista (o mês,
 * a situação) e cada linha leva à ficha. O filtro aparece no topo, com o "x"
 * para voltar a tudo — sem ele, a lista filtrada pareceria a lista inteira.
 */

import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AreaRolavel } from "./area-rolavel";

export interface ItemDaLista {
  chave: string;
  href: string;
  /** "#2283 AKILAH" — o que identifica a linha. */
  titulo: ReactNode;
  /** À direita do título: valor, dias, situação. */
  destaque?: ReactNode;
  /** A segunda linha, menor. */
  detalhe?: ReactNode;
}

export function ListaItens({
  itens,
  filtro,
  aoLimparFiltro,
  vazio = "Nada aqui.",
  teto = 272,
}: {
  itens: ItemDaLista[];
  /** O que está filtrando a lista agora — "set/26 · atrasadas". */
  filtro?: string | null;
  aoLimparFiltro?: () => void;
  vazio?: string;
  teto?: number;
}) {
  return (
    <div className="flex-1 flex flex-col gap-2 min-h-0">
      {filtro && (
        <div className="flex items-center justify-between gap-2 text-mini text-tinta-3">
          <span className="min-w-0">
            Mostrando <b className="text-tinta">{filtro}</b> · {itens.length}{" "}
            {itens.length === 1 ? "item" : "itens"}
          </span>
          <button
            type="button"
            onClick={aoLimparFiltro}
            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded-full
              bg-folha-2 border border-filete hover:text-tinta transition-colors cursor-pointer"
          >
            <X size={11} strokeWidth={2.5} aria-hidden="true" />
            ver todos
          </button>
        </div>
      )}

      <AreaRolavel teto={teto} className="rounded-suave border border-filete">
        {itens.length === 0 ? (
          <p className="px-3 py-6 text-center text-mini text-tinta-3">{vazio}</p>
        ) : (
          <ul className="divide-y divide-filete">
            {itens.map((item) => (
              <li key={item.chave}>
                <Link href={item.href} className="block px-3 py-2 hover:bg-folha-2 transition-colors">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-corpo truncate">{item.titulo}</span>
                    {item.destaque && <span className="shrink-0">{item.destaque}</span>}
                  </span>
                  {item.detalhe && (
                    <span className="block text-mini text-tinta-3 truncate">{item.detalhe}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AreaRolavel>
    </div>
  );
}
