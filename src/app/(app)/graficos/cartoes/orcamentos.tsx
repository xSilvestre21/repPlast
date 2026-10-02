"use client";

/**
 * Orçamento que virou pedido — das propostas feitas no período, quantas
 * fecharam.
 *
 * O funil diz a taxa de uma vez; as barras por mês dizem se ela está subindo.
 * A proposta conta no mês em que foi CRIADA (`orcamentosDoIntervalo`): a
 * pergunta é sobre o esforço do mês, não sobre quando fechou.
 */

import { BarChart3, FileCheck2, Filter } from "lucide-react";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import { SeletorPeriodo, SeletorVisao, mesesDoPeriodo, type Periodo } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { conversaoNoPeriodo, mesesAte } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { porcento } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["funil", "meses"] as const;
const PERIODOS = ["3", "6", "12"] as const;

export function CartaoOrcamentos({ base }: { base: BaseDosGraficos }) {
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("orc_visao", "funil", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("orc_periodo", "6", PERIODOS);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );
  const conversao = useMemo(() => conversaoNoPeriodo(base, meses), [base, meses]);
  const taxa = conversao.criadas ? conversao.viraram / conversao.criadas : 0;

  /*
   * A ligação proposta → pedido só existe para o que foi convertido AQUI: a
   * proposta importada do sistema antigo não guarda esse vínculo. Sem este
   * aviso, "0% fecharam" sobre um número grande leria como fracasso de venda
   * em vez de lacuna do histórico.
   */
  const semHistorico = conversao.criadas > 0 && conversao.viraram === 0;

  const opcao = useMemo<OpcaoGrafico>(() => {
    if (visao === "funil") {
      return {
        tooltip: { trigger: "item", formatter: "{b}: {c}" },
        series: [
          {
            type: "funnel",
            left: "8%",
            right: "8%",
            top: 8,
            bottom: 8,
            minSize: "30%",
            sort: "none",
            gap: 4,
            label: {
              show: true,
              position: "inside",
              color: "#fff",
              fontWeight: 600,
              formatter: "{b}\n{c}",
            },
            itemStyle: { borderColor: cores.folha, borderWidth: 0, borderRadius: 6 },
            data: [
              { name: "Propostas feitas", value: conversao.criadas, itemStyle: { color: cores.tinta3 } },
              { name: "Viraram pedido", value: conversao.viraram, itemStyle: { color: cores.verde } },
            ],
          },
        ],
      };
    }

    return {
      legend: {
        top: 0,
        left: 0,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: cores.tinta2, fontSize: 12 },
      },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: 8, right: 8, top: 32, bottom: 8 },
      xAxis: { type: "category", data: meses.map((m) => base.rotulos[m]?.curto ?? m) },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        {
          name: "Propostas",
          type: "bar",
          barMaxWidth: 20,
          itemStyle: { color: cores.tinta3, opacity: 0.5, borderRadius: [4, 4, 0, 0] },
          data: conversao.porMes.criadas,
        },
        {
          name: "Viraram pedido",
          type: "bar",
          barMaxWidth: 20,
          itemStyle: { color: cores.verde, borderRadius: [4, 4, 0, 0] },
          data: conversao.porMes.viraram,
        },
      ],
    };
  }, [visao, conversao, meses, base.rotulos, cores]);

  return (
    <CartaoGrafico
      titulo="Orçamento que virou pedido"
      subtitulo={
        <>
          {descreverPeriodo(base, meses)}
          {conversao.criadas > 0 && !semHistorico && (
            <>
              {" "}
              · <b className="text-verde">{porcento(taxa)}</b> fecharam
            </>
          )}
        </>
      }
      icone={FileCheck2}
      tom="sol"
      vazio={conversao.criadas === 0 ? "Nenhuma proposta criada neste período." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "funil", rotulo: "Funil", icone: Filter },
              { valor: "meses", rotulo: "Por mês", icone: BarChart3 },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
        </>
      }
      rodape={
        semHistorico ? (
          <p className="text-mini text-tinta-3">
            Nenhuma das {conversao.criadas} propostas foi convertida aqui. Proposta importada do sistema
            antigo não guarda essa ligação — o número passa a valer para as criadas no RepPlast.
          </p>
        ) : null
      }
    >
      <Grafico opcao={opcao} altura={240} rotulo="Propostas feitas e as que viraram pedido" />
    </CartaoGrafico>
  );
}
