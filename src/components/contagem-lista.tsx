"use client";

/**
 * O número no topo das listas: "128 clientes" e, buscando ou filtrando,
 * "3 de 128 clientes".
 *
 * Fica no cabeçalho, ao lado do título (o `selo` do `Cabecalho`), mas quem sabe
 * quantos a busca achou é a lista — um componente de cliente que pede as fatias
 * sozinho enquanto a pessoa digita. O contexto é a ponte: a página o abre em
 * volta dos dois, já com o número da primeira fatia (o servidor desenha o
 * número certo, sem piscar), e a lista o atualiza a cada busca.
 *
 * O total é tudo da seção, inativos e cancelados inclusive, e para o preposto
 * só o que ele vê — vem do `count` da página, que passa pelo RLS.
 */

import { createContext, type ReactNode, useContext, useState } from "react";

type Contagem = {
  total: number;
  quantos: number;
  definir: (quantos: number) => void;
};

const ContextoContagem = createContext<Contagem | null>(null);

export function ContagemProvider({
  total,
  inicial,
  children,
}: {
  total: number;
  /** Quantos a primeira fatia achou — com a busca com que a página abriu. */
  inicial: number;
  children: ReactNode;
}) {
  const [quantos, definir] = useState(inicial);
  return <ContextoContagem.Provider value={{ total, quantos, definir }}>{children}</ContextoContagem.Provider>;
}

/** O `definir` para a lista, ou um que não faz nada fora de um `ContagemProvider`. */
export function useDefinirContagem(): (quantos: number) => void {
  return useContext(ContextoContagem)?.definir ?? nada;
}

function nada() {}

const NUMERO = new Intl.NumberFormat("pt-BR");

/** "128 clientes", "1 cliente", "3 de 128 clientes" — puro, para o teste e para o selo. */
export function textoDaContagem(quantos: number, total: number, singular: string, plural: string): string {
  if (quantos === total) return `${NUMERO.format(total)} ${total === 1 ? singular : plural}`;
  return `${NUMERO.format(quantos)} de ${NUMERO.format(total)} ${total === 1 ? singular : plural}`;
}

export function ContagemDaLista({ singular, plural }: { singular: string; plural: string }) {
  const contagem = useContext(ContextoContagem);
  // Sem cadastro nenhum, o estado vazio da lista já diz — "0 clientes" seria repetir.
  if (!contagem || contagem.total === 0) return null;

  return (
    // `status`: quem usa leitor de tela ouve o novo número quando a busca muda.
    <span role="status" className="chip numerico">
      {textoDaContagem(contagem.quantos, contagem.total, singular, plural)}
    </span>
  );
}
