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

import { useEffect, useRef } from "react";
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
  // em outro): trocar de rosca para barras travava no meio do caminho e
  // deixava a rosca congelada por cima das barras. A troca de visão é
  // instantânea, como num painel de verdade.
  CanvasRenderer,
]);

export type OpcaoGrafico = EChartsCoreOption;
export type EventoGrafico = ECElementEvent;

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

  // Nasce e morre com o elemento — e renasce quando o tema troca, porque o
  // tema do ECharts é fixado no `init`.
  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;

    const nomeDoTema = `repplast-${cores.modo}`;
    echarts.registerTheme(nomeDoTema, temaEcharts(cores));

    const instancia = echarts.init(elemento, nomeDoTema, { renderer: "canvas" });
    grafico.current = instancia;

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

    // O resize vai para o próximo quadro: feito dentro do próprio callback do
    // observador, ele mudava o layout no meio da medição e o navegador acusava
    // "ResizeObserver loop completed with undelivered notifications".
    let quadro = 0;
    const redimensionar = new ResizeObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => instancia.resize());
    });
    redimensionar.observe(elemento);

    return () => {
      cancelAnimationFrame(quadro);
      redimensionar.disconnect();
      descartar(instancia);
      grafico.current = null;
    };
  }, [cores]);

  // `notMerge`: a opção é sempre a inteira. Mesclar com a anterior deixaria
  // séries da visão antiga vivas ao trocar de barras para treemap.
  useEffect(() => {
    grafico.current?.setOption(completar(opcao, rotulo), { notMerge: true });
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
