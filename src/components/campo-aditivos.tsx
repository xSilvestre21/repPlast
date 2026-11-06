"use client";

import { useMemo } from "react";

import { SelecaoEtiquetas } from "./selecao-etiquetas";
import { formatarMoeda } from "./ui";
import type { Aditivo } from "@/lib/precificacao";

/**
 * Os aditivos da indústria, no cadastro de produto e na conta da proposta.
 *
 * Uma indústria chega a ter quase trinta. Sem grupos naturais, a lista inteira fica
 * atrás de um "ver todos", e digitar acha pelo nome ou pelo sufixo.
 */
export function CampoAditivos({
  aditivos,
  marcados,
  aoAlternar,
  ocultarRotulo = false,
}: {
  aditivos: readonly (Aditivo & { id: string })[];
  marcados: readonly string[];
  aoAlternar: (id: string) => void;
  ocultarRotulo?: boolean;
}) {
  const grupos = useMemo(
    () => [
      {
        titulo: `Ver todos (${aditivos.length})`,
        opcoes: aditivos.map((a) => ({
          id: a.id,
          rotulo: a.nome,
          detalhe: `+${formatarMoeda(Number(a.valor))}${a.tipo === "POR_KG" ? "/kg" : "/mil"}`,
          busca: a.sufixoDescricao,
        })),
      },
    ],
    [aditivos],
  );

  const marcadas = useMemo(() => new Set(marcados), [marcados]);

  return (
    <>
      {/* Só os que estão na lista: marcado que saiu dela não pode ir escondido. */}
      {aditivos
        .filter((a) => marcadas.has(a.id))
        .map((a) => (
          <input key={a.id} type="hidden" name="aditivos" value={a.id} />
        ))}

      <SelecaoEtiquetas
        rotulo="Aditivos"
        ocultarRotulo={ocultarRotulo}
        grupos={grupos}
        marcadas={marcadas}
        aoAlternar={aoAlternar}
        placeholder="Buscar aditivo…"
      />
    </>
  );
}
