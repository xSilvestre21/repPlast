"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * O cursor que segue o mouse por cima de um gráfico de pontos.
 *
 * É uma camada SOBREPOSTA, não um gráfico. O desenho continua vindo pronto do
 * servidor — esta ilha só marca onde o ponteiro está e diz quanto vale ali.
 * Sem JavaScript, o gráfico e a tabela de números continuam na tela; some a
 * interação, não o conteúdo.
 *
 * Tudo em HTML posicionado por porcentagem, nada dentro do SVG. O SVG do
 * gráfico usa `preserveAspectRatio="none"` e por isso tem o espaço esticado de
 * forma não uniforme: um `<circle>` desenhado lá sairia elipse, e um traço de
 * 1px teria espessura diferente em cada eixo.
 *
 * O estado muda só quando o índice ATIVO muda — no máximo doze vezes numa
 * série de doze meses, não uma por pixel percorrido.
 */

export interface MarcaDoPonto {
  /** 0 a 100, medido do topo, como o SVG conta. */
  y: number;
  /** Já formatado no servidor: função não atravessa a fronteira. */
  texto: string;
  rotulo: string;
  cor: string;
}

export interface PontoInterativo {
  /** 0 a 100, da esquerda para a direita. */
  x: number;
  /** O que o balão chama este ponto: "Setembro de 2026". */
  titulo: string;
  href?: string;
  /** Uma por série desenhada. Cada uma vira um ponto marcado na curva. */
  marcas: MarcaDoPonto[];
  /**
   * Linhas extras do balão que NÃO viram ponto marcado.
   *
   * Um gráfico de uma série só costuma ter mais a dizer sobre o ponto — a
   * faixa a que ele pertence, quanto já acumulou — e cada uma dessas linhas
   * virando um ponto na curva desenharia marcadores em cima uns dos outros.
   */
  extras?: { rotulo: string; texto: string }[];
}

export function GraficoCursor({
  pontos,
  rotuloDaArea,
}: {
  pontos: PontoInterativo[];
  /** O que um leitor de tela ouve ao chegar na área navegável. */
  rotuloDaArea: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [ativo, definirAtivo] = useState<number | null>(null);
  const router = useRouter();

  if (pontos.length === 0) return null;

  /** O ponto cujo x está mais perto do ponteiro. */
  function maisProximo(evento: PointerEvent<HTMLDivElement>): number {
    const caixa = area.current!.getBoundingClientRect();
    const posicao = ((evento.clientX - caixa.left) / caixa.width) * 100;

    let melhor = 0;
    for (let i = 1; i < pontos.length; i += 1) {
      if (Math.abs(pontos[i].x - posicao) < Math.abs(pontos[melhor].x - posicao)) melhor = i;
    }
    return melhor;
  }

  function aoMover(evento: PointerEvent<HTMLDivElement>) {
    const indice = maisProximo(evento);
    // Só re-renderiza ao TROCAR de ponto, não a cada pixel.
    if (indice !== ativo) definirAtivo(indice);
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const atual = ativo ?? 0;

    if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
      evento.preventDefault();
      const passo = evento.key === "ArrowRight" ? 1 : -1;
      definirAtivo(Math.max(0, Math.min(pontos.length - 1, ativo === null ? 0 : atual + passo)));
      return;
    }

    if (evento.key === "Escape") {
      definirAtivo(null);
      return;
    }

    if ((evento.key === "Enter" || evento.key === " ") && ativo !== null) {
      const destino = pontos[ativo].href;
      if (destino) {
        evento.preventDefault();
        router.push(destino);
      }
    }
  }

  const ponto = ativo === null ? null : pontos[ativo];

  return (
    <>
      <div
        ref={area}
        role="application"
        tabIndex={0}
        aria-label={rotuloDaArea}
        onPointerMove={aoMover}
        onPointerDown={aoMover}
        onPointerLeave={() => definirAtivo(null)}
        onBlur={() => definirAtivo(null)}
        onKeyDown={aoTeclar}
        onClick={() => {
          const destino = ponto?.href;
          if (destino) router.push(destino);
        }}
        className={`absolute inset-0 rounded-suave outline-none
          focus-visible:ring-4 focus-visible:ring-carimbo-fraco
          ${ponto?.href ? "cursor-pointer" : "cursor-crosshair"}`}
      />

      {ponto && (
        <>
          <div className="risco-cursor" style={{ left: `${ponto.x}%` }} aria-hidden="true" />

          {ponto.marcas.map((marca) => (
            <div
              key={marca.rotulo}
              aria-hidden="true"
              className="marca-cursor"
              style={{ left: `${ponto.x}%`, top: `${marca.y}%`, background: marca.cor }}
            />
          ))}

          <Balao ponto={ponto} />
        </>
      )}

      {/*
        O que o balão mostra, dito em texto. É por aqui que quem navega por
        teclado ou leitor de tela recebe o valor — o balão em si é `aria-hidden`
        porque é desenho.
      */}
      <p className="sr-only" aria-live="polite">
        {ponto
          ? `${ponto.titulo}: ${[...ponto.marcas, ...(ponto.extras ?? [])]
              .map((linha) => `${linha.rotulo} ${linha.texto}`)
              .join(", ")}`
          : ""}
      </p>
    </>
  );
}

function Balao({ ponto }: { ponto: PontoInterativo }) {
  /*
   * Perto das bordas o balão vira para dentro em vez de vazar do cartão.
   *
   * Três casos em vez de um cálculo com a largura real: a largura só existe
   * depois de medir, e medir a cada movimento traria de volta o trabalho por
   * pixel que esta ilha evita.
   */
  const naEsquerda = ponto.x < 18;
  const naDireita = ponto.x > 82;

  const posicao: CSSProperties = naEsquerda
    ? { left: 0, transform: "none" }
    : naDireita
      ? { right: 0, left: "auto", transform: "none" }
      : { left: `${ponto.x}%`, transform: "translateX(-50%)" };

  /*
   * E desce quando o dado está em cima.
   *
   * O balão fica no topo por padrão, onde quase nunca há linha. Mas num mês de
   * pico a linha sobe até lá e o balão cobriria justamente o ponto que a pessoa
   * está olhando — então ele troca de lado. `y` pequeno é ALTO na tela.
   */
  const dadoNoTopo = Math.min(...ponto.marcas.map((marca) => marca.y)) < 45;
  const vertical: CSSProperties = dadoNoTopo ? { bottom: 0 } : { top: 0 };

  return (
    <div className="balao" style={{ ...posicao, ...vertical }} aria-hidden="true">
      <div className="text-mini text-tinta-3">{ponto.titulo}</div>
      <ul className="mt-1 space-y-0.5">
        {ponto.marcas.map((marca) => (
          <li key={marca.rotulo} className="flex items-center gap-2 text-corpo">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ background: marca.cor }}
            />
            <span className="text-tinta-2">{marca.rotulo}</span>
            <span className="numerico text-tinta font-medium ml-auto">{marca.texto}</span>
          </li>
        ))}
        {ponto.extras?.map((extra) => (
          <li key={extra.rotulo} className="flex items-center gap-2 text-corpo">
            {/* Recuo do tamanho do ponto, para o texto alinhar com as marcas. */}
            <span aria-hidden="true" className="size-2 shrink-0" />
            <span className="text-tinta-2">{extra.rotulo}</span>
            <span className="numerico text-tinta font-medium ml-auto">{extra.texto}</span>
          </li>
        ))}
      </ul>
      {ponto.href && (
        <div className="text-micro text-tinta-3 mt-1.5">Clique para abrir</div>
      )}
    </div>
  );
}
