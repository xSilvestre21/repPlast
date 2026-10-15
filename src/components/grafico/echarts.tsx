"use client";

/**
 * O ECharts dentro do React — sem wrapper de terceiros.
 *
 * O `echarts-for-react` existe, mas anda atrás das versões do ECharts e
 * esconde justamente o que aqui importa controlar: o tema refeito quando a
 * página troca de claro para escuro, e o `dispose` na desmontagem (sem ele, cada
 * troca de visão de um cartão deixaria um canvas órfão ouvindo o resize).
 *
 * Só os módulos usados são registrados (tree-shaking): o ECharts inteiro pesa
 * cerca de 1 MB; assim a rota leva só os tipos de gráfico desta página.
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  FunnelChart,
  HeatmapChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
} from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption, ECElementEvent } from "echarts/core";

import { temaEcharts } from "@/lib/grafico/tema-echarts";

import { naFila, segurarALargada } from "./fila-de-graficos";
import { useTemaGrafico } from "./use-tema-grafico";

echarts.use([
  BarChart,
  FunnelChart,
  HeatmapChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  TreemapChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
  // Sem `UniversalTransition` (a transformação animada de um tipo de gráfico
  // em outro): com poucos itens, a barra virando rosca passava por uma massa
  // disforme. Cada troca de visão monta o gráfico do zero, com a animação de
  // entrada dele — a rosca se fechando, as barras crescendo, a linha se
  // desenhando.
  CanvasRenderer,
]);

export type OpcaoGrafico = EChartsCoreOption;
export type EventoGrafico = ECElementEvent;

/**
 * A animação de uma mudança de tamanho. O ritmo do resto é o padrão do
 * ECharts (entrada de 1 s, `cubicOut`), de propósito: foi testado mais curto e
 * em cascata, e ficou menos bonito.
 */
const DURACAO_DO_REDIMENSIONAMENTO = 300;

/**
 * O que vale para todo gráfico, posto aqui para nenhum cartão esquecer:
 *
 *  - a descrição para leitor de tela;
 *  - o tooltip PRESO ao gráfico (`confine`): solto, o balão de um ponto na
 *    borda vazava para fora do cartão e, no celular, para fora da tela.
 *
 * Opção com `media` (regras por largura) tem a parte fixa em `baseOption` — e
 * é lá que o ECharts procura; no topo seria ignorado.
 */
function completar(opcao: OpcaoGrafico, rotulo: string): OpcaoGrafico {
  const responsiva = "baseOption" in opcao;
  const base = (responsiva ? opcao.baseOption : opcao) as OpcaoGrafico;

  const tooltip = base.tooltip as Record<string, unknown> | undefined;
  const completa = {
    aria: { enabled: true, label: { description: rotulo } },
    ...base,
    ...(tooltip ? { tooltip: { confine: true, ...tooltip } } : {}),
  };

  return responsiva ? { ...opcao, baseOption: completa } : completa;
}

/**
 * Descarta o gráfico de um jeito que nenhum desenho atrasado consiga quebrar
 * a página.
 *
 * Depois do `dispose`, o ZRender apaga as camadas do pintor (`_i = null`), mas
 * nem todo caminho confere isso antes de desenhar: um quadro de pintura já
 * agendado com `requestAnimationFrame`, um balão ou destaque que chega
 * atrasado. Qualquer um deles derrubava a tela com "Cannot read properties of
 * null (reading 'layerStack')" — no anel de indústrias, o mais pesado, foi
 * onde apareceu.
 *
 * Em vez de caçar cada chamador, os pontos de entrada do desenho viram
 * operações vazias no pintor descartado: o que chegar atrasado não tem mais o
 * que desenhar, e não quebra. É interno do ZRender — daí o acesso defensivo:
 * se um nome mudar numa versão futura, a linha simplesmente não faz nada.
 */
const ENTRADAS_DO_PINTOR = [
  "refresh",
  "refreshHover",
  "_paintList",
  "_doPaintList",
  "_paintHoverList",
  "_compositeManually",
  "resize",
  "clear",
] as const;

export function descartar(instancia: echarts.ECharts) {
  const pintor = instancia.getZr()?.painter as unknown as Record<string, unknown> | undefined;
  instancia.dispose();
  if (!pintor) return;
  for (const entrada of ENTRADAS_DO_PINTOR) {
    if (typeof pintor[entrada] === "function") pintor[entrada] = () => pintor;
  }
}


/** Confere a caixa contra o último tamanho desenhado — e o atualiza. */
function mudouDeTamanho(elemento: HTMLElement, ultimo: { current: { largura: number; altura: number } }) {
  const { clientWidth: largura, clientHeight: altura } = elemento;
  if (largura === ultimo.current.largura && altura === ultimo.current.altura) return false;
  ultimo.current = { largura, altura };
  return true;
}

