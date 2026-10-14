"use client";

/**
 * Onde e como desenhar um cartão flutuante (calendário, seletor de hora).
 *
 * Fora de janela, o cartão vai para o `<body>` em posição absoluta da PÁGINA:
 * rola junto com o campo, e escapa da camada de animação dos blocos (ver o
 * comentário do portal em `campo-data.tsx`).
 *
 * Dentro de um `<dialog>` aberto com `showModal()` isso não serve. A janela
 * fica na camada de topo do navegador, acima de qualquer z-index, e o resto da
 * página fica inerte: o cartão no `<body>` abria ATRÁS dela, invisível e sem
 * aceitar clique — no "Novo compromisso" nem a data nem a hora abriam. Ali o
 * cartão vai para DENTRO da janela (descendente dela, então não fica inerte) e
 * é mostrado como `popover`, que também entra na camada de topo, por cima da
 * janela. Na camada de topo a posição é da JANELA DO NAVEGADOR (`fixed`).
 */

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

export interface Lugar {
  paraCima: boolean;
  esquerda: number;
  topo: number;
  /** Dentro de um `<dialog>` modal: portal nele, `popover` e posição fixa. */
  emDialogo: boolean;
  /** Para onde o portal leva o cartão: a janela modal, ou o `<body>`. */
  destino: Element | null;
}

export const LUGAR_INICIAL: Lugar = {
  paraCima: false,
  esquerda: 0,
  topo: 0,
  emDialogo: false,
  destino: null,
};

/** O `<dialog>` modal em que o campo está, ou `null`. */
function dialogoDe(ancora: Element | null): HTMLDialogElement | null {
  const dialogo = ancora?.closest("dialog");
  return dialogo?.open ? dialogo : null;
}

/**
 * Para que lado abre e onde, a partir da caixa do campo.
 *
 * Sobe só se couber INTEIRO em cima — descontada a barra do topo, que é fixa
 * e cobriria o começo do cartão. Não cabendo em lado nenhum, desce.
 */
export function medirLugar(
  ancora: HTMLElement,
  { largura, altura, alinhar }: { largura: number; altura: number; alinhar: "esquerda" | "direita" },
): Lugar {
  const caixa = ancora.getBoundingClientRect();
  const dialogo = dialogoDe(ancora);
  const emDialogo = dialogo !== null;
  const destino = dialogo ?? document.body;
  // Numa janela, a barra do sistema está atrás dela e não cobre nada.
  const barra = emDialogo
    ? 0
    : (document.querySelector(".barra-topo")?.getBoundingClientRect().bottom ?? 0);
  const abaixo = window.innerHeight - caixa.bottom;
  const acima = caixa.top - barra;
  const paraCima = abaixo < altura && acima >= altura;

  const desejada = alinhar === "direita" ? caixa.right - largura : caixa.left;
  // Nunca sai pela janela, nem em tela estreita.
  const esquerda = Math.max(8, Math.min(desejada, window.innerWidth - largura - 8));
  const topo = paraCima ? caixa.top - 4 : caixa.bottom + 4;

  // Fora de janela, coordenadas da página: o cartão rola junto com o campo.
  return emDialogo
    ? { paraCima, esquerda, topo, emDialogo, destino }
    : {
        paraCima,
        esquerda: esquerda + window.scrollX,
        topo: topo + window.scrollY,
        emDialogo,
        destino,
      };
}

/** O `style` do cartão para o lugar medido. */
export function estiloDoLugar(lugar: Lugar, largura: number): CSSProperties {
  return {
    // O `popover` traz do navegador `inset: 0; margin: auto` (centralizado) e
    // posição fixa; o cartão fica onde foi medido. O `inset` vem ANTES: ele é
    // atalho dos quatro lados, e depois de `left`/`top` os apagaria.
    ...(lugar.emDialogo ? { position: "fixed", inset: "auto", margin: 0 } : {}),
    left: lugar.esquerda,
    top: lugar.topo,
    width: largura,
    transform: lugar.paraCima ? "translateY(-100%)" : undefined,
  };
}

/**
 * Mostra o cartão na camada de topo quando ele está numa janela.
 *
 * E acompanha a rolagem DENTRO da janela: em posição fixa, o cartão não anda
 * sozinho com o conteúdo dela — então é medido de novo.
 */
export function useCamadaDeTopo(
  cartao: RefObject<HTMLElement | null>,
  lugar: Lugar,
  aberto: boolean,
  remedir: () => void,
) {
  // A função muda a cada renderização; o ouvinte fica um só e chama a última.
  const remedirAtual = useRef(remedir);
  useEffect(() => {
    remedirAtual.current = remedir;
  });

  useEffect(() => {
    const elemento = cartao.current;
    if (!aberto || !lugar.emDialogo || !elemento) return;
    if (!elemento.matches(":popover-open")) elemento.showPopover();

    const aoRolar = () => remedirAtual.current();
    window.addEventListener("scroll", aoRolar, true);
    return () => window.removeEventListener("scroll", aoRolar, true);
  }, [cartao, lugar.emDialogo, aberto]);
}
