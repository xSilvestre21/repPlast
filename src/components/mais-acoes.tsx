"use client";

/**
 * As ações de uma ficha que não são do dia a dia, recolhidas no celular.
 *
 * A ficha do pedido tinha sete botões no topo — Baixar PDF, Enviar, Tornar
 * amostra, Marcar como enviado, Duplicar, Cancelar, Apagar. No computador eles
 * cabem numa linha; no celular em pé, empilhados, ocupavam a primeira tela
 * inteira, e o cliente e os itens só apareciam depois de rolar.
 *
 * Na tela larga as ações aparecem no lugar, como sempre. No celular viram um
 * botão "Mais ações" que abre a folha que sobe de baixo, com elas uma embaixo da
 * outra — o padrão do menu "⋯" dos apps.
 *
 * `max-sm:hidden` no grupo da tela larga: antes de a página hidratar o
 * navegador ainda não sabe que é celular, e sem isto os botões apareceriam
 * empilhados por um instante antes de recolher.
 */

import { Ellipsis } from "lucide-react";
import { type ReactNode, useState } from "react";

import { FolhaDeBaixo } from "./folha-de-baixo";
import { useTelaEstreita } from "./tela-estreita";
import { Botao } from "./ui";

export function MaisAcoes({ titulo, children }: { titulo: string; children: ReactNode }) {
  const estreita = useTelaEstreita();
  const [aberto, setAberto] = useState(false);

  if (!estreita) return <div className="contents max-sm:hidden">{children}</div>;

  return (
    <>
      <Botao type="button" variante="secundaria" icone={Ellipsis} onClick={() => setAberto(true)}>
        Mais ações
      </Botao>
      <FolhaDeBaixo aberto={aberto} aoFechar={() => setAberto(false)} titulo={titulo}>
        <div className="flex flex-col items-start gap-2.5">{children}</div>
      </FolhaDeBaixo>
    </>
  );
}
