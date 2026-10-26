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
 *
 * E fecha arrastando, como no iOS: segurar a alça (ou o título) e puxar para
 * baixo. A folha acompanha o dedo; solta depois de um quarto da altura, ou
 * num peteleco rápido, ela desce e fecha; antes disso, volta ao lugar.
 */

import { X } from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useId, useRef } from "react";

/** Passou disto (fração da altura da folha, e no mínimo 80px), soltar fecha. */
const FRACAO_PARA_FECHAR = 0.25;
const MINIMO_PARA_FECHAR = 80;
/** Px por ms: o peteleco que fecha mesmo sem ter descido muito. */
const VELOCIDADE_PARA_FECHAR = 0.5;
/** A curva da abertura (`.folha-de-baixo`, em `globals.css`), para a volta. */
const CURVA = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const DURACAO_MS = 200;

type Arraste = {
  inicioY: number;
  deslocamento: number;
  /** As últimas posições, para medir a velocidade do fim do gesto. */
  amostras: { y: number; t: number }[];
};

function semMovimento() {
  return document.documentElement.dataset.animacoes === "desativadas";
}

/** Tira o que um arraste anterior deixou: a folha abre de novo do zero. */
function limpar(folha: HTMLDialogElement) {
  folha.style.translate = "";
  folha.style.transition = "";
  folha.style.removeProperty("--arraste");
}

/** A folha onde o dedo está, e o fundo clareando na mesma proporção. */
function mover(folha: HTMLDialogElement, deslocamento: number) {
  folha.style.translate = `0 ${deslocamento}px`;
  folha.style.setProperty("--arraste", String(Math.max(0, Math.min(1, deslocamento / folha.offsetHeight))));
}

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
  const arraste = useRef<Arraste | null>(null);
  const idTitulo = useId();

  useEffect(() => {
    const folha = ref.current;
    if (!folha) return;
    if (aberto && !folha.open) {
      // Uma volta anterior pode ter deixado a folha fora da tela: abre limpa.
      limpar(folha);
      folha.showModal();
    }
    if (!aberto && folha.open) folha.close();
  }, [aberto]);

  function comecar(evento: PointerEvent<HTMLDivElement>) {
    // Só o botão principal (ou o dedo); e o X fecha por clique, não por arraste.
    if (evento.button !== 0 || (evento.target as HTMLElement).closest("button")) return;
    const folha = ref.current;
    if (!folha) return;
    // Captura: o dedo pode sair da alça e o arraste continua. Um ponteiro que
    // o navegador não conhece (o de um teste) só fica sem captura.
    try {
      evento.currentTarget.setPointerCapture(evento.pointerId);
    } catch {}
    folha.style.transition = "none";
    arraste.current = {
      inicioY: evento.clientY,
      deslocamento: 0,
      amostras: [{ y: evento.clientY, t: evento.timeStamp }],
    };
  }

  function acompanhar(evento: PointerEvent<HTMLDivElement>) {
    const atual = arraste.current;
    const folha = ref.current;
    if (!atual || !folha) return;
    const bruto = evento.clientY - atual.inicioY;
    // Para baixo acompanha o dedo; para cima resiste, como no iOS.
    atual.deslocamento = bruto >= 0 ? bruto : bruto / 3;
    atual.amostras = [...atual.amostras, { y: evento.clientY, t: evento.timeStamp }].filter(
      (a) => evento.timeStamp - a.t <= 100,
    );
    mover(folha, atual.deslocamento);
  }

  function soltar(evento: PointerEvent<HTMLDivElement>) {
    const atual = arraste.current;
    const folha = ref.current;
    arraste.current = null;
    if (!atual || !folha) return;
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }

    const primeira = atual.amostras[0];
    const tempo = evento.timeStamp - primeira.t;
    const velocidade = tempo > 0 ? (evento.clientY - primeira.y) / tempo : 0;
    const limite = Math.max(MINIMO_PARA_FECHAR, folha.offsetHeight * FRACAO_PARA_FECHAR);
    const fecha = atual.deslocamento > limite || (atual.deslocamento > 0 && velocidade > VELOCIDADE_PARA_FECHAR);

    if (!fecha) {
      folha.style.transition = `translate ${DURACAO_MS}ms ${CURVA}`;
      folha.style.translate = "0 0";
      folha.style.removeProperty("--arraste");
      return;
    }
    if (semMovimento()) {
      aoFechar();
      return;
    }
    // Desce até sair da tela e só então fecha: fechar no meio do caminho
    // faria a folha sumir de uma vez, no lugar em que o dedo a deixou.
    folha.style.transition = `translate ${DURACAO_MS}ms ${CURVA}`;
    folha.style.translate = "0 100%";
    folha.style.setProperty("--arraste", "1");
    window.setTimeout(aoFechar, DURACAO_MS);
  }

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
      <div className="px-4 pb-5">
        {/*
          A zona de arraste: a alça e o cabeçalho. `touch-none` para o navegador
          não tratar o gesto como rolagem da página.
        */}
        <div
          data-arraste=""
          onPointerDown={comecar}
          onPointerMove={acompanhar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          className="touch-none select-none cursor-grab active:cursor-grabbing pt-2"
        >
          {/* A alça: diz, sem palavra, que isto é uma folha que se puxa. */}
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
        </div>
        {children}
      </div>
    </dialog>
  );
}
