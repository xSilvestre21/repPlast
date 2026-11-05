"use client";

/**
 * O preposto das listas de clientes, pedidos e orçamentos: "Todos" ou um.
 *
 * Sem opções, não aparece: é o preposto logado (a lista dele já é só dele) e o
 * plano Solo (`filtroDePreposto`, em `clientes/carteira.ts`).
 */

import { SelecaoBuscavel } from "@/components/selecao-buscavel";

export function FiltroPreposto({
  prepostos,
  value,
  aoEscolher,
}: {
  prepostos: { id: string; nome: string }[];
  /** O id do preposto escolhido, ou vazio em "Todos". */
  value: string;
  aoEscolher: (id: string) => void;
}) {
  if (prepostos.length === 0) return null;

  return (
    <SelecaoBuscavel
      name="preposto"
      rotulo="Preposto"
      opcoes={[
        { id: "", rotulo: "Todos os prepostos" },
        ...prepostos.map((preposto) => ({ id: preposto.id, rotulo: preposto.nome })),
      ]}
      value={value}
      aoEscolher={aoEscolher}
      placeholder="Digite o nome do preposto"
      vazio="Nenhum preposto com esse nome."
      lado="baixo"
      className="w-full sm:w-72"
    />
  );
}
