"use client";

import { useState, type ReactNode } from "react";

import { Cartao } from "@/components/ui";

/**
 * Lista em cartão que entra em cascata quando o FILTRO muda — e só então.
 *
 * Na primeira pintura ela não anima: no Painel, a lista mora num bloco que já
 * se revela ao rolar, e uma cascata somada à revelação faria a mesma linha
 * animar duas vezes. A partir da primeira troca de `chave`, cada troca remonta
 * o cartão e as linhas descem com o `palco`, igual à entrada da lista de
 * orçamentos.
 *
 * Remontar é o ponto: sem a chave, o React reaproveitaria as linhas que estão
 * nos dois resultados (o cliente sumido há 100 dias está no corte de 60 e no
 * de 90), e só as novas animariam — uma cascata com buracos.
 *
 * O vazio passa por aqui também, para o componente continuar montado quando um
 * corte não tem ninguém; senão a lista voltaria sem cascata depois dele.
 */
export function CascataAoFiltrar({
  chave,
  vazio,
  className = "",
  children,
}: {
  chave: string;
  /** O que mostrar no lugar do cartão quando o filtro não traz ninguém. */
  vazio?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [anterior, setAnterior] = useState(chave);
  const [filtrou, setFiltrou] = useState(false);

  // Ajuste de estado durante a renderização, o caminho que o React recomenda
  // para reagir a uma prop: um efeito pintaria um quadro sem a cascata antes.
  if (chave !== anterior) {
    setAnterior(chave);
    setFiltrou(true);
  }

  if (vazio) return vazio;

  return (
    <Cartao key={chave} className={`${filtrou ? "palco" : ""} ${className}`}>
      {children}
    </Cartao>
  );
}
