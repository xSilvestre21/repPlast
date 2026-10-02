"use client";

/**
 * Comissão mês a mês — previsto contra recebido, com a meta e o ano anterior.
 *
 * O período (6, 12 ou 24 meses) mora AQUI, no cartão que ele muda.
 *
 * Três leituras do mesmo histórico:
 *   - barras: mês contra mês, previsto ao lado do recebido;
 *   - linha: a tendência, sem o peso visual das barras;
 *   - acumulado: o ano correndo — onde a meta acumulada mostra se o ritmo dá.
 *
 * Um eixo só, sempre (a regra número um da skill de dataviz): meta e ano
 * anterior são dinheiro na mesma escala, então dividem o eixo sem truque.
 */

import { AreaChart, BarChart3, LineChart, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import {
  Alternancia,
  SeletorPeriodo,
  SeletorVisao,
  mesesDoPeriodo,
  type Periodo,
} from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { deslocarCompetencia } from "@/lib/comissao";
import { acumular, mesesAte, somaPorMes } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["barras", "linha", "acumulado"] as const;
const PERIODOS = ["6", "12", "24"] as const;
const LIGADO = ["sim", "nao"] as const;

export function CartaoMensal({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("mes_visao", "barras", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("mes_periodo", "12", PERIODOS);
  const [comMeta, setComMeta] = useParametro("mes_meta", "sim", LIGADO);
  const [comAnterior, setComAnterior] = useParametro("mes_anterior", "nao", LIGADO);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );

  // O ano anterior só existe enquanto os 12 meses de antes estão na base.
  const anteriorDisponivel = mesesDoPeriodo(periodo) <= 12;
  const temMeta = meses.some((m) => base.metas[m] !== undefined);
  const mostrarMeta = comMeta === "sim" && temMeta;
  const mostrarAnterior = comAnterior === "sim" && anteriorDisponivel;

  const series = useMemo(() => {
    const previsto = somaPorMes(base.itens, meses, (i) => i.previsto);
    const recebido = somaPorMes(base.itens, meses, (i) => i.recebido ?? 0);
    const anterior = somaPorMes(
      base.itens,
      meses.map((m) => deslocarCompetencia(m, -12)),
      (i) => i.recebido ?? 0,
    );
    const meta = meses.map((m) => base.metas[m] ?? null);
    return { previsto, recebido, anterior, meta };
  }, [base.itens, base.metas, meses]);

  const totalRecebido = series.recebido.reduce((a, b) => a + b, 0);
  const batidas = meses.filter((_, i) => {
    const meta = series.meta[i];
    return meta !== null && meta > 0 && series.recebido[i] >= meta;
  }).length;

  const opcao = useMemo<OpcaoGrafico>(() => {
    const acumulado = visao === "acumulado";
    const ajustar = (lista: number[]) => (acumulado ? acumular(lista) : lista);
    const meta = acumulado
      ? acumular(series.meta.map((m) => m ?? 0))
      : series.meta;

    const batida = (i: number) => {
      const alvo = series.meta[i];
      return alvo !== null && alvo > 0 && series.recebido[i] >= alvo;
    };

    const rotulosEixo = meses.map((m) => base.rotulos[m]?.curto ?? m);
    const tipo = visao === "barras" ? "bar" : "line";

    const comZoom = meses.length > 12;

    return {
      legend: {
        top: 0,
        left: 0,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 4,
        textStyle: { color: cores.tinta2, fontSize: 12 },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: visao === "barras" ? "shadow" : "line", shadowStyle: { color: cores.filete } },
        // O valor na frente, o nome atrás — quem lê o balão já sabe a série.
        formatter: (pontos: { seriesName: string; value: number | null; color: string; dataIndex: number }[]) => {
          const i = pontos[0]?.dataIndex ?? 0;
          const titulo = base.rotulos[meses[i]]?.longo ?? meses[i];
          const linhas = pontos
            .filter((p) => p.value !== null && p.value !== undefined)
            .map(
              (p) =>
                `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between">` +
                `<span style="display:inline-flex;align-items:center;gap:6px;opacity:.75">` +
                `<span style="width:10px;height:2px;background:${p.color};display:inline-block"></span>` +
                `${escapar(p.seriesName)}</span><b>${moedaDe(p.value!)}</b></div>`,
            )
            .join("");
          const marca = !acumulado && batida(i) ? `<div style="color:${cores.verde};margin-top:4px">✓ meta batida</div>` : "";
          return `<div style="min-width:180px"><div style="margin-bottom:6px;font-weight:600">${escapar(titulo)}</div>${linhas}${marca}</div>`;
        },
      },
      grid: { left: 8, right: 16, top: 40, bottom: comZoom ? 48 : 8 },
      xAxis: { type: "category", data: rotulosEixo, boundaryGap: visao === "barras" },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (v: number) => moedaCompactaDe(v) },
      },
      dataZoom: comZoom
        ? [
            { type: "inside", startValue: meses.length - 12, endValue: meses.length - 1 },
            { type: "slider", height: 18, bottom: 6, startValue: meses.length - 12, endValue: meses.length - 1 },
          ]
        : [{ type: "inside" }],
      series: [
        {
          name: "Previsto",
          type: tipo,
          data: ajustar(series.previsto),
          barMaxWidth: 22,
          barGap: "12%",
          smooth: 0.25,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { width: 2, type: "solid" },
          // O previsto é o fantasma do recebido: presente, mas recessivo.
          itemStyle: { color: cores.tinta3, borderRadius: [4, 4, 0, 0], opacity: visao === "barras" ? 0.45 : 1 },
          areaStyle: acumulado ? { opacity: 0.08 } : undefined,
          universalTransition: true,
        },
        {
          name: "Recebido",
          type: tipo,
          data: ajustar(series.recebido).map((valor, i) => ({
            value: valor,
            // O ✓ em cima do mês em que a meta foi batida.
            label:
              !acumulado && mostrarMeta && batida(i)
                ? { show: true, position: "top", formatter: "✓", color: cores.verde, fontWeight: 700, fontSize: 13 }
                : undefined,
          })),
          barMaxWidth: 22,
          smooth: 0.25,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { width: 2.5 },
          itemStyle: { color: cores.verde, borderRadius: [4, 4, 0, 0] },
          areaStyle: acumulado || visao === "linha" ? { opacity: 0.12 } : undefined,
          emphasis: { focus: "series" },
          universalTransition: true,
        },
        ...(mostrarMeta
          ? [
              {
                name: acumulado ? "Meta acumulada" : "Meta",
                type: "line",
                // Degrau: a meta vale o mês inteiro, não "sobe" entre um mês e outro.
                step: acumulado ? undefined : "middle",
                data: meta,
                symbol: "none",
                lineStyle: { width: 1.5, type: "dashed", color: cores.tinta },
                itemStyle: { color: cores.tinta },
                z: 5,
              },
            ]
          : []),
        ...(mostrarAnterior
          ? [
              {
                name: "Recebido ano anterior",
                type: "line",
                data: ajustar(series.anterior),
                smooth: 0.25,
                symbol: "emptyCircle",
                symbolSize: 5,
                lineStyle: { width: 1.5, type: "dotted", color: cores.categoricas[0] },
                itemStyle: { color: cores.categoricas[0] },
                z: 4,
              },
            ]
          : []),
      ],
    };
  }, [visao, series, meses, base.rotulos, cores, mostrarMeta, mostrarAnterior]);

  return (
    <CartaoGrafico
      titulo="Comissão mês a mês"
      subtitulo={
        <>
          {descreverPeriodo(base, meses)} · {moedaDe(totalRecebido)} recebidos
          {temMeta && (
            <>
              {" "}
              · <span className="text-verde font-medium">meta batida em {batidas}</span> de{" "}
              {meses.filter((m) => base.metas[m] !== undefined).length} meses
            </>
          )}
        </>
      }
      icone={TrendingUp}
      tom="menta"
      vazio={series.previsto.every((v) => v === 0) ? "Nenhum pedido enviado neste período." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "barras", rotulo: "Barras", icone: BarChart3 },
              { valor: "linha", rotulo: "Linha", icone: LineChart },
              { valor: "acumulado", rotulo: "Acumulado", icone: AreaChart },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
          <Alternancia
            ligada={mostrarMeta}
            aoMudar={(l) => setComMeta(l ? "sim" : "nao")}
            desabilitada={!temMeta}
            titulo={temMeta ? undefined : "Defina uma meta na tela de Comissões"}
          >
            Meta
          </Alternancia>
          <Alternancia
            ligada={mostrarAnterior}
            aoMudar={(l) => setComAnterior(l ? "sim" : "nao")}
            desabilitada={!anteriorDisponivel}
            titulo={anteriorDisponivel ? undefined : "Disponível até 12 meses"}
          >
            Ano anterior
          </Alternancia>
        </>
      }
      rodape={
        <p className="text-mini text-tinta-3">
          Arraste ou use a roda do mouse para dar zoom · clique num mês para abrir a apuração dele ·
          clique na legenda para esconder uma série.
        </p>
      }
    >
      <Grafico
        opcao={opcao}
        altura={360}
        rotulo="Comissão mês a mês, previsto e recebido"
        aoClicar={(e) => {
          const mes = meses[e.dataIndex];
          if (mes) router.push(`/comissoes?mes=${mes}`);
        }}
      />
    </CartaoGrafico>
  );
}
