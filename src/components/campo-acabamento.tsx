"use client";

import { useMemo, useState } from "react";

import { BuscaEtiquetas, LIMITE_SEM_BUSCA } from "./busca-etiquetas";
import { useCampoDoFormulario } from "./contexto-formulario";
import { Campo, RodapeCampo, formatarMoeda } from "./ui";
import { achatar } from "@/lib/busca";
import { type GrupoComplemento, gruposVisiveis } from "@/lib/complemento";
import type { MarcaMaoDeObra, opcoesDeMaoDeObra } from "@/lib/produto-preco";
import type { CamposDaEmbalagem } from "@/lib/tipos-produto";

type AoMudar = (campo: keyof CamposDaEmbalagem, valor: string) => void;

const VALORES = [
  { campo: "acabamentoValorCom", rotulo: "Valor com mão de obra", exemplo: "150,00" },
  { campo: "acabamentoValorSem", rotulo: "Valor sem mão de obra", exemplo: "90,00" },
] as const;

/**
 * O acabamento de frasco e bombona, nas etiquetas dos aditivos, com uma diferença:
 * marca-se um só, porque o que é rotulado não é serigrafado.
 *
 * O cadastro diz qual é o acabamento e guarda os dois valores. Com ou sem mão de
 * obra se decide ao lançar cada item (`AcabamentoDoItem`).
 *
 * A lista não prende ninguém: a busca que não acha nada oferece usar o que foi
 * digitado, e o nome que veio assim continua na tela ao reabrir o produto.
 */
export function CampoAcabamento({
  grupos,
  valores,
  aoMudar,
}: {
  grupos: readonly GrupoComplemento[];
  valores: CamposDaEmbalagem;
  aoMudar: AoMudar;
}) {
  const [busca, setBusca] = useState("");
  const { acabamento } = valores;

  const todos = useMemo(() => {
    const naLista = grupos.some((g) => g.opcoes.includes(acabamento));
    return acabamento && !naLista
      ? [...grupos, { titulo: "Outro", opcoes: [acabamento] }]
      : grupos;
  }, [grupos, acabamento]);

  const visiveis = useMemo(
    () => gruposVisiveis(todos, busca, new Set([acabamento])),
    [todos, busca, acabamento],
  );

  const total = grupos.reduce((soma, grupo) => soma + grupo.opcoes.length, 0);
  const digitado = busca.trim();
  const semOutraOpcao = visiveis.every((g) => g.opcoes.every((o) => o === acabamento));
  const podeUsarDigitado =
    digitado !== "" && semOutraOpcao && achatar(digitado) !== achatar(acabamento);

  /** O valor de um acabamento não serve para outro: trocar recomeça os dois. */
  function escolher(nome: string) {
    aoMudar("acabamento", nome === acabamento ? "" : nome);
    aoMudar("acabamentoValorCom", "");
    aoMudar("acabamentoValorSem", "");
    setBusca("");
  }

  return (
    <div className="space-y-2.5">
      {total > LIMITE_SEM_BUSCA && (
        <BuscaEtiquetas
          rotulo="Buscar acabamento"
          placeholder="Buscar acabamento, como “rótulo” ou “sleeve”"
          value={busca}
          onChange={setBusca}
        />
      )}

      {podeUsarDigitado && (
        <button
          type="button"
          onClick={() => escolher(digitado)}
          className="text-corpo text-carimbo hover:underline cursor-pointer"
        >
          Usar &ldquo;{digitado}&rdquo; como acabamento
        </button>
      )}

      {visiveis.map((grupo) => (
        <div
          key={grupo.titulo}
          role="group"
          aria-label={grupo.titulo}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="w-full sm:w-24 shrink-0 text-mini text-tinta-3">{grupo.titulo}</span>

          {grupo.opcoes.map((opcao) => {
            const marcada = opcao === acabamento;

            return (
              <label
                key={opcao}
                className={`flex items-center gap-2 rounded-suave border px-3 py-2 text-corpo cursor-pointer transition-colors ${
                  marcada
                    ? "border-carimbo bg-carimbo-fraco text-tinta"
                    : "border-filete hover:border-filete-forte text-tinta-2"
                }`}
              >
                <input
                  type="checkbox"
                  name="acabamento"
                  value={opcao}
                  checked={marcada}
                  onChange={() => escolher(opcao)}
                  className="accent-carimbo"
                />
                {opcao}
              </label>
            );
          })}
        </div>
      ))}

      {acabamento && (
        <div className="grid gap-3 sm:grid-cols-2 max-w-xl pt-1">
          {VALORES.map(({ campo, rotulo, exemplo }) => (
            <Campo
              key={campo}
              name={campo}
              rotulo={rotulo}
              sufixo="R$"
              inputMode="decimal"
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