export function Grafico({
  opcao,
  altura = 320,
  rotulo,
  aoClicar,
  aoClicarCategoria,
  eixoDaCategoria = "x",
  className = "",
}: {
  opcao: OpcaoGrafico;
  /**
   * A altura MÍNIMA, em px ou qualquer altura CSS. Dentro de uma coluna flex
   * o gráfico cresce até ocupar a sobra — é assim que dois cartões lado a lado
   * ficam da mesma altura sem um vão vazio no pé do mais baixo.
   */
  altura?: number | string;
  /** O que o gráfico mostra, para leitor de tela. */
  rotulo: string;
  aoClicar?: (evento: EventoGrafico) => void;
  /**
   * Clique em qualquer ponto da coluna de uma categoria do eixo x (um mês),
   * e não só em cima da barra ou do ponto — que numa linha fina ninguém
   * acerta. Recebe o índice da categoria. Clique numa série continua indo
   * para `aoClicar`.
   */
  aoClicarCategoria?: (indice: number) => void;
  /** Onde estão as categorias: "y" nas barras deitadas (um cliente por linha). */
  eixoDaCategoria?: "x" | "y";
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const grafico = useRef<echarts.ECharts | null>(null);
  const cores = useTemaGrafico();

  // O clique muda a cada render (é uma closure da página); a referência
  // evita refazer o `on("click")` toda vez.
  const clique = useRef(aoClicar);
  const cliqueCategoria = useRef(aoClicarCategoria);
  const eixo = useRef(eixoDaCategoria);
  useEffect(() => {
    clique.current = aoClicar;
    cliqueCategoria.current = aoClicarCategoria;
    eixo.current = eixoDaCategoria;
  }, [aoClicar, aoClicarCategoria, eixoDaCategoria]);

  // A opção mais recente, para o gráfico que nasce depois do render (a fila).
  const opcaoAtual = useRef({ opcao, rotulo });
  useLayoutEffect(() => {
    opcaoAtual.current = { opcao, rotulo };
  }, [opcao, rotulo]);

  // A opção que o gráfico já mostra — para o efeito de baixo não repetir a do
  // nascimento, o que recomeçaria a animação de entrada.
  const aplicada = useRef<{ opcao: OpcaoGrafico; rotulo: string } | null>(null);

  // O tamanho para o qual o gráfico foi desenhado por último.
  const tamanho = useRef({ largura: 0, altura: 0 });

  // Como soltar a animação segurada no último `setOption` (`segurarALargada`).
  const largada = useRef(() => {});

  /*
   * Nasce e morre com o elemento — e renasce quando o tema troca, porque o
   * tema do ECharts é fixado no `init`.
   *
   * Quem decide QUANDO é a fila (`fila-de-graficos.ts`): o que está na tela
   * nasce na hora, junto com os vizinhos; o de fora espera a vez. A caixa já
   * ocupa o lugar dela desde o primeiro quadro, então nada pula quando o
   * desenho chega.
   *
   * Efeito de LAYOUT, que roda antes da pintura: o custo de criar os gráficos
   * da primeira dobra entra no mesmo trabalho que monta a página, e a tela já
   * começa a aparecer com eles prontos. Num efeito comum, a criação caía
   * depois — no meio da cascata dos cartões, que parava por um quadro longo.
   */
  useLayoutEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;

    /** O gráfico desta caixa, depois que a fila o criou. */
    let vivo: echarts.ECharts | null = null;
    let quadro = 0;
    let redimensionar: ResizeObserver | null = null;

    // Ligado a cada gráfico que nasce: os cliques e o acompanhamento do tamanho.
    const configurar = (instancia: echarts.ECharts) => {
      /*
       * Dois caminhos para o mesmo clique. A série (barra, ponto, fatia) vai
       * para `aoClicar`; o resto da área dos eixos vai para `aoClicarCategoria`
       * — inclusive a área pintada sob uma linha, que é um alvo do ECharts mas
       * não é um dado. A marca `tratado` evita que um clique numa barra dispare
       * os dois; a categoria espera o fim do evento para saber.
       */
      let tratado = false;

      instancia.on("click", (evento) => {
        // O nome no eixo (com `triggerEvent`) vale como clique na categoria: é
        // nele que a mão vai primeiro numa lista de clientes.
        const doEixo = evento as EventoGrafico & { componentType?: string; value?: unknown };
        if (doEixo.componentType === "xAxis" || doEixo.componentType === "yAxis") {
          const categorias = instancia.getOption()[doEixo.componentType] as { data?: unknown[] }[];
          const indice = categorias?.[0]?.data?.indexOf(doEixo.value) ?? -1;
          if (indice >= 0) cliqueCategoria.current?.(indice);
          tratado = true;
          return;
        }
        if (typeof evento.dataIndex !== "number" || !clique.current) return;
        tratado = true;
        clique.current(evento as EventoGrafico);
      });

      instancia.getZr().on("click", (evento) => {
        const ponto = [evento.offsetX, evento.offsetY];
        setTimeout(() => {
          const jaFoi = tratado;
          tratado = false;
          const aoCategoria = cliqueCategoria.current;
          if (jaFoi || !aoCategoria || instancia.isDisposed() || !instancia.containPixel("grid", ponto)) return;
          // Pelo grid, e não pelo eixo: pedido ao eixo, o ECharts devolve `null`.
          // O grid devolve [x, y] em coordenadas de dado — numa categoria, o índice.
          const valor = instancia.convertFromPixel({ gridIndex: 0 }, ponto) as number[] | null;
          const indice = Math.round(valor?.[eixo.current === "y" ? 1 : 0] ?? NaN);
          if (Number.isFinite(indice) && indice >= 0) aoCategoria(indice);
        });
      });

      /*
       * O resize vai para o próximo quadro: feito dentro do próprio callback do
       * observador, ele mudava o layout no meio da medição e o navegador acusava
       * "ResizeObserver loop completed with undelivered notifications".
       *
       * E só quando o tamanho mudou DE FATO: o observador também avisa na
       * primeira observação e em mudanças que não alteram a caixa, e cada
       * `resize()` redesenha o gráfico inteiro.
       *
       * Com transição: o `resize()` puro redesenha tudo no estado final, sem
       * animação — e cortava ao meio a entrada que estivesse rodando. Quando a
       * troca de visão no cartão vizinho muda a altura da linha, este aqui
       * acompanha encolhendo ou crescendo, em vez de pular.
       */
      tamanho.current = { largura: elemento.clientWidth, altura: elemento.clientHeight };
      redimensionar = new ResizeObserver(() => {
        cancelAnimationFrame(quadro);
        quadro = requestAnimationFrame(() => {
          if (!mudouDeTamanho(elemento, tamanho)) return;
          instancia.resize({ animation: { duration: DURACAO_DO_REDIMENSIONAMENTO, easing: "cubicOut" } });
        });
      });
      redimensionar.observe(elemento);
    };

    const desistir = naFila(elemento, () => {
      const nomeDoTema = `repplast-${cores.modo}`;
      echarts.registerTheme(nomeDoTema, temaEcharts(cores));

      const criada = echarts.init(elemento, nomeDoTema, { renderer: "canvas" });
      vivo = criada;
      grafico.current = criada;
      configurar(criada);
      const { opcao, rotulo } = opcaoAtual.current;
      criada.setOption(completar(opcao, rotulo), { notMerge: true });
      largada.current = segurarALargada(elemento, criada.getZr().animation);
      aplicada.current = { opcao, rotulo };
    });

    return () => {
      desistir();
      largada.current();
      largada.current = () => {};
      cancelAnimationFrame(quadro);
      redimensionar?.disconnect();
      if (vivo) descartar(vivo);
      grafico.current = null;
      aplicada.current = null;
    };
  }, [cores]);

  // `notMerge`: a opção é sempre a inteira. Mesclar com a anterior deixaria
  // séries da visão antiga vivas ao trocar de barras para treemap. Ainda na
  // fila, não há o que atualizar: ele nasce com a opção mais recente.
  //
  // A caixa que mudou de altura junto com a visão (rosca → barras) é medida
  // ANTES do `setOption`: redimensionada depois, pelo observador, ela cortava
  // no meio a animação da troca — as barras já apareciam prontas, secas.
  //
  // E a animação da troca espera a thread ficar livre para começar, como a
  // de entrada: o clique que a disparou ainda está re-renderizando a página.
  useLayoutEffect(() => {
    const instancia = grafico.current;
    const elemento = caixa.current;
    if (!instancia || !elemento) return;
    if (aplicada.current?.opcao === opcao && aplicada.current.rotulo === rotulo) return;
    if (mudouDeTamanho(elemento, tamanho)) instancia.resize();
    largada.current();
    instancia.setOption(completar(opcao, rotulo), { notMerge: true });
    largada.current = segurarALargada(elemento, instancia.getZr().animation);
    aplicada.current = { opcao, rotulo };
  }, [opcao, rotulo, cores]);

  /*
   * Duas camadas: a de fora decide o tamanho (altura mínima + o que sobrar no
   * cartão), a de dentro, absoluta, é onde o ECharts desenha. O ECharts fixa
   * a altura do canvas em px; dentro do fluxo, esse canvas antigo segurava o
   * contêiner — trocar de anéis para barras deixava o cartão com a altura dos
   * anéis, e o resize que corrigiria nunca vinha, porque nada "mudava".
   */
  return (
    <div
      role="img"
      aria-label={rotulo}
      className={`relative w-full flex-1 ${aoClicar || aoClicarCategoria ? "cursor-pointer" : ""} ${className}`}
      style={{ minHeight: altura }}
    >
      <div
        ref={caixa}
        // É por aqui que o cartão acha a instância para baixar o PNG.
        data-grafico=""
        className="absolute inset-0"
      />
    </div>
  );
}
