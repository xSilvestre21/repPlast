import { ViewTransition } from "react";

import { DIRECOES } from "@/components/pagina";

/**
 * O que a tela mostra entre o clique e o dado.
 *
 * Este arquivo é a razão de a navegação parecer instantânea. Toda página aqui
 * embaixo é dinâmica e consulta o banco — sem ele, o Next segura a tela ANTIGA
 * até a consulta voltar, e o clique na aba fica sem resposta por meio segundo.
 * Com ele a rota troca na hora: a aba acende, a pílula preta desliza, e o
 * esqueleto entra pelo lado enquanto o servidor trabalha.
 *
 * O esqueleto é DELIBERADAMENTE genérico. Ele vale para as seis abas, e
 * desenhar aqui a silhueta exata do Painel faria as outras cinco piscarem uma
 * forma que não é a delas — o que é pior do que uma forma neutra, porque
 * promete um layout e entrega outro.
 *
 * Entrada e saída acompanham a direção da aba, com o mesmo tipo — nunca um
 * movimento vertical à parte. Para o olho, o esqueleto É a página: ele entra
 * pelo lado com ela e sai pelo lado quando cede o lugar ao conteúdo real.
 */
export default function Carregando() {
  return (
    <ViewTransition enter={DIRECOES} exit={DIRECOES} default="none">
      {/*
        `aria-busy` e o texto escondido são o que o leitor de tela recebe. O
        brilho que varre os blocos não existe para ele, e uma tela que fica em
        silêncio por meio segundo não tem como ser distinguida de uma que
        travou.
      */}
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Carregando…</span>

        {/* O cabeçalho: título e linha de apoio. */}
        <div className="mb-7">
          <div className="esqueleto h-9 w-52 sm:h-11 sm:w-64" />
          <div className="esqueleto h-4 w-full max-w-lg mt-4" />
        </div>

        <div className="space-y-5">
          {/* O bloco principal. */}
          <div className="esqueleto h-44 sm:h-52 rounded-grande" />

          {/* A fila de apoio. */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="esqueleto h-32 rounded-folha" />
            <div className="esqueleto h-32 rounded-folha" />
            <div className="esqueleto h-32 rounded-folha" />
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}
