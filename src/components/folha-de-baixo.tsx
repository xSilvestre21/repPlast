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
 * O `<dialog>` nativo prende o foco, deixa a página inerte (e parada: ver
 * `html:has(dialog:modal)` em `globals.css`) e escurece o fundo.
 *
 * O movimento é o da folha do iOS, com os números que o Vaul mediu nela:
 *   - abre, volta e fecha na curva `cubic-bezier(0.32, 0.72, 0, 1)`, 500ms;
 *   - arrasta pela alça, pelo título ou pelo conteúdo já rolado até o topo;
 *   - solta depois de 25% da altura, ou num peteleco acima de 0,4 px/ms, e ela
 *     desce e fecha; antes disso, volta ao lugar;
 *   - para cima ela resiste, cada vez mais (curva logarítmica);
 *   - fecha deslizando também pelo X, pelo Esc, pelo toque no fundo e quando
 *     quem a abriu a fecha (o "Salvar" que deu certo);
 *   - com o teclado aberto, ela sobe e fica acima dele.
 */

import { X } from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useId, useRef } from "react";

import { abrirModal } from "./modal";

/** A fração da altura que, arrastada, fecha ao soltar (o `CLOSE_THRESHOLD` do Vaul). */
const FRACAO_PARA_FECHAR = 0.25;
/** Px por ms: o peteleco que fecha mesmo sem ter descido muito (o `VELOCITY_THRESHOLD`). */
const VELOCIDADE_PARA_FECHAR = 0.4;
const CURVA = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURACAO_MS = 500;
/** Depois de rolar o conteúdo, o tempo em que o dedo não arrasta a folha. */
const TRAVA_APOS_ROLAGEM_MS = 100;

type Arraste = { inicioY: number; inicioT: number; deslocamento: number };

function semMovimento() {
  return document.documentElement.dataset.animacoes === "desativadas";
}

/** A resistência de puxar para cima: nada no começo, e cada vez menos depois. */
function resistencia(distancia: number) {
  return Math.max(0, 8 * (Math.log(distancia + 1) - 2));
}

/** Onde o toque não pode virar arraste: quem digita ou escolhe precisa do dedo. */
function ehControle(alvo: EventTarget | null) {
  return alvo instanceof Element && alvo.closest("input, textarea, select, [contenteditable='true']") !== null;
}

/** A folha onde o dedo está, e o fundo clareando na mesma proporção. */
function posicionar(folha: HTMLDialogElement, deslocamento: number) {
  folha.style.translate = `0 ${deslocamento}px`;
  folha.style.setProperty("--arraste", String(Math.max(0, Math.min(1, deslocamento / folha.offsetHeight))));
}

/**
 * Tira o que um arraste deixou: parada, a folha não fica com `translate` nenhum.
 *
 * Sem transição na hora de tirar: com a da classe valendo, o navegador
 * animaria de "0px" até "none" por mais meio segundo — e era justamente
 * `translate` na folha que fazia o iOS desenhar o cursor fora do campo.
 */
function limpar(folha: HTMLDialogElement) {
  folha.style.transition = "none";
  folha.style.translate = "";
  folha.style.removeProperty("--arraste");
  // Aplica sem animar, e só então devolve a transição da classe.
  void folha.offsetHeight;
  folha.style.transition = "";
}

