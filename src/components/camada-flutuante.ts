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

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type RefObject } from "react";

export interface Lugar {
  paraCima: boolean;
  esquerda: number;
  topo: number;
  /**
   * A altura que cabe na tela, quando o cartão inteiro não cabe (numa janela
   * de tela baixa): ele rola por dentro. `null`: cabe inteiro.
   */
  alturaMaxima: number | null;
  /**
   * Medido pela altura do cartão já aberto, e não pela estimativa do clique.
   * Rolar a página até o cartão espera por isto: com a estimativa, o lugar
   * ainda pode mudar de lado, e a página pularia à toa.
   */
  alturaReal: boolean;
  /** Dentro de um `<dialog>` modal: portal nele, `popover` e posição fixa. */
  emDialogo: boolean;
  /** Para onde o portal leva o cartão: a janela modal, ou o `<body>`. */
  destino: Element | null;
}

export const LUGAR_INICIAL: Lugar = {
  paraCima: false,
  esquerda: 0,
  topo: 0,
  alturaMaxima: null,
  alturaReal: false,
  emDialogo: false,
  destino: null,
};

/** Folga entre o cartão e a borda da tela. */
const MARGEM = 8;
/** Distância entre o campo e o cartão. */
const AFASTAMENTO = 4;

/** O `<dialog>` modal em que o campo está, ou `null`. */
function dialogoDe(ancora: Element | null): HTMLDialogElement | null {
  const dialogo = ancora?.closest("dialog");
  return dialogo?.open ? dialogo : null;
}

/**
 * A faixa da tela, de cima a baixo, onde o que abre aparece inteiro.
 *
 * É a janela do navegador, menos a barra do topo, que é fixa e cobriria o
 * começo do que abre para cima — numa janela modal a barra está atrás dela, e
 * não cobre nada.
 *
 * `presoNaJanela` é para o que abre DENTRO do formulário (a lista de busca, a
 * de dados da mensagem), e não por portal: numa janela modal ele é cortado
 * pela borda dela, que pode estar bem antes da borda da tela — a janela é
 * centralizada. Aí a faixa é a parte visível da janela. Passar da borda de
 * baixo ainda se alcança rolando a janela; passar da de cima, não.
 */
export function faixaVisivel(
  ancora: Element,
  { presoNaJanela = false }: { presoNaJanela?: boolean } = {},
): { topo: number; base: number } {
  const dialogo = dialogoDe(ancora);
  let topo = dialogo
    ? 0
    : Math.max(0, document.querySelector(".barra-topo")?.getBoundingClientRect().bottom ?? 0);
  let base = window.innerHeight;
  if (dialogo && presoNaJanela) {
    const caixa = dialogo.getBoundingClientRect();
    topo = Math.max(topo, caixa.top + dialogo.clientTop);
    base = Math.min(base, caixa.top + dialogo.clientTop + dialogo.clientHeight);
  }
  return { topo, base };
}

/**
 * Para que lado abre e onde, a partir da caixa do campo.
 *
 * Desce se couber embaixo; senão sobe, se couber INTEIRO em cima. Não cabendo
 * em lado nenhum:
 *
 *   - na página, desce: o cartão mora no `<body>`, a página cresce com ele, e
 *     quem o abriu rola até ele (`scrollIntoView` em cada campo);
 *   - numa janela modal, a página NÃO rola (`html:has(dialog:modal)`) e o
 *     cartão é fixo na tela — descendo, o fim dele ficava fora da tela, sem
 *     rolagem que chegasse lá (o calendário da entrega, no acerto das
 *     comissões). Então ele fica dentro da tela, do lado que tem mais espaço,
 *     nem que cubra o próprio campo; e, maior que a tela, rola por dentro.
 *
 * `cartao` é o cartão já aberto, para medir pela altura DE VERDADE — que muda
 * com o mês (os feriados listados embaixo) e com o aviso de erro. Antes de
 * abrir, vale a estimativa `altura`.
 */
