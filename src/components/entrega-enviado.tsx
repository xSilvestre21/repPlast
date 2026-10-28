"use client";

/**
 * "Enviado", entregue por um avião de papel — o do pedido e o da proposta.
 *
 * Mandar um documento é o momento que fecha a venda para quem representa — e
 * o aviso ficava num canto da página, pequeno como um rodapé. Aqui ele vira um
 * acontecimento curto: a tela escurece sem sumir (dá para ver o pedido por
 * trás), o avião de papel — o mesmo ícone do botão de enviar — cruza em arco,
 * e no meio do caminho deixa o cartão no centro dizendo para quem foi.
 *
 * Some sozinho em ~3 s, ou antes com um clique ou Esc. Quando o servidor
 * recusou parte dos endereços NÃO some: espera um "Entendi", porque esse aviso
 * não pode passar despercebido.
 *
 * Tudo o que se move aqui anima só `transform` e `opacity` — as duas coisas
 * que a GPU anima sozinha, sem a thread principal. Isso importa justamente
 * neste momento: o envio acabou de voltar e o React está recarregando a tela
 * por baixo. O voo era `offset-path` e o rastro um SVG de tela inteira
 * redesenhado a cada quadro (`stroke-dashoffset`), os dois na thread
 * principal — e travavam bem quando ela estava ocupada.
 *
 * O desenho continua o mesmo — a mesma linha fina se desenhando atrás do
 * avião, o mesmo arco, a mesma curva de voo, o mesmo esmaecer. Mudou só como
 * ele é feito: a trajetória é amostrada uma vez; o avião percorre os pontos
 * com `transform` (Web Animations), e a linha do rastro é feita de trechos
 * curtos emendados, cada um acendendo (`opacity`) quando o avião chega ao fim
 * dele. Com as animações desligadas na conta, o avião e o rastro nem aparecem
 * e o cartão já nasce no lugar.
 */

import { CircleCheck, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { focarSePuder } from "@/components/foco";
import { Botao } from "@/components/ui";

/** Quanto o cartão fica na tela depois de pousar, antes de sumir sozinho. */
const TEMPO_NA_TELA_MS = 3600;
/** A saída: o esmaecer do fundo e do cartão, antes de desmontar. */
const SAIDA_MS = 250;
/** O voo inteiro — o cartão pousa quando o avião passa pelo centro, ~45%. */
const VOO_MS = 1250;
/** Mesma curva do voo de antes: arranca devagar, acelera, freia na saída. */
const CURVA_DO_VOO: [number, number, number, number] = [0.45, 0.05, 0.35, 1];
/** Quantos pontos descrevem o voo do avião. */
const AMOSTRAS = 64;
/**
 * Em quantos trechos a linha do rastro é dividida. Curtos o bastante para a
 * linha parecer se desenhar de forma contínua, e não aos saltos.
 */
const TRECHOS_DO_RASTRO = 140;
/** O avião aparece nos primeiros 8% do voo e some nos últimos 15% — como era. */
const APARECE_ATE = 0.08;
const SOME_A_PARTIR = 0.85;

/** `cubic-bezier(x1, y1, x2, y2)` como função: tempo (0–1) → progresso (0–1). */
function curva([x1, y1, x2, y2]: [number, number, number, number]) {
  const coord = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    // A curva é dada em t; acha o t cujo x é o tempo pedido (busca binária).
    let baixo = 0;
    let alto = 1;
    for (let i = 0; i < 24; i++) {
      const meio = (baixo + alto) / 2;
      if (coord(meio, x1, x2) < x) baixo = meio;
      else alto = meio;
    }
    return coord((baixo + alto) / 2, y1, y2);
  };
}

/** O instante (0–1) em que o avião chega a uma fração do caminho. */
function instanteDe(progresso: number, progressoNoTempo: (t: number) => number): number {
  let baixo = 0;
  let alto = 1;
  for (let i = 0; i < 24; i++) {
    const meio = (baixo + alto) / 2;
    if (progressoNoTempo(meio) < progresso) baixo = meio;
    else alto = meio;
  }
  return (baixo + alto) / 2;
}

interface Ponto {
  x: number;
  y: number;
  /** Direção do caminho naquele ponto, em graus. */
  angulo: number;
}