/** Anima o `translate` até `destino` e chama `depois` no fim (ou logo, sem animação). */
function deslizar(folha: HTMLDialogElement, destino: string, depois: () => void) {
  if (semMovimento()) {
    depois();
    return;
  }
  folha.style.transition = `translate ${DURACAO_MS}ms ${CURVA}`;
  // Um quadro antes de mudar o destino: sem isto, a transição não arranca
  // quando o valor de partida acabou de ser posto.
  requestAnimationFrame(() => {
    folha.style.translate = destino;
  });
  let feito = false;
  const fim = () => {
    if (feito) return;
    feito = true;
    folha.removeEventListener("transitionend", fim);
    depois();
  };
  folha.addEventListener("transitionend", fim);
  // Se a transição não disparar (aba em segundo plano), não fica preso.
  window.setTimeout(fim, DURACAO_MS + 80);
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
  // O `aoFechar` mais recente, para os ouvintes de toque registrados uma vez.
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  }, [aoFechar]);

  /* Abrir e fechar. Fechar sempre desliza até sair da tela, de onde ela estiver. */
  useEffect(() => {
    const folha = ref.current;
    if (!folha) return;
    if (aberto && !folha.open) {
      limpar(folha);
      abrirModal(folha);
    }
    if (!aberto && folha.open) {
      deslizar(folha, "0 100%", () => {
        folha.close();
        limpar(folha);
      });
    }
  }, [aberto]);

  /* Arrastar: o começo, o meio e o fim, para o ponteiro da alça e o toque no conteúdo. */
  function iniciar(y: number, t: number) {
    const folha = ref.current;
    if (!folha) return;
    folha.style.transition = "none";
    arraste.current = { inicioY: y, inicioT: t, deslocamento: 0 };
  }

  function acompanhar(y: number) {
    const atual = arraste.current;
    const folha = ref.current;
    if (!atual || !folha) return;
    const bruto = y - atual.inicioY;
    atual.deslocamento = bruto >= 0 ? bruto : -resistencia(-bruto);
    posicionar(folha, atual.deslocamento);
  }

  function terminar(y: number, t: number) {
    const atual = arraste.current;
    const folha = ref.current;
    arraste.current = null;
    if (!atual || !folha) return;

    // A velocidade do gesto inteiro, como o Vaul mede: distância sobre tempo.
    const tempo = t - atual.inicioT;
    const velocidade = tempo > 0 ? (y - atual.inicioY) / tempo : 0;
    const fecha =
      atual.deslocamento > folha.offsetHeight * FRACAO_PARA_FECHAR ||
      (atual.deslocamento > 0 && velocidade > VELOCIDADE_PARA_FECHAR);

    if (fecha) {
      // Quem a abriu decide: o efeito de `aberto` desce a folha de onde o dedo a deixou.
      aoFecharRef.current();
      return;
    }
    folha.style.removeProperty("--arraste");
    deslizar(folha, "0px", () => limpar(folha));
  }

  /* A alça e o título: ponteiro (dedo ou mouse). */
  function apertarAlca(evento: PointerEvent<HTMLDivElement>) {
    // O X fecha por clique, não por arraste.
    if (evento.button !== 0 || (evento.target as HTMLElement).closest("button")) return;
    // Captura: o dedo pode sair da alça e o arraste continua. Um ponteiro que
    // o navegador não conhece (o de um teste) só fica sem captura.
    try {
      evento.currentTarget.setPointerCapture(evento.pointerId);
    } catch {}
    iniciar(evento.clientY, evento.timeStamp);
  }

  function soltarAlca(evento: PointerEvent<HTMLDivElement>) {
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    }
    terminar(evento.clientY, evento.timeStamp);
  }

  /*
   * O conteúdo: toque, com `touchmove` não passivo. Rolado até o topo e com o
   * dedo descendo, o gesto deixa de rolar e passa a arrastar a folha — a partir
   * daí o `preventDefault` segura a rolagem. Começando num campo, depois de uma
   * rolagem recente ou com texto selecionado, o toque é do conteúdo.
   */
  useEffect(() => {
    const folha = ref.current;
    if (!folha || !aberto) return;
    let candidato: { y: number; t: number } | null = null;
    let ultimaRolagem = 0;

    const aoRolar = () => {
      ultimaRolagem = performance.now();
    };
    const aoTocar = (evento: TouchEvent) => {
      const alvo = evento.target as Element;
      candidato =
        evento.touches.length === 1 &&
        !alvo.closest("[data-arraste]") &&
        !ehControle(alvo) &&
        folha.scrollTop <= 0 &&
        performance.now() - ultimaRolagem > TRAVA_APOS_ROLAGEM_MS &&
        !window.getSelection()?.toString()
          ? { y: evento.touches[0].clientY, t: evento.timeStamp }
          : null;
    };
    const aoMover = (evento: TouchEvent) => {
      const y = evento.touches[0].clientY;
      if (candidato && !arraste.current) {
        if (y < candidato.y || folha.scrollTop > 0) {
          candidato = null; // subindo: é rolagem do conteúdo
          return;
        }
        if (y - candidato.y > 4) iniciar(candidato.y, candidato.t);
      }
      if (arraste.current) {
        evento.preventDefault();
        acompanhar(y);
      }
    };
    const aoSoltar = (evento: TouchEvent) => {
      candidato = null;
      if (!arraste.current) return;
      terminar(evento.changedTouches[0].clientY, evento.timeStamp);
    };

    folha.addEventListener("scroll", aoRolar, { passive: true });
    folha.addEventListener("touchstart", aoTocar, { passive: true });
    folha.addEventListener("touchmove", aoMover, { passive: false });
    folha.addEventListener("touchend", aoSoltar);
    folha.addEventListener("touchcancel", aoSoltar);
    return () => {
      folha.removeEventListener("scroll", aoRolar);
      folha.removeEventListener("touchstart", aoTocar);
      folha.removeEventListener("touchmove", aoMover);
      folha.removeEventListener("touchend", aoSoltar);
      folha.removeEventListener("touchcancel", aoSoltar);
    };
    // `iniciar`, `acompanhar` e `terminar` leem refs: registrar uma vez por abertura basta.
  }, [aberto]);

  /*
   * O teclado: no iPhone ele cobre a parte de baixo da tela sem a página
   * encolher, e o campo do valor ficava por trás dele. A folha sobe a altura do
   * teclado (`visualViewport`) e encolhe para caber no que sobrou; o campo
   * focado rola até aparecer.
   */
  useEffect(() => {
    const folha = ref.current;
    const visivel = window.visualViewport;
    if (!folha || !aberto || !visivel) return;

    const ajustar = () => {
      const teclado = Math.max(0, window.innerHeight - visivel.height - visivel.offsetTop);
      folha.style.bottom = teclado > 0 ? `${teclado}px` : "";
      folha.style.maxHeight = teclado > 0 ? `${visivel.height - 12}px` : "";
    };
    const aoFocar = (evento: FocusEvent) => {
      if (!ehControle(evento.target)) return;
      // Depois de o teclado terminar de subir.
      window.setTimeout(() => (evento.target as Element).scrollIntoView({ block: "nearest" }), 300);
    };

    visivel.addEventListener("resize", ajustar);
    visivel.addEventListener("scroll", ajustar);
    folha.addEventListener("focusin", aoFocar);
    return () => {
      visivel.removeEventListener("resize", ajustar);
      visivel.removeEventListener("scroll", ajustar);
      folha.removeEventListener("focusin", aoFocar);
      folha.style.bottom = "";
      folha.style.maxHeight = "";
    };
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      id={id}
      // O Esc (e o voltar do Android) fecha deslizando, como o X: quem decide é
      // o efeito de `aberto`, e não o fechamento seco do navegador.
      onCancel={(evento) => {
        evento.preventDefault();
        aoFechar();
      }}
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
          A alça e o cabeçalho arrastam sempre, mesmo com o conteúdo rolado.
          `touch-none` para o navegador não tratar o gesto como rolagem.
        */}
        <div
          data-arraste=""
          onPointerDown={apertarAlca}
          onPointerMove={(evento) => acompanhar(evento.clientY)}
          onPointerUp={soltarAlca}
          onPointerCancel={soltarAlca}
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
