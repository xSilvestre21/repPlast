"use client";

/**
 * Curva ABC de clientes — onde a carteira se concentra.
 *
 * A curva é o acumulado da comissão, do maior cliente para o menor, com as
 * faixas A (até 80%), B (até 95%) e C sombreadas por trás. A conta é a de
 * `curvaAbc` (`lib/grafico/geometria.ts`), a mesma do PDF.
 *
 * Um eixo só, o do acumulado em %: barras de valor por cliente num segundo eixo
 * fariam o gráfico de dois eixos que a skill de dataviz proíbe. O valor de cada
 * cliente está no tooltip e na tabela.
 */

import { Table2, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import {
  SeletorMetrica,
  SeletorPeriodo,
  SeletorVisao,
  mesesDoPeriodo,
  type Periodo,
} from "@/components/grafico/seletores";
import { TabelaDados } from "@/components/grafico/tabela-dados";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { mesesAte, noPeriodo, porCliente, type Metrica } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaDe } from "@/lib/grafico/formato";
import { curvaAbc, type Banda } from "@/lib/grafico/geometria";
import { comAlfa } from "@/lib/grafico/tema-echarts";

import { descreverPeriodo } from "./periodo";

const VISOES = ["curva", "tabela"] as const;
const PERIODOS = ["3", "6", "12"] as const;
const METRICAS = ["previsto", "recebido"] as const;

export function CartaoAbc({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("abc_visao", "curva", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("abc_periodo", "6", PERIODOS);
  const [metrica, setMetrica] = useParametro<Metrica>("abc_medida", "previsto", METRICAS);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );

  const curva = useMemo(
    () =>
      curvaAbc(
        porCliente(noPeriodo(base.itens, meses), metrica).map((f) => ({
          chave: f.chave,
          rotulo: f.rotulo,
          valor: f.valor,
          detalhe: `${f.pedidos} ${f.pedidos === 1 ? "pedido" : "pedidos"}`,
        })),
      ),
    [base.itens, meses, metrica],
  );

  // A ordinal A → B → C desce de intensidade no mesmo tom: é escala, não categoria.
  const corDaBanda: Record<Banda, string> = {
    A: cores.categoricas[0],
    B: comAlfa(cores.categoricas[0], 0.55),
    C: cores.tinta3,
  };

  const opcao = useMemo<OpcaoGrafico>(() => {
    const n = curva.itens.length;
    const faixa = (banda: Banda) => {
      const daBanda = curva.itens.filter((i) => i.banda === banda);
      if (daBanda.length === 0) return null;
      return [
        {
          xAxis: curva.itens.indexOf(daBanda[0]),
          // O fundo da faixa: o tom da curva, mais apagado quanto mais baixa a classe.
          itemStyle: { color: comAlfa(cores.categoricas[0], { A: 0.12, B: 0.07, C: 0.03 }[banda]) },
          label: {
            show: true,
            position: "insideTop",
            formatter: `${banda} · ${curva.contagem[banda]}`,
            color: cores.tinta2,
            fontSize: 11,
            fontWeight: 600,
          },
        },
        { xAxis: curva.itens.indexOf(daBanda.at(-1)!) },
      ];
    };

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: cores.fileteForte } },
        formatter: (pontos: { dataIndex: number }[]) => {
          const item = curva.itens[pontos[0]?.dataIndex ?? 0];
          if (!item) return "";
          return (
            `<b>${curva.itens.indexOf(item) + 1}º · ${escapar(item.rotulo)}</b><br/>` +
            `${moedaDe(item.valor)} · ${item.participacao.toFixed(1).replace(".", ",")}% do total<br/>` +
            `<span style="opacity:.75">acumulado ${item.acumulado.toFixed(1).replace(".", ",")}% · classe ${item.banda}</span>`
          );
        },
      },
      grid: { left: 8, right: 12, top: 16, bottom: 8 },
      xAxis: {
        type: "category",
        data: curva.itens.map((i) => i.rotulo),
        axisLabel: { show: false },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        max: 100,
        axisLabel: { formatter: (v: number) => `${v}%` },
      },
      series: [
        {
          type: "line",
          name: "Acumulado",
          data: curva.itens.map((i) => i.acumulado),
          smooth: 0.2,
          symbol: "circle",
          symbolSize: n > 40 ? 0 : 5,
          showSymbol: n <= 40,
          lineStyle: { width: 2.5, color: cores.categoricas[0] },
          itemStyle: { color: cores.categoricas[0] },
          areaStyle: { color: comAlfa(cores.categoricas[0], 0.08) },
          markArea: {
            silent: true,
            data: (["A", "B", "C"] as Banda[]).map(faixa).filter((f) => f !== null),
          },
          // Os cortes de 80% e 95%, que são de onde as faixas saem.
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: cores.fileteForte, type: "dashed" },
            label: { formatter: "{c}%", color: cores.tinta3, fontSize: 10 },
            data: [{ yAxis: 80 }, { yAxis: 95 }],
          },
        },
      ],
    };
  }, [curva, cores]);

  return (
    <CartaoGrafico
      titulo="Curva ABC de clientes"
      subtitulo={
        curva.itens.length > 0 ? (
          <>
            {descreverPeriodo(base, meses)} ·{" "}
            <b className="text-tinta">{curva.vitais}</b> de {curva.itens.length} clientes fazem 80% da
            comissão
          </>
        ) : (
          descreverPeriodo(base, meses)
        )
      }
      icone={Users}
      tom="lilas"
      vazio={curva.itens.length === 0 ? "Nenhum pedido enviado neste período." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "curva", rotulo: "Curva", icone: TrendingUp },
              { valor: "tabela", rotulo: "Tabela", icone: Table2 },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
          <SeletorMetrica atual={metrica} aoEscolher={setMetrica} />
        </>
      }
    >
      {visao === "tabela" ? (
        <TabelaDados
          rotuloColuna="Cliente"
          linhas={curva.itens.map((i) => ({
            chave: i.chave,
            rotulo: `${i.banda} · ${i.rotulo}`,
            valor: i.valor,
            href: `/clientes/${i.chave}`,
            cor: corDaBanda[i.banda],
          }))}
        />
      ) : (
        <Grafico
          opcao={opcao}
          altura={300}
          rotulo="Curva ABC de clientes"
          aoClicar={(e) => {
            const item = curva.itens[e.dataIndex];
            if (item) router.push(`/clientes/${item.chave}`);
          }}
        />
      )}
    </CartaoGrafico>
  );
}
