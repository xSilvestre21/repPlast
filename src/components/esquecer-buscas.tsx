"use client";

/**
 * Esquece a busca das listas quando a pessoa troca de seção.
 *
 * A busca vale enquanto ela está em Produtos — abrindo, editando, voltando —
 * e some ao ir para Clientes, Pedidos ou o Painel (`lib/busca-lembrada.ts`).
 * Mora no layout, e não em cada lista, porque quem sai da seção nem sempre
 * passa pela lista: sai da ficha de um produto direto pela aba do topo.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { esquecerOutras, secaoDoCaminho } from "@/lib/busca-lembrada";

export function EsquecerBuscas() {
  const caminho = usePathname();

  useEffect(() => {
    esquecerOutras(secaoDoCaminho(caminho));
  }, [caminho]);

  return null;
}