/** Pontos igualmente espaçados ao longo do caminho, com a direção de cada um. */
function amostrar(caminho: string, quantos: number): Ponto[] {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.setAttribute("d", caminho);
  const total = svg.getTotalLength();
  const pontos: Ponto[] = [];
  for (let i = 0; i <= quantos; i++) {
    const distancia = (total * i) / quantos;
    const aqui = svg.getPointAtLength(distancia);
    const adiante = svg.getPointAtLength(Math.min(total, distancia + 1));
    const atras = svg.getPointAtLength(Math.max(0, distancia - 1));
    const angulo = (Math.atan2(adiante.y - atras.y, adiante.x - atras.x) * 180) / Math.PI;
    pontos.push({ x: aqui.x, y: aqui.y, angulo });
  }
  return pontos;
}

/**
 * O arco do voo: entra por baixo à esquerda, mergulha pelo centro (onde o
 * cartão pousa) e sai por cima à direita.
 */
function trajetoria(largura: number, altura: number): string {
  const x = (fracao: number) => Math.round(largura * fracao);
  const y = (fracao: number) => Math.round(altura * fracao);
  return (
    `M ${x(-0.06)} ${y(0.92)} ` +
    `C ${x(0.18)} ${y(0.4)}, ${x(0.38)} ${y(0.28)}, ${x(0.5)} ${y(0.5)} ` +
    `C ${x(0.6)} ${y(0.7)}, ${x(0.76)} ${y(0.22)}, ${x(1.08)} ${y(-0.08)}`
  );
}

