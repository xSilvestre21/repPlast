/**
 * O que a busca de Comissões acha numa linha: o número do pedido, o cliente e,
 * na tela do administrador, o preposto.
 *
 * Tudo por PEDAÇO, como as buscas do app (`lib/busca.ts`): sem acento, sem
 * caixa, e com todos os termos digitados, em qualquer ordem. O número também —
 * "22" acha o #2224 (e o #1220): quem confere o extrato vai digitando e vê a
 * lista estreitar, sem precisar do número inteiro. O "#" é ignorado, porque é
 * assim que a tela escreve o número e quem copia de lá copia com ele.
 *
 * Módulo puro: a caixa de busca (`busca-comissao.tsx`) roda no navegador, e os
 * testes, em `node`.
 */

import { casaComTermos, termosDaBusca } from "@/lib/busca";

export type LinhaBuscavel = {
  numero: number;
  cliente: string;
  /** Nulo no pedido da casa, e sempre na tela do preposto. */
  preposto: string | null;
};

/**
 * A identidade de uma linha da tabela: o pedido, ou uma parcela dele.
 *
 * Aqui, e não em `busca-comissao.tsx`: a página monta o índice no servidor, e
 * função exportada de módulo `'use client'` chega lá como referência, não como
 * função.
 */
export function chaveDaLinha(pedidoId: string, parcela: number | null): string {
  return `${pedidoId}:${parcela ?? ""}`;
}

/** A linha casa com o que foi digitado? Sem nada digitado, todas casam. */
export function casaComBusca(linha: LinhaBuscavel, busca: string): boolean {
  const termos = termosDaBusca(busca.replace(/#/g, " "));
  if (termos.length === 0) return true;

  return casaComTermos(`${linha.numero} ${linha.cliente} ${linha.preposto ?? ""}`, termos);
}
