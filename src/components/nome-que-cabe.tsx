"use client";

import { useLayoutEffect, useRef } from "react";

import { FONTE_MINIMA_DO_NOME, LINHAS_DO_NOME } from "@/lib/escritorio-regras";

/**
 * Os tamanhos que o nome tenta, do maior para o menor, e para no primeiro que
 * couber inteiro. Primeiro em UMA linha, do `text-medio` (18 px) até 14 px;
 * só então quebra em DUAS, de 14 a 12 px. Abaixo de 12 px o nome em negrito
 * deixa de ler como marca e vira nota de rodapé — e duas linhas de 12 px ainda
 * cabem folgadas nos 56 px do topo.
 *
 * O último degrau é o que o cadastro garante (`cabeNoTopo`): nome que não
 * couber nele é recusado lá, antes de chegar aqui.
 */
const DEGRAUS: { px: number; linhas: number }[] = [
  { px: 18, linhas: 1 },
  { px: 17, linhas: 1 },
  { px: 16, linhas: 1 },
  { px: 15, linhas: 1 },
  { px: 14, linhas: 1 },
  { px: 14, linhas: 2 },
  { px: 13, linhas: 2 },
  { px: FONTE_MINIMA_DO_NOME, linhas: LINHAS_DO_NOME },
];

/**
 * Para o nome que o cadastro de hoje recusaria, mas que já estava gravado
 * antes da regra: em vez de cortar com "…", ganha uma terceira linha (três de
 * 12 px ainda cabem nos 56 px do topo) e, se faltar, desce até 10 px. Nome
 * cortado no topo é pior que nome pequeno.
 */
const DEGRAUS_DE_SOBRA: { px: number; linhas: number }[] = [
  { px: 12, linhas: 3 },
  { px: 11, linhas: 3 },
  { px: 10, linhas: 3 },
];

type Degrau = (typeof DEGRAUS)[number];

function aplicar(elemento: HTMLElement, { px, linhas }: Degrau) {
  const estilo = elemento.style;
  estilo.fontSize = `${px}px`;
  estilo.lineHeight = linhas === 1 ? "1.35" : "1.2";
  estilo.whiteSpace = linhas === 1 ? "nowrap" : "normal";
  estilo.display = "block";
  // Cabendo, nada a esconder — e o `hidden` comeria a ponta da cedilha e do
  // til, que na Plus Jakarta passam um pouco da caixa da linha.
  estilo.overflow = "visible";
  estilo.overflowWrap = "normal";
  elemento.dataset.linhas = String(linhas);
}

/** As caixas de linha que o navegador montou para o texto. */
function linhasDoTexto(elemento: HTMLElement) {
  const faixa = document.createRange();
  faixa.selectNodeContents(elemento);
  return new Set([...faixa.getClientRects()].map((caixa) => Math.round(caixa.top))).size;
}

/**
 * Conta as linhas pelo texto, não pela altura da caixa: os acentos passam da
 * linha e somariam 1 px à altura de um nome que cabe.
 */
function cabe(elemento: HTMLElement, degrau: Degrau) {
  return elemento.scrollWidth <= elemento.clientWidth && linhasDoTexto(elemento) <= degrau.linhas;
}

function ajustarAoEspaco(elemento: HTMLElement) {
  // Escondido (a gaveta ainda fechando ou abrindo): sem largura não há o que medir.
  if (elemento.clientWidth === 0) return;
  for (const degrau of [...DEGRAUS, ...DEGRAUS_DE_SOBRA]) {
    aplicar(elemento, degrau);
    if (cabe(elemento, degrau)) return;
  }
  // Nem em três linhas de 10 px: sobra uma palavra mais larga que o espaço
  // inteiro. Quebra a palavra no meio — inteira em duas linhas, nunca "…".
  elemento.style.overflowWrap = "anywhere";
}

/**
 * O nome do escritório no topo: encolhe a fonte até caber, em vez de cortar
 * com "…". Vai DENTRO do elemento que limita a largura (o link do topo, o
 * cabeçalho da gaveta), e ocupa a largura que ele der.
 *
 * O ajuste mexe direto no `style`, não em estado do React: cada degrau precisa
 * ser medido na hora, e oito renderizações por redimensionamento de janela
 * seriam oito voltas pelo React para o mesmo resultado.
 *
 * Mede de novo quando:
 * - a janela muda — mais espaço deixa o nome crescer de volta, e isso o
 *   próprio nome não sente: ele já está do tamanho do texto;
 * - o próprio nome muda de caixa — pega a gaveta do celular, que monta antes
 *   de abrir, com largura zero. Ajustar também muda a caixa e chama o
 *   observador de volta, mas a segunda volta chega no mesmo degrau, a caixa
 *   não muda, e para aí;
 * - as fontes terminam de carregar — a mesma frase em Plus Jakarta é mais
 *   larga que na fonte do sistema.
 */
export function NomeQueCabe({ nome }: { nome: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const ajustar = () => ajustarAoEspaco(elemento);
    ajustar();

    const observador = new ResizeObserver(ajustar);
    observador.observe(elemento);
    window.addEventListener("resize", ajustar);
    let vivo = true;
    document.fonts?.ready.then(() => vivo && ajustar());
    return () => {
      vivo = false;
      observador.disconnect();
      window.removeEventListener("resize", ajustar);
    };
  }, [nome]);

  return (
    <span
      ref={ref}
      data-nome-escritorio=""
      // Antes da primeira medida (o HTML do servidor): duas linhas de 14 px, que
      // servem para quase todo nome — e, se não servirem, quebram, não cortam.
      className="block text-[14px] leading-[1.2]"
    >
      {nome}
    </span>
  );
}
