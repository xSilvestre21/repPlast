"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Um controle de cartão guardado na URL — sem navegar.
 *
 * A escolha de cada cartão (período, visão, métrica) vai para a query com
 * `history.replaceState`, que o Next integra ao `useSearchParams`: o cartão
 * reage na hora, a página não recarrega, e o link copiado abre a tela do jeito
 * que estava. `replace` e não `push` porque trocar de visão não é um lugar
 * para onde o "voltar" do navegador deva levar.
 *
 * O padrão NÃO vai para a URL: o endereço da tela intocada continua limpo.
 */
export function useParametro<T extends string>(
  chave: string,
  padrao: T,
  validos: readonly T[],
): [T, (valor: T) => void] {
  const busca = useSearchParams();
  const caminho = usePathname();

  const lido = busca.get(chave);
  const valor = lido !== null && (validos as readonly string[]).includes(lido) ? (lido as T) : padrao;

  const definir = useCallback(
    (novo: T) => {
      const proxima = new URLSearchParams(window.location.search);
      if (novo === padrao) proxima.delete(chave);
      else proxima.set(chave, novo);

      const consulta = proxima.toString();
      window.history.replaceState(null, "", consulta ? `${caminho}?${consulta}` : caminho);
    },
    [chave, padrao, caminho],
  );

  return [valor, definir];
}
