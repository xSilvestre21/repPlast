"use client";

/**
 * Uma pergunta com poucas respostas, todas à vista, cada uma dizendo o que é.
 *
 * O `Segmentado` serve a um filtro: três palavras numa fileira. Aqui a
 * resposta muda o que a pessoa vai fazer em seguida ("recebi", "não foi pago",
 * "recebo em parcelas"), e uma palavra só não basta — cada cartão leva o
 * título e uma linha explicando. Quem errava no acerto errava por não saber
 * que os outros caminhos existiam: eram links miúdos no rodapé do painel.
 *
 * É um grupo de rádio de verdade: uma parada no Tab, as setas trocam.
 */

import { ChevronRight, type LucideIcon } from "lucide-react";
import { useRef } from "react";

export type Escolha<T extends string> = {
  valor: T;
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  /**
   * A resposta abre outra tela, em vez de mostrar os campos embaixo. O cartão
   * ganha a seta para a direita, que diz isso antes do clique.
   */
  leva?: boolean;
};

export function Escolhas<T extends string>({
  nome,
  atual,
  aoEscolher,
  opcoes,
}: {
  /** A pergunta, para quem navega por leitor de tela. */
  nome: string;
  /** `null`: ninguém escolheu ainda. */
  atual: T | null;
  aoEscolher: (valor: T) => void;
  opcoes: Escolha<T>[];
}) {
  const grupo = useRef<HTMLDivElement>(null);

  function andar(de: number, passo: number) {
    const para = (de + passo + opcoes.length) % opcoes.length;
    aoEscolher(opcoes[para].valor);
    grupo.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[para]?.focus();
  }

  return (
    <div
      ref={grupo}
      role="radiogroup"
      aria-label={nome}
      // Lado a lado quando cabem; no celular, um embaixo do outro, cada um da
      // largura da folha.
      className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr"
    >
      {opcoes.map((opcao, i) => {
        const marcada = opcao.valor === atual;
        const Glifo = opcao.icone;

        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={marcada}
            data-valor={opcao.valor}
            // Uma parada só no Tab: a marcada, ou a primeira quando não há.
            tabIndex={marcada || (atual === null && i === 0) ? 0 : -1}
            onClick={() => aoEscolher(opcao.valor)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                andar(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                andar(i, -1);
              }
            }}
            // O marcado se vê de longe: borda dupla (a borda e o anel) e a
            // bolinha preenchida. Só o fundo azul a 9% passava despercebido.
            className={`flex items-start gap-3 rounded-suave border px-3.5 py-3 text-left cursor-pointer
              transition-colors duration-200 ${
                marcada
                  ? "border-carimbo ring-1 ring-carimbo bg-carimbo-fraco"
                  : "border-filete-forte bg-folha hover:border-tinta-3"
              }`}
          >
            {/* A bolinha de rádio, a marca que todo formulário usa para "escolha uma". */}
            <span
              aria-hidden="true"
              className={`shrink-0 mt-0.5 grid place-items-center size-[18px] rounded-full border-2 transition-colors ${
                marcada ? "border-carimbo" : "border-tinta-3"
              }`}
            >
              {marcada && <span className="size-2 rounded-full bg-carimbo" />}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-corpo font-semibold text-tinta">
                <Glifo
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={`shrink-0 ${marcada ? "text-carimbo" : "text-tinta-2"}`}
                />
                {opcao.titulo}
              </span>
              <span className="block text-rotulo text-tinta-2 leading-snug mt-0.5">{opcao.descricao}</span>
            </span>
            {opcao.leva && (
              <ChevronRight
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="shrink-0 ml-auto self-center text-tinta-3"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
