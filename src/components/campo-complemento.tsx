"use client";

import { useMemo } from "react";

import { Campo } from "./ui";
import { SelecaoEtiquetas } from "./selecao-etiquetas";
import {
  type GrupoComplemento,
  alternarOpcao,
  comTextoDigitado,
  opcoesMarcadas,
  textoDigitado,
} from "@/lib/complemento";

/**
 * O complemento: texto, com as opções prontas por grupo.
 *
 * O texto é o que vale, e é ele que vai no formulário: as etiquetas só escrevem
 * nele, e o que a lista não tem entra como foi digitado. Sem grupos, é só o campo.
 */
export function CampoComplemento({
  name = "complemento",
  rotulo = "Complemento",
  grupos,
  value,
  aoMudar,
  dica,
  placeholder,
  className = "",
}: {
  name?: string;
  rotulo?: string;
  grupos: readonly GrupoComplemento[];
  value: string;
  aoMudar: (texto: string) => void;
  dica?: string;
  placeholder?: string;
  className?: string;
}) {
  const marcadas = useMemo(() => opcoesMarcadas(value, grupos), [value, grupos]);

  const etiquetas = useMemo(
    () =>
      grupos.map((g) => ({
        titulo: g.titulo,
        umaSo: g.umaSo,
        opcoes: g.opcoes.map((opcao) => ({ id: opcao, rotulo: opcao })),
      })),
    [grupos],
  );

  if (grupos.length === 0) {
    return (
      <Campo
        name={name}
        rotulo={rotulo}
        dica={dica}
        placeholder={placeholder}
        value={value}
        onChange={(e) => aoMudar(e.target.value)}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      <input type="hidden" name={name} value={value} />
      <SelecaoEtiquetas
        rotulo={rotulo}
        grupos={etiquetas}
        marcadas={marcadas}
        aoAlternar={(opcao) => aoMudar(alternarOpcao(value, grupos, opcao))}
        digitado={textoDigitado(value, grupos)}
        aoDigitar={(texto) => aoMudar(comTextoDigitado(value, grupos, texto))}
        placeholder="Buscar ou digitar outro…"
        dica={dica}
      />
    </div>
  );
}
