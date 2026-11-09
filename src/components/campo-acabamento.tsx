"use client";

import { useMemo } from "react";

import { useCampoDoFormulario } from "./contexto-formulario";
import { SelecaoEtiquetas } from "./selecao-etiquetas";
import { Campo, RodapeCampo, formatarMoeda } from "./ui";
import { achatar } from "@/lib/busca";
import type { GrupoComplemento } from "@/lib/complemento";
import type { MarcaMaoDeObra, opcoesDeMaoDeObra } from "@/lib/produto-preco";
import type { CamposDaEmbalagem } from "@/lib/tipos-produto";

type AoMudar = (campo: keyof CamposDaEmbalagem, valor: string) => void;

const VALORES = [
  { campo: "acabamentoValorCom", rotulo: "Valor com mão de obra", exemplo: "150,00" },
  { campo: "acabamentoValorSem", rotulo: "Valor sem mão de obra", exemplo: "90,00" },
] as const;

/**
 * O acabamento de frasco e bombona, no mesmo seletor dos complementos e aditivos,
 * com uma diferença: marca-se um só, porque o que é rotulado não é serigrafado.
 * Marcar outro troca o anterior, em qualquer grupo.
 *
 * O cadastro diz qual é o acabamento e guarda os dois valores. Com ou sem mão de
 * obra se decide ao lançar cada item (`AcabamentoDoItem`).
 *
 * A lista não prende ninguém: a busca que não acha nada oferece usar o que foi
 * digitado, e o nome que veio assim continua na caixa ao reabrir o produto.
 */
export function CampoAcabamento({
  grupos,
  valores,
  aoMudar,
  ocultarRotulo = false,
}: {
  grupos: readonly GrupoComplemento[];
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
  /** Dentro do cartão "Acabamento", o rótulo só repetiria. */
  ocultarRotulo?: boolean;
}) {
  const { acabamento } = valores;

  // Todos de uma opção só: marcar já fecha o grupo, como na cor.
  const etiquetas = useMemo(
    () =>
      grupos.map((g) => ({
        titulo: g.titulo,
        umaSo: true,
        opcoes: g.opcoes.map((opcao) => ({ id: opcao, rotulo: opcao })),
      })),
    [grupos],
  );

  const naLista = grupos.some((g) => g.opcoes.includes(acabamento));
  const marcadas = useMemo(
    () => new Set(naLista && acabamento ? [acabamento] : []),
    [naLista, acabamento],
  );

  /** O valor de um acabamento não serve para outro: trocar recomeça os dois. */
  function definir(nome: string) {
    if (achatar(nome) === achatar(acabamento)) return;
    aoMudar("acabamento", nome);
    aoMudar("acabamentoValorCom", "");
    aoMudar("acabamentoValorSem", "");
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="acabamento" value={acabamento} />

      <SelecaoEtiquetas
        rotulo="Acabamento"
        ocultarRotulo={ocultarRotulo}
        grupos={etiquetas}
        marcadas={marcadas}
        aoAlternar={(opcao) => definir(opcao === acabamento ? "" : opcao)}
        escolhaUnica
        digitado={naLista ? "" : acabamento}
        aoDigitar={definir}
        placeholder="Buscar ou digitar outro…"
      />

      {acabamento && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
          {VALORES.map(({ campo, rotulo, exemplo }) => (
            <Campo
              key={campo}
              name={campo}
              rotulo={rotulo}
              sufixo="R$"
              numero="decimal"
              placeholder={exemplo}
              value={valores[campo]}
              onChange={(e) => aoMudar(campo, e.target.value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * O acabamento no lançamento do item.
 *
 * Qual é o acabamento vem do cadastro, e aqui só se lê. O que a linha escolhe é com
 * ou sem mão de obra. A borda transparente deixa o texto na altura das opções.
 */
export function AcabamentoDoItem({
  acabamento,
  opcoes,
  value,
  aoMudar,
}: {
  acabamento: string;
  opcoes: ReturnType<typeof opcoesDeMaoDeObra>;
  value: string;
  aoMudar: (marca: MarcaMaoDeObra) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
      <p className="border border-transparent py-2 pointer-coarse:py-2.5 text-corpo text-tinta-2">
        Acabamento: <span className="text-tinta">{acabamento}</span>
      </p>

      <EscolhaMaoDeObra
        acabamento={acabamento}
        opcoes={opcoes}
        value={value}
        aoMudar={aoMudar}
      />
    </div>
  );
}

/**
 * Qual dos valores do acabamento esta linha cobra.
 *
 * Com um valor só no cadastro, ele já vem marcado. Com os dois, nenhum: o preço
 * depende disso, e a pessoa precisa dizer.
 */
export function EscolhaMaoDeObra({
  acabamento,
  opcoes,
  value,
  aoMudar,
}: {
  acabamento: string;
  opcoes: ReturnType<typeof opcoesDeMaoDeObra>;
  value: string;
  aoMudar: (marca: MarcaMaoDeObra) => void;
}) {
  const { erro } = useCampoDoFormulario("acabamentoMaoDeObra");

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Mão de obra de {acabamento}</legend>

      <div className="flex flex-wrap gap-2">
        {opcoes.map(({ marca, rotulo, valor }) => {
          const marcada = value === marca;

          return (
            <label
              key={marca}
              className={`flex items-center gap-2 rounded-suave border px-3 py-2 pointer-coarse:py-2.5
                text-corpo cursor-pointer transition-colors ${
                  marcada
                    ? "border-carimbo bg-carimbo-fraco text-tinta"
                    : "border-filete hover:border-filete-forte text-tinta-2"
                }`}
            >
              <input
                type="radio"
                name="acabamentoMaoDeObra"
                value={marca}
                required
                checked={marcada}
                onChange={() => aoMudar(marca)}
                className="accent-carimbo"
              />
              {rotulo}
              <span className="text-mini text-tinta-3 numerico">
                +{formatarMoeda(valor.toString())}/mil
              </span>
            </label>
          );
        })}
      </div>

      <RodapeCampo erro={erro} />
    </fieldset>
  );
}
