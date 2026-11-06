"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { LIMITE_SEM_BUSCA } from "./busca-etiquetas";
import { FolhaDeBaixo } from "./folha-de-baixo";
import { useTelaEstreita } from "./tela-estreita";
import { Botao, RodapeCampo, Rotulo } from "./ui";
import { casaComTermos, termosDaBusca } from "@/lib/busca";

export type OpcaoEtiqueta = {
  id: string;
  rotulo: string;
  /** O preço do aditivo, ao lado do nome. */
  detalhe?: string;
  /** Mais texto que a busca alcança e a tela não mostra. */
  busca?: string;
};

export type GrupoEtiquetas = {
  titulo: string;
  /** Aceita uma opção só: marcar fecha o grupo, porque ali não há mais o que fazer. */
  umaSo?: boolean;
  opcoes: readonly OpcaoEtiqueta[];
};

const CLASSE_ETIQUETA =
  "inline-flex items-center gap-2 rounded-suave border px-3 py-1.5 pointer-coarse:py-2.5 " +
  "text-corpo cursor-pointer transition-colors";

/**
 * A escolha de várias opções numa lista grande, sem mostrar a lista.
 *
 * Etiqueta serve para pouca coisa: com quarenta na tela, ninguém as lê, e no celular
 * elas empurram o resto do formulário. Aqui a tela mostra só o que foi marcado e o
 * nome dos grupos. Abrir um grupo mostra o dele, um de cada vez, e digitar acha em
 * todos.
 *
 * No computador o grupo abre ali mesmo, embaixo dos nomes. No celular os nomes
 * quebram em várias linhas, e abrir ali jogava as opções para longe de onde se
 * tocou: lá ele sobe numa folha, perto do polegar, em linhas que o dedo acerta.
 *
 * Com poucas opções e um grupo só, a lista cabe na tela e fica aberta.
 *
 * Quem chama cuida do valor: este componente só diz o que foi marcado e tirado.
 */
