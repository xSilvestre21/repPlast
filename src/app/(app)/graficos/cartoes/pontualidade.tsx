"use client";

/**
 * Pontualidade de entrega — das entregas registradas, quantas no prazo.
 *
 * As cores são de ESTADO, e só aqui elas valem como dado: verde no prazo,
 * vermelho atrasado, azul adiantado. Mês a mês em barras 100% empilhadas, para
 * comparar a proporção entre meses de volumes diferentes; ou a rosca do
 * período inteiro, com a taxa no meio.
 */

import { BarChart3, PieChart, Truck } from "lucide-react";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import { SeletorPeriodo, SeletorVisao, mesesDoPeriodo, type Periodo } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { SITUACOES, mesesAte, pontualidadeNoPeriodo } from "@/lib/grafico/agregar";
import type { BaseDosGraficos, SituacaoEntregaGrafico } from "@/lib/grafico/base";
import { porcento } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["meses", "rosca"] as const;
const PERIODOS = ["3", "6", "12"] as const;

const ROTULO: Record<SituacaoEntregaGrafico, string> = {
  no_prazo: "No prazo",
  adiantado: "Adiantado",
  atrasado: "Atrasado",
};

export function CartaoPontualidade({ base }: { base: BaseDosGraficos }) {
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("pon_visao", "meses", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("pon_periodo", "6", PERIODOS);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );
  const dados = useMemo(() => pontualidadeNoPeriodo(base, meses), [base, meses]);
  const semAtraso = dados.contagem.no_prazo + dados.contagem.adiantado;
  const taxa = dados.total ? semAtraso / dados.total : 0;

  const opcao = useMemo<OpcaoGrafico>(() => {
    const cor: Record<SituacaoEntregaGrafico, string> = {
      no_prazo: cores.verde,
      adiantado: cores.carimbo,
      atrasado: cores.perigo,
    };

    if (visao === "rosca") {
      return {
        tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
        legend: {
          bottom: 0,
          icon: "roundRect",
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: cores.tinta2, fontSize: 12 },
        },
        series: [
          {
            type: "pie",
            radius: ["50%", "74%"],
            center: ["50%", "44%"],
            padAngle: 2,
            itemStyle: { borderRadius: 6, borderColor: cores.folha, borderWidth: 2 },
            label: {
              show: true,
              position: "center",
              formatter: () => `{v|${porcento(taxa)}}\n{r|sem atraso}`,
              rich: {
                v: { fontSize: 20, fontWeight: 600, color: cores.tinta },
                r: { fontSize: 11, color: cores.tinta3, padding: [4, 0, 0, 0] },
              },
            },
            data: SITUACOES.map((s) => ({
              name: ROTULO[s],
              value: dados.contagem[s],
              itemStyle: { color: cor[s] },
            })),
          },
        ],
      };
    }

    // 100% empilhado: cada mês vira proporção, e o volume vai para o tooltip.
    const totais = meses.map((_, i) => SITUACOES.reduce((acc, s) => acc + dados.porMes[s][i], 0));
    return {
      legend: {
        top: 0,
        left: 0,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: cores.tinta2, fontSize: 12 },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (pontos: { seriesIndex: number; dataIndex: number; marker: string; seriesName: string }[]) => {
          const i = pontos[0]?.dataIndex ?? 0;
          if (totais[i] === 0) return `${base.rotulos[meses[i]]?.longo}<br/>sem entrega registrada`;
          return (
            `<b>${base.rotulos[meses[i]]?.longo}</b><br/>` +
            pontos
              .map((p) => {
                const n = dados.porMes[SITUACOES[p.seriesIndex]][i];
                return `${p.marker}${p.seriesName}: ${n} (${porcento(n / totais[i])})`;
              })
              .join("<br/>")
          );
        },
      },
      grid: { left: 8, right: 8, top: 32, bottom: 8 },
      xAxis: { type: "category", data: meses.map((m) => base.rotulos[m]?.curto ?? m) },
      yAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%" } },
      series: SITUACOES.map((s) => ({
        name: ROTULO[s],
        type: "bar",
        stack: "entregas",
        barMaxWidth: 28,
        itemStyle: { color: cor[s], borderColor: cores.folha, borderWidth: 1 },
        data: meses.map((_, i) => (totais[i] ? (dados.porMes[s][i] / totais[i]) * 100 : 0)),
      })),
    };
  }, [visao, dados, meses, base.rotulos, cores, taxa]);

  return (
    <CartaoGrafico
      titulo="Pontualidade de entrega"
      subtitulo={
        <>
          {descreverPeriodo(base, meses)}
          {dados.total > 0 && (
            <>
              {" "}
              · <b className="text-verde">{porcento(taxa)}</b> sem atraso em {dados.total}{" "}
              {dados.total === 1 ? "entrega" : "entregas"}
            </>
          )}
        </>
      }
      icone={Truck}
      tom="menta"
      vazio={dados.total === 0 ? "Nenhum pedido deste período tem entrega registrada." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "meses", rotulo: "Por mês", icone: BarChart3 },
              { valor: "rosca", rotulo: "Rosca", icone: PieChart },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
        </>
      }
    >
      <Grafico opcao={opcao} altura={240} rotulo="Entregas no prazo, adiantadas e atrasadas" />
    </CartaoGrafico>
  );
}
