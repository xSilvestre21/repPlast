"use client";

/**
 * Janela por cima da página.
 *
 * O `<dialog>` nativo com `showModal()` já faz o que um modal precisa e que é
 * fácil errar à mão: prende o foco dentro, fecha no Esc, deixa o resto da
 * página inerte para leitor de tela e desenha o fundo escurecido. Aqui só se
 * põe a casca visual e a ponte com o estado do React.
 *
 * O conteúdo só existe enquanto está aberto — fechar e abrir de novo começa do
 * zero, que é o que se espera de um formulário que foi cancelado.
 */

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

import { abrirModal } from "./modal";

const LARGURAS = {
  estreita: "w-[min(28rem,calc(100vw-2rem))]",
  normal: "w-[min(42rem,calc(100vw-2rem))]",
  larga: "w-[min(56rem,calc(100vw-2rem))]",
};

export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  descricao,
  estreito = false,
  largo = false,
  fecharNoFundo = true,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  /** Para a pergunta de sim ou não: a largura de formulário a deixava perdida. */
  estreito?: boolean;
  /** Para o formulário de uma linha da apuração: três cartões lado a lado e a grade das parcelas. */
  largo?: boolean;
  /**
   * Falso onde se digita bastante: um clique escapado fora da caixa jogava fora
   * o que foi digitado. Aí fecham o X, o Esc e o botão de fechar de quem usa.
   */
  fecharNoFundo?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  /*
   * Um id por janela. Era fixo, "dialogo-titulo": com a pergunta "Desfazer o
   * acerto?" aberta POR CIMA da janela do acerto, as duas apontavam para o
   * primeiro título da página, e o leitor de tela anunciava o errado.
   */
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;

    if (aberto && !dialogo.open) {
      /*
       * O `showModal()` põe o foco no primeiro elemento focável — que é o X de
       * fechar, no cabeçalho. Quem abre um formulário e já sai digitando
       * apertaria o X no primeiro espaço. O `autoFocus` do React não ajuda: ele
       * roda antes do `showModal()` e perde para ele. Então o conteúdo marca o
       * campo certo com `data-autofocus`, e o `abrirModal` leva o foco até ele —
       * ou, sem campo marcado, para a caixa (`modal.ts`).
       */
      abrirModal(dialogo);
    }
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  const largura = LARGURAS[estreito ? "estreita" : largo ? "larga" : "normal"];

  return (
    <dialog
      ref={ref}
      // Esc e o `close()` acima chegam aqui; é o que devolve o estado ao React.
      // Só o fechamento DESTA janela: o React faz o `close` de uma janela de
      // dentro (o "tem certeza?" aberto por cima) subir até esta, e o
      // "Cancelar" da pergunta fechava as duas.
      onClose={(evento) => {
        if (evento.target === ref.current) aoFechar();
      }}
      // Clique no fundo escurecido fecha. O alvo só é o próprio <dialog> quando
      // o clique cai fora da caixa de conteúdo, que ocupa todo o interior.
      onClick={(evento) => {
        if (fecharNoFundo && evento.target === ref.current) aoFechar();
      }}
      aria-labelledby={idTitulo}
      className={`m-auto ${largura} max-h-[calc(100dvh-2rem)] rounded-suave
        bg-folha text-tinta text-left shadow-[var(--sombra-alta)] p-0
        backdrop:bg-black/45 backdrop:backdrop-blur-[2px]`}
    >
      {aberto && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 id={idTitulo} className="text-realce font-semibold">
                {titulo}
              </h2>
              {descricao && <p className="text-corpo text-tinta-2 mt-1">{descricao}</p>}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="relative alvo-toque size-8 shrink-0 grid place-items-center rounded-full text-tinta-3 hover:bg-folha-2 hover:text-tinta cursor-pointer"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
