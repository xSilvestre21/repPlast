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
import { type ReactNode, useEffect, useRef } from "react";

export function Dialogo({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;

    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      // Esc e o `close()` acima chegam aqui; é o que devolve o estado ao React.
      onClose={aoFechar}
      // Clique no fundo escurecido fecha. O alvo só é o próprio <dialog> quando
      // o clique cai fora da caixa de conteúdo, que ocupa todo o interior.
      onClick={(evento) => {
        if (evento.target === ref.current) aoFechar();
      }}
      aria-labelledby="dialogo-titulo"
      className="m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-suave
        bg-folha text-tinta shadow-[var(--sombra-alta)] p-0
        backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
    >
      {aberto && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 id="dialogo-titulo" className="text-realce font-semibold">
                {titulo}
              </h2>
              {descricao && <p className="text-corpo text-tinta-2 mt-1">{descricao}</p>}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="size-8 shrink-0 grid place-items-center rounded-full text-tinta-3 hover:bg-folha-2 hover:text-tinta cursor-pointer"
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
