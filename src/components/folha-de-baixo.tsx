"use client";

/**
 * A folha que sobe de baixo — o "bottom sheet" do iOS e do Android.
 *
 * É como um formulário que pertence a uma linha de lista abre no celular: na
 * largura toda, perto do polegar, com o Salvar grande no pé. Dentro de uma
 * tabela ou de um cartão estreito, o mesmo formulário ficava espremido ou
 * escondido à direita.
 *
 * Diferente do `Dialogo`, o conteúdo NÃO desmonta ao fechar: é o mesmo
 * formulário do painel que abria dentro da linha, e ele guarda o que foi
 * digitado e o erro da última tentativa enquanto a pessoa fecha e reabre.
 *
 * O `<dialog>` nativo faz o resto: prende o foco, fecha no Esc e no gesto de
 * voltar do Android, e escurece a página por trás.
 */

import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

export function FolhaDeBaixo({
  aberto,
  aoFechar,
  titulo,
  descricao,
  id,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: ReactNode;
  /** Para o `aria-controls` do botão que a abre. */
  id?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const folha = ref.current;
    if (!folha) return;
    if (aberto && !folha.open) folha.showModal();
    if (!aberto && folha.open) folha.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      id={id}
      onClose={aoFechar}
      // Toque no fundo escurecido fecha: o alvo só é o próprio <dialog> quando
      // o toque cai fora da caixa de conteúdo.
      onClick={(evento) => {
        if (evento.target === ref.current) aoFechar();
      }}
      aria-labelledby={idTitulo}
      className="folha-de-baixo overflow-y-auto bg-folha text-tinta text-left shadow-[var(--sombra-alta)] p-0
        backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="px-4 pt-2 pb-5">
        {/* A alça: diz, sem palavra, que isto é uma folha por cima da página. */}
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-filete-forte" />
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-realce font-semibold">
              {titulo}
            </h2>
            {descricao && <div className="text-corpo text-tinta-2 mt-0.5">{descricao}</div>}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="relative alvo-toque size-8 shrink-0 grid place-items-center rounded-full text-tinta-3
              hover:bg-folha-2 hover:text-tinta cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