export function SelecaoEtiquetas({
  rotulo,
  ocultarRotulo = false,
  grupos,
  marcadas,
  aoAlternar,
  digitado = "",
  aoDigitar,
  placeholder = "Buscar",
  dica,
  className = "",
}: {
  rotulo: string;
  /** Dentro de um cartão com o mesmo título, o rótulo só repetiria. */
  ocultarRotulo?: boolean;
  grupos: readonly GrupoEtiquetas[];
  marcadas: ReadonlySet<string>;
  aoAlternar: (id: string) => void;
  /** O que foi escrito fora das opções. */
  digitado?: string;
  /** Presente, o que a lista não tem pode ser usado como foi digitado. */
  aoDigitar?: (texto: string) => void;
  placeholder?: string;
  dica?: string;
  className?: string;
}) {
  const [busca, setBusca] = useState("");
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  /** O grupo que a folha mostra: fica depois de fechar, enquanto ela desce. */
  const [grupoNaFolha, setGrupoNaFolha] = useState<string | null>(null);
  const estreita = useTelaEstreita();

  const campoRef = useRef<HTMLInputElement>(null);
  const idCampo = useId();
  const idPainel = useId();

  const todas = useMemo(() => grupos.flatMap((g) => g.opcoes), [grupos]);
  const escolhidas = todas.filter((o) => marcadas.has(o.id));

  const texto = busca.trim();
  const resultados = useMemo(() => {
    const termos = termosDaBusca(texto);
    return grupos.flatMap((grupo) =>
      grupo.opcoes.filter((o) =>
        casaComTermos(`${grupo.titulo} ${o.rotulo} ${o.busca ?? ""}`, termos),
      ),
    );
  }, [grupos, texto]);

  /** Cabe na tela: nem caixa de busca nem grupo a abrir. */
  const cabeNaTela = grupos.length === 1 && todas.length <= LIMITE_SEM_BUSCA && !aoDigitar;

  const grupo = grupos.find((g) => g.titulo === grupoAberto);
  const naFolha = grupos.find((g) => g.titulo === grupoNaFolha);

  /** Com um grupo só, o nome dele é um "ver todos": o título da folha é o do campo. */
  const umGrupoSo = grupos.length === 1;

  function abrirGrupo(titulo: string) {
    setGrupoAberto(titulo === grupoAberto ? null : titulo);
    setGrupoNaFolha(titulo);
  }

  function usarDigitado() {
    aoDigitar?.([digitado, texto].filter(Boolean).join(" "));
    setBusca("");
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Enter") {
      // Enter aqui é "achei", nunca "salvar o produto".
      evento.preventDefault();
      if (!texto) return;

      const primeira = resultados.find((o) => !marcadas.has(o.id));
      if (primeira) {
        aoAlternar(primeira.id);
        setBusca("");
      } else if (resultados.length === 0 && aoDigitar) {
        usarDigitado();
      }
      return;
    }

    if (evento.key === "Escape") {
      if (busca) setBusca("");
      else setGrupoAberto(null);
      return;
    }

    if (evento.key === "Backspace" && busca === "") {
      if (digitado) aoDigitar?.("");
      else if (escolhidas.length > 0) aoAlternar(escolhidas[escolhidas.length - 1].id);
    }
  }

  function marcar(opcao: OpcaoEtiqueta, origem?: GrupoEtiquetas) {
    const vaiMarcar = !marcadas.has(opcao.id);
    aoAlternar(opcao.id);

    if (texto) {
      setBusca("");
      campoRef.current?.focus();
    } else if (origem?.umaSo && vaiMarcar) {
      setGrupoAberto(null);
    }
  }

  const etiqueta = (opcao: OpcaoEtiqueta, origem?: GrupoEtiquetas) => {
    const marcada = marcadas.has(opcao.id);

    return (
      <button
        key={opcao.id}
        type="button"
        aria-pressed={marcada}
        onClick={() => marcar(opcao, origem)}
        className={`${CLASSE_ETIQUETA} ${
          marcada
            ? "border-carimbo bg-carimbo-fraco text-tinta"
            : "border-filete hover:border-filete-forte text-tinta-2"
        }`}
      >
        {opcao.rotulo}
        {opcao.detalhe && (
          <span className="text-mini text-tinta-3 numerico">{opcao.detalhe}</span>
        )}
      </button>
    );
  };

  /** Na folha, cada opção é uma linha inteira: etiqueta miúda não serve ao polegar. */
  const linha = (opcao: OpcaoEtiqueta, origem: GrupoEtiquetas) => {
    const marcada = marcadas.has(opcao.id);

    return (
      <button
        key={opcao.id}
        type="button"
        aria-pressed={marcada}
        onClick={() => marcar(opcao, origem)}
        className={`flex items-center gap-3 w-full min-h-12 px-3 py-2.5 rounded-suave text-left
          text-corpo cursor-pointer transition-colors ${
            marcada ? "bg-carimbo-fraco text-tinta" : "text-tinta-2 active:bg-folha-2"
          }`}
      >
        <span className="flex-1 min-w-0">{opcao.rotulo}</span>
        {opcao.detalhe && (
          <span className="shrink-0 text-mini text-tinta-3 numerico">{opcao.detalhe}</span>
        )}
        <Check
          size={16}
          strokeWidth={2.5}
          aria-hidden="true"
          className={`shrink-0 text-carimbo ${marcada ? "" : "invisible"}`}
        />
      </button>
    );
  };

  if (cabeNaTela) {
    return (
      <div className={className}>
        {!ocultarRotulo && <Rotulo>{rotulo}</Rotulo>}
        <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
          {todas.map((o) => etiqueta(o))}
        </div>
        <RodapeCampo dica={dica} />
      </div>
    );
  }

  const fichas = [
    ...escolhidas.map((o) => ({ id: o.id, rotulo: o.rotulo, tirar: () => aoAlternar(o.id) })),
    ...(digitado ? [{ id: "digitado", rotulo: digitado, tirar: () => aoDigitar?.("") }] : []),
  ];

  return (
    <div className={className}>
      {!ocultarRotulo && (
        <label htmlFor={idCampo}>
          <Rotulo>{rotulo}</Rotulo>
        </label>
      )}

      {/* A caixa é o campo inteiro: o que está marcado e o lugar de digitar, juntos. */}
      <div
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) campoRef.current?.focus();
        }}
        className="flex flex-wrap items-center gap-1.5 px-1.5 py-1.5 rounded-suave bg-folha-2
          border border-transparent cursor-text transition-[background-color,border-color,box-shadow]
          duration-150 hover:border-filete focus-within:bg-folha focus-within:border-carimbo
          focus-within:ring-4 focus-within:ring-carimbo-fraco"
      >
        {fichas.map((ficha) => (
          <span
            key={ficha.id}
            className="inline-flex items-center gap-1 max-w-full rounded-miudo bg-folha
              border border-filete pl-2 text-corpo text-tinta"
          >
            <span className="truncate">{ficha.rotulo}</span>
            <button
              type="button"
              onClick={ficha.tirar}
              aria-label={`Tirar ${ficha.rotulo}`}
              className="p-1 pointer-coarse:p-1.5 text-tinta-3 hover:text-tinta cursor-pointer
                rounded-miudo transition-colors"
            >
              <X size={13} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </span>
        ))}

        <input
          ref={campoRef}
          id={idCampo}
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          aria-label={ocultarRotulo ? rotulo : undefined}
          aria-describedby={dica ? `${idCampo}-rodape` : undefined}
          placeholder={placeholder}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={aoTeclar}
          className="flex-1 min-w-44 px-2 py-1 bg-transparent text-corpo text-tinta outline-none
            placeholder:text-tinta-3"
        />
      </div>

      <RodapeCampo dica={dica} id={`${idCampo}-rodape`} />

      {texto ? (
        <div
          role="group"
          aria-label={`Resultado da busca em ${rotulo}`}
          className="flex flex-wrap items-center gap-2 mt-2 max-h-56 overflow-y-auto"
        >
          {resultados.map((o) => etiqueta(o))}

          {resultados.length === 0 &&
            (aoDigitar ? (
              <button
                type="button"
                onClick={usarDigitado}
                className="py-1.5 text-corpo text-carimbo hover:underline cursor-pointer"
              >
                Usar &ldquo;{texto}&rdquo;
              </button>
            ) : (
              <p className="text-corpo text-tinta-3">Nada com &ldquo;{texto}&rdquo;.</p>
            ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 mt-1.5 -ml-1">
            {grupos.map((g) => {
              const aberto = g.titulo === grupoAberto;
              const usado = g.opcoes.some((o) => marcadas.has(o.id));

              return (
                <button
                  key={g.titulo}
                  type="button"
                  aria-expanded={aberto}
                  aria-haspopup={estreita ? "dialog" : undefined}
                  aria-controls={aberto && !estreita ? idPainel : undefined}
                  onClick={() => abrirGrupo(g.titulo)}
                  className={`inline-flex items-center gap-1 rounded-suave px-2 py-1.5
                    pointer-coarse:py-2.5 text-corpo cursor-pointer transition-colors
                    hover:bg-folha-2 ${aberto ? "bg-folha-2" : ""} ${
                      usado || aberto ? "text-tinta" : "text-tinta-2"
                    }`}
                >
                  {usado && (
                    <Check size={13} strokeWidth={2.5} aria-hidden="true" className="text-carimbo" />
                  )}
                  {g.titulo}
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    aria-hidden="true"
                    className={`text-tinta-3 transition-transform duration-150 ${
                      aberto ? "rotate-180" : ""
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {grupo && !estreita && (
            <div
              id={idPainel}
              role="group"
              aria-label={grupo.titulo}
              className="flex flex-wrap gap-2 mt-1.5 max-h-56 overflow-y-auto"
            >
              {grupo.opcoes.map((o) => etiqueta(o, grupo))}
            </div>
          )}
        </>
      )}

      {estreita && (
        <FolhaDeBaixo
          aberto={grupo !== undefined}
          aoFechar={() => setGrupoAberto(null)}
          titulo={umGrupoSo ? rotulo : (naFolha?.titulo ?? rotulo)}
          descricao={umGrupoSo ? undefined : rotulo}
        >
          {naFolha && (
            <div role="group" aria-label={umGrupoSo ? rotulo : naFolha.titulo} className="space-y-0.5">
              {naFolha.opcoes.map((o) => linha(o, naFolha))}
            </div>
          )}

          {/*
            Com uma opção só, marcar já fecha; com várias, quem decide é a pessoa. Fica
            preso ao pé da folha: numa lista longa, ele não pode depender de rolar até o fim.
          */}
          {!naFolha?.umaSo && (
            <div
              className="sticky bottom-0 -mx-4 -mb-5 mt-3 px-4 pt-3
                pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-folha border-t border-filete"
            >
              <Botao
                type="button"
                variante="secundaria"
                className="w-full"
                onClick={() => setGrupoAberto(null)}
              >
                Pronto
              </Botao>
            </div>
          )}
        </FolhaDeBaixo>
      )}
    </div>
  );
}