export function EntregaEnviado({
  titulo,
  para,
  cc,
  aviso,
  fechar,
}: {
  /** "Pedido enviado para a ALFAPLAST", "Proposta enviada para a LYRA". */
  titulo: string;
  para: string[];
  cc: string[];
  aviso?: string;
  fechar: () => void;
}) {
  // Só monta depois de um envio, no navegador: a janela já existe.
  const [janela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  const [saindo, setSaindo] = useState(false);
  const saida = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sair = useCallback(() => {
    if (saida.current) return;
    setSaindo(true);
    saida.current = setTimeout(fechar, SAIDA_MS);
  }, [fechar]);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") sair();
    };
    window.addEventListener("keydown", aoTeclar);

    // Com recusa, a pessoa precisa ler — nada de sumir sozinho.
    const cronometro = aviso ? undefined : setTimeout(sair, TEMPO_NA_TELA_MS);

    return () => {
      window.removeEventListener("keydown", aoTeclar);
      clearTimeout(cronometro);
    };
  }, [aviso, sair]);

  useEffect(() => () => clearTimeout(saida.current), []);

  // O "Entendi" com o foco, para o Enter dispensar — só no teclado (`foco.ts`).
  const entendi = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focarSePuder(entendi.current);
  }, []);

  const caminho = trajetoria(janela.largura, janela.altura);
  const aviao = useRef<HTMLSpanElement>(null);

  /*
   * O rastro: a linha cortada em trechos, cada um do ponto i ao i+1, e o
   * instante em que o avião passa pelo MEIO dele — é quando ele acende. Pelo
   * meio, e não pelo fim: a ponta da linha fica sempre escondida sob o avião,
   * como no traço contínuo de antes, sem ficar um trecho para trás.
   */
  const rastro = useMemo(() => {
    const progressoNoTempo = curva(CURVA_DO_VOO);
    const pontos = amostrar(caminho, TRECHOS_DO_RASTRO);
    return pontos.slice(0, -1).map((ponto, i) => {
      const proximo = pontos[i + 1];
      return {
        x: ponto.x,
        y: ponto.y,
        angulo: (Math.atan2(proximo.y - ponto.y, proximo.x - ponto.x) * 180) / Math.PI,
        // Um fio a mais de comprimento, para os trechos se emendarem sem fresta.
        comprimento: Math.hypot(proximo.x - ponto.x, proximo.y - ponto.y) + 1,
        atrasoMs: Math.round(
          instanteDe((i + 0.5) / TRECHOS_DO_RASTRO, progressoNoTempo) * VOO_MS,
        ),
      };
    });
  }, [caminho]);

  /*
   * O voo, pela Web Animations: só `transform` e `opacity`, então roda no
   * compositor. O progresso ao longo dos pontos é linear; a curva do voo vai
   * no `easing` da animação inteira, como era no CSS.
   */
  useEffect(() => {
    const elemento = aviao.current;
    if (!elemento || document.documentElement.dataset.animacoes === "desativadas") return;

    const progressoNoTempo = curva(CURVA_DO_VOO);
    const pontos = amostrar(caminho, AMOSTRAS);
    const quadros: Keyframe[] = pontos.map((ponto, i) => {
      const fracao = i / AMOSTRAS;
      // O esmaecer é medido em TEMPO, como era no CSS: o instante em que o
      // avião passa por este ponto decide quanto ele já apareceu ou sumiu.
      const instante = instanteDe(fracao, progressoNoTempo);
      const opacidade =
        instante < APARECE_ATE
          ? instante / APARECE_ATE
          : instante > SOME_A_PARTIR
            ? (1 - instante) / (1 - SOME_A_PARTIR)
            : 1;
      return {
        offset: fracao,
        transform: `translate(${ponto.x}px, ${ponto.y}px) rotate(${ponto.angulo}deg)`,
        opacity: Math.max(0, Math.min(1, opacidade)),
      };
    });

    const voo = elemento.animate(quadros, {
      duration: VOO_MS,
      easing: `cubic-bezier(${CURVA_DO_VOO.join(", ")})`,
      fill: "both",
    });
    return () => voo.cancel();
  }, [caminho]);

  return createPortal(
    <div
      className={`entrega fixed inset-0 z-[60] grid place-items-center p-4 ${saindo ? "entrega-saindo" : ""}`}
      onClick={sair}
    >
      {/* O desfoque de 2px da página por trás NÃO mora aqui: ver `.entrega-fundo`. */}
      <div className="entrega-fundo absolute inset-0 bg-black/45" />

      {/* O rastro: a linha fina que se desenha atrás do avião. */}
      <div aria-hidden="true" className="entrega-rastro pointer-events-none absolute inset-0">
        {rastro.map((trecho, i) => (
          <span
            key={i}
            className="entrega-trecho"
            style={
              {
                width: trecho.comprimento,
                transform: `translate(${trecho.x}px, ${trecho.y}px) rotate(${trecho.angulo}deg)`,
                "--atraso": `${trecho.atrasoMs}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div
        role={aviso ? "alertdialog" : "status"}
        aria-live={aviso ? undefined : "polite"}
        aria-label={aviso ? `${titulo}, com recusas` : undefined}
        onClick={(evento) => evento.stopPropagation()}
        className="entrega-cartao relative w-full max-w-[26rem] rounded-suave border border-filete bg-folha p-5
          text-center shadow-[var(--sombra-alta)]"
      >
        <CircleCheck
          size={36}
          strokeWidth={1.75}
          aria-hidden="true"
          className="mx-auto mb-3 text-verde"
        />
        <p className="text-realce font-semibold text-tinta">{titulo}</p>
        <p className="mt-1.5 break-words text-corpo text-tinta-2">
          Para {para.join(", ")}
          {cc.length > 0 && ` · cópia para ${cc.join(", ")}`}
        </p>

        {aviso && (
          <>
            <p className="mt-3 rounded-suave bg-perigo-fraco px-3 py-2 text-corpo text-perigo">
              {aviso}
            </p>
            <div className="mt-4 flex justify-center">
              <Botao ref={entendi} type="button" onClick={sair}>
                Entendi
              </Botao>
            </div>
          </>
        )}
      </div>

      {/*
        Depois do cartão no DOM, para passar POR CIMA dele — é quem entrega.
        Preenchido com a cor do papel e contornado de azul: um avião de papel
        de verdade, e não um traço fino que some contra o fundo escurecido.
      */}
      <span
        ref={aviao}
        aria-hidden="true"
        // Caixa de tamanho zero com a origem no canto: o `transform` do voo
        // põe ESTE ponto sobre a trajetória e gira em torno dele. Com a origem
        // no meio de uma caixa de ícone, cada giro empurrava o avião para fora
        // do caminho.
        className="entrega-aviao pointer-events-none absolute left-0 top-0 block size-0 origin-top-left text-carimbo"
      >
        {/*
          O ícone aponta para o nordeste (-45°); +45° o deixa apontando para a
          direita, que é o ângulo zero da trajetória. Centrado no ponto do
          caminho pelo `-translate-1/2`.
        */}
        <Send
          size={46}
          strokeWidth={1.6}
          fill="var(--folha)"
          className="absolute left-0 top-0 max-w-none -translate-x-1/2 -translate-y-1/2 rotate-45 drop-shadow-[0_6px_10px_rgb(0_0_0/0.3)]"
        />
      </span>
    </div>,
    document.body,
  );
}