export function medirLugar(
  ancora: HTMLElement,
  {
    largura,
    altura: estimada,
    alinhar,
    cartao,
  }: {
    largura: number;
    altura: number;
    alinhar: "esquerda" | "direita";
    cartao?: HTMLElement | null;
  },
): Lugar {
  const caixa = ancora.getBoundingClientRect();
  const dialogo = dialogoDe(ancora);
  const emDialogo = dialogo !== null;
  const destino = dialogo ?? document.body;
  // `scrollHeight`, e não a altura na tela: rolando por dentro, ela já está
  // cortada. Zero é o cartão ainda escondido (o `popover` antes de mostrar).
  const medida = cartao ? Math.max(cartao.scrollHeight, cartao.offsetHeight) : 0;
  const altura = medida > 0 ? medida : estimada;

  const faixa = faixaVisivel(ancora);
  const limiteDeCima = faixa.topo + MARGEM;
  const limiteDeBaixo = faixa.base - MARGEM;
  const abaixo = limiteDeBaixo - caixa.bottom - AFASTAMENTO;
  const acima = caixa.top - AFASTAMENTO - limiteDeCima;

  let paraCima = abaixo < altura && acima >= altura;
  let topo = paraCima ? caixa.top - AFASTAMENTO : caixa.bottom + AFASTAMENTO;
  let alturaMaxima: number | null = null;

  if (emDialogo && abaixo < altura && acima < altura) {
    paraCima = false;
    const espaco = limiteDeBaixo - limiteDeCima;
    if (altura > espaco) {
      topo = limiteDeCima;
      alturaMaxima = espaco;
    } else {
      // Encostado na borda do lado com mais espaço: cobre o mínimo do campo.
      topo = acima > abaixo ? limiteDeCima : limiteDeBaixo - altura;
    }
  }

  const desejada = alinhar === "direita" ? caixa.right - largura : caixa.left;
  // Nunca sai pela janela, nem em tela estreita.
  const esquerda = Math.max(MARGEM, Math.min(desejada, window.innerWidth - largura - MARGEM));

  // Fora de janela, coordenadas da página: o cartão rola junto com o campo.
  const alturaReal = medida > 0;
  return emDialogo
    ? { paraCima, esquerda, topo, alturaMaxima, alturaReal, emDialogo, destino }
    : {
        paraCima,
        esquerda: esquerda + window.scrollX,
        topo: topo + window.scrollY,
        alturaMaxima,
        alturaReal,
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
    ...(lugar.alturaMaxima !== null ? { maxHeight: lugar.alturaMaxima, overflowY: "auto" } : {}),
  };
}

/**
 * Mostra o cartão na camada de topo quando ele está numa janela.
 *
 * E o mantém no lugar: em posição fixa, o cartão não anda sozinho com o
 * conteúdo da janela quando ela rola, nem se ajeita quando ele mesmo muda de
 * altura (outro mês, com mais feriados) — nos dois casos, é medido de novo.
 */
export function useCamadaDeTopo(
  cartao: RefObject<HTMLElement | null>,
  lugar: Lugar,
  aberto: boolean,
  remedir: () => void,
) {
  // A função muda a cada renderização; o ouvinte fica um só e chama a última.
  const remedirAtual = useRef(remedir);
  useLayoutEffect(() => {
    remedirAtual.current = remedir;
  });

  /*
   * Acabou de abrir: a medida do clique foi pela altura ESTIMADA, e o cartão
   * de verdade costuma ser menor (o calendário sem os atalhos de prazo) — com
   * a estimativa, descia um calendário que cabia em cima. Mede de novo pela
   * altura real antes de pintar, então ninguém vê o primeiro lugar.
   */
  useLayoutEffect(() => {
    const elemento = cartao.current;
    if (!aberto || !elemento) return;
    if (lugar.emDialogo && !elemento.matches(":popover-open")) elemento.showPopover();
    remedirAtual.current();
  }, [cartao, lugar.emDialogo, aberto]);

  useEffect(() => {
    const elemento = cartao.current;
    if (!aberto || !lugar.emDialogo || !elemento) return;

    const remedir = () => remedirAtual.current();
    window.addEventListener("scroll", remedir, true);
    const tamanho = new ResizeObserver(remedir);
    tamanho.observe(elemento);
    return () => {
      window.removeEventListener("scroll", remedir, true);
      tamanho.disconnect();
    };
  }, [cartao, lugar.emDialogo, aberto]);
}
