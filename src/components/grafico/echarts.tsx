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
  ScatterChart,
  SunburstChart,
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
import { LabelLayout, UniversalTransition } from "echarts/features";
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
  ScatterChart,
  SunburstChart,
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
  // É o que faz a troca de visão (barras → treemap) virar uma transformação
  // animada em vez de um gráfico sumindo e outro aparecendo.
  UniversalTransition,
  CanvasRenderer,
]);

export type OpcaoGrafico = EChartsCoreOption;
export type EventoGrafico = ECElementEvent;

export function Grafico({
  opcao,
  altura = 320,
  rotulo,
  aoClicar,
  className = "",
}: {
  opcao: OpcaoGrafico;
  /** Em px, ou qualquer altura CSS. O canvas precisa de altura definida. */
  altura?: number | string;
  /** O que o gráfico mostra, para leitor de tela. */
  rotulo: string;
  aoClicar?: (evento: EventoGrafico) => void;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const grafico = useRef<echarts.ECharts | null>(null);
  const cores = useTemaGrafico();

  // O clique muda a cada render (é uma closure da página); a referência
  // evita refazer o `on("click")` toda vez.
  const clique = useRef(aoClicar);
  useEffect(() => {
    clique.current = aoClicar;
  }, [aoClicar]);

  // Nasce e morre com o elemento — e renasce quando o tema troca, porque o
  // tema do ECharts é fixado no `init`.
  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;

    const nomeDoTema = `repplast-${cores.modo}`;
    echarts.registerTheme(nomeDoTema, temaEcharts(cores));

    const instancia = echarts.init(elemento, nomeDoTema, { renderer: "canvas" });
    grafico.current = instancia;

    instancia.on("click", (evento) => clique.current?.(evento as EventoGrafico));

    const redimensionar = new ResizeObserver(() => instancia.resize());
    redimensionar.observe(elemento);

    return () => {
      redimensionar.disconnect();
      instancia.dispose();
      grafico.current = null;
    };
  }, [cores]);

  // `notMerge`: a opção é sempre a inteira. Mesclar com a anterior deixaria
  // séries da visão antiga vivas ao trocar de barras para treemap.
  useEffect(() => {
    grafico.current?.setOption(
      { aria: { enabled: true, label: { description: rotulo } }, ...opcao },
      { notMerge: true },
    );
  }, [opcao, rotulo, cores]);

  return (
    <div
      ref={caixa}
      // É por aqui que o cartão acha a instância para baixar o PNG.
      data-grafico=""
      role="img"
      aria-label={rotulo}
      className={`w-full ${aoClicar ? "cursor-pointer" : ""} ${className}`}
      style={{ height: altura }}
    />
  );
}
