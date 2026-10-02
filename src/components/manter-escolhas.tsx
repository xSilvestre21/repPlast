"use client";

/**
 * Leva as escolhas da tela junto ao trocar de mês.
 *
 * Os cartões dos gráficos e os filtros do calendário guardam o que a pessoa
 * escolheu na URL com `history.replaceState` (`useParametro`) — sem navegar,
 * então o servidor não fica sabendo. Os links do `NavegadorMes` foram montados
 * no servidor com a URL do carregamento: sem isto, trocar de mês desfaria a
 * visão que a pessoa montou depois.
 *
 * Por isso o clique é interceptado aqui (na fase de captura, antes do `Link`):
 * o destino recebe a query ATUAL, com o mês do link por cima, e a navegação
 * segue pelo roteador do Next.
 */

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function ManterEscolhas({
  children,
  /** O que o link manda e não deve ser sobrescrito pela query atual. */
  doLink = ["mes"],
}: {
  children: ReactNode;
  doLink?: string[];
}) {
  const router = useRouter();

  return (
    <div
      onClickCapture={(evento) => {
        // Clique com Ctrl/Cmd ou do meio abre aba nova: fica com o link como está.
        if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey) return;

        const ancora = (evento.target as HTMLElement).closest("a");
        if (!ancora || ancora.target === "_blank") return;

        const destino = new URL(ancora.href);
        if (destino.origin !== window.location.origin) return;

        const atual = new URLSearchParams(window.location.search);
        for (const chave of doLink) atual.delete(chave);
        for (const chave of doLink) {
          const valor = destino.searchParams.get(chave);
          if (valor !== null) atual.set(chave, valor);
        }

        evento.preventDefault();
        const consulta = atual.toString();
        router.push(consulta ? `${destino.pathname}?${consulta}` : destino.pathname);
      }}
    >
      {children}
    </div>
  );
}
