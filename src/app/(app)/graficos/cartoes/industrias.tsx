"use client";

/**
 * Comissão por indústria — com os clientes de cada uma no anel de fora.
 *
 * O sunburst responde de uma vez "de qual indústria vem" e "dentro dela, de
 * quem": clicar numa indústria abre só os clientes dela, e clicar no miolo
 * volta. A rosca e as barras ficam para quem quer só a primeira pergunta.
 *
 * Indústria TEM cor de identidade, e ela segue a indústria, não a posição no
 * ranking: a ordem alfabética de todas as indústrias da base decide a cor, então
 * trocar de período não repinta ninguém (regra da skill de dataviz).
 */

import { BarChart3, CircleDot, Factory, PieChart, Table2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type EventoGrafico, type OpcaoGrafico } from "@/components/grafico/echarts";
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
import {
  industriaCliente,
  mesesAte,
  noPeriodo,
  porIndustria,
  type Metrica,
} from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe, porcento } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["sunburst", "rosca", "barras", "tabela"] as const;
const PERIODOS = ["1", "3", "6", "12"] as const;
const METRICAS = ["previsto", "recebido"] as const;

export function CartaoIndustrias({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("ind_visao", "sunburst", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("ind_periodo", "1", PERIODOS);
  const [metrica, setMetrica] = useParametro<Metrica>("ind_medida", "previsto", METRICAS);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );
  const doPeriodo = useMemo(() => noPeriodo(base.itens, meses), [base.itens, meses]);

  /*
   * A cor de cada indústria, pela ordem alfabética de TODAS as da base. Passou
   * de seis, as demais ficam no cinza do resíduo — gerar uma sétima cor faria
   * duas indústrias parecerem a mesma (o teto da paleta categórica).
   */
  const corDa = useMemo(() => {
    const nomes = [...new Map(base.itens.map((i) => [i.fornecedorId, i.fornecedor])).entries()].sort(
      (a, b) => a[1].localeCompare(b[1], "pt-BR"),
    );
    const mapa = new Map(
      nomes.map(([id], i) => [id, cores.categoricas[i] ?? cores.tinta3] as const),
    );
    return (id: string) => mapa.get(id) ?? cores.tinta3;
  }, [base.itens, cores]);

  const ranking = useMemo(
    () => porIndustria(doPeriodo, metrica).filter((f) => f.valor > 0),
    [doPeriodo, metrica],
  );
  const total = ranking.reduce((acc, f) => acc + f.valor, 0);

  const opcao = useMemo<OpcaoGrafico>(() => {
    const parte = (valor: number) => (total ? porcento(valor / total) : "—");
    const tooltip = {
      trigger: "item" as const,
      formatter: (p: { name: string; value: number; treePathInfo?: { name: string }[] }) => {
        const caminho = (p.treePathInfo ?? [])
          .map((n) => n.name)
          .filter(Boolean)
          .map(escapar)
          .join(" › ");
        return `<b>${caminho || escapar(p.name)}</b><br/>${moedaDe(p.value)} · ${parte(p.value)}`;
      },
    };

    if (visao === "sunburst") {
      const arvore = industriaCliente(doPeriodo, metrica).map((industria) => ({
        ...industria,
        itemStyle: { color: corDa(industria.id) },
        // Os clientes herdam a cor da indústria, um pouco mais claros: o anel
        // de fora é "dentro desta", não uma categoria nova.
        children: industria.children?.map((c) => ({
          ...c,
          itemStyle: { color: corDa(industria.id), opacity: 0.72 },
        })),
      }));

      return {
        tooltip,
        series: [
          {
            type: "sunburst",
            data: arvore,
            radius: ["14%", "92%"],
            sort: undefined,
            // Clicar numa indústria a põe no centro; clicar no miolo volta.
            nodeClick: "rootToNode",
            itemStyle: { borderColor: cores.folha, borderWidth: 2, borderRadius: 4 },
            emphasis: { focus: "ancestor" },
            levels: [
              {},
              {
                r0: "14%",
                r: "52%",
                label: { rotate: "tangential", color: "#fff", fontSize: 11, minAngle: 12 },
              },
              {
                r0: "53%",
                r: "92%",
                // Dentro da fatia, ao longo do raio: por fora, o nome girado
                // saía do canvas no topo e virava "ʁRAS". Fatia estreita demais
                // fica sem nome — o tooltip e a tabela o têm.
                label: {
                  position: "inside",
                  rotate: "radial",
                  color: "#fff",
                  fontSize: 10,
                  minAngle: 9,
                  width: 90,
                  overflow: "truncate",
                },
              },
            ],
            universalTransition: true,
          },
        ],
      };
    }

    if (visao === "rosca") {
      return {
        tooltip,
        legend: {
          type: "scroll",
          orient: "vertical",
          right: 0,
          top: "middle",
          icon: "roundRect",
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: cores.tinta2, fontSize: 12 },
        },
        series: [
          {
            type: "pie",
            // À esquerda e menor, para não invadir a legenda à direita.
            radius: ["44%", "70%"],
            center: ["32%", "50%"],
            avoidLabelOverlap: true,
            padAngle: 1.5,
            itemStyle: { borderRadius: 6, borderColor: cores.folha, borderWidth: 2 },
            label: {
              show: true,
              position: "center",
              formatter: () => `{v|${moedaCompactaDe(total)}}\n{r|total}`,
              rich: {
                v: { fontSize: 18, fontWeight: 600, color: cores.tinta },
                r: { fontSize: 11, color: cores.tinta3, padding: [4, 0, 0, 0] },
              },
            },
            emphasis: { scale: true, scaleSize: 6, label: { show: true } },
            universalTransition: true,
            data: ranking.map((f) => ({
              name: f.rotulo,
              value: f.valor,
              id: f.chave,
              itemStyle: { color: corDa(f.chave) },
            })),
          },
        ],
      };
    }

    const linhas = [...ranking].reverse();
    return {
      tooltip,
      grid: { left: 4, right: 88, top: 4, bottom: 4 },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        data: linhas.map((f) => f.rotulo),
        axisLabel: { color: cores.tinta2, fontSize: 12, width: 140, overflow: "truncate" },
        axisLine: { show: false },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 16,
          showBackground: true,
          backgroundStyle: { color: cores.folha2, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: "right",
            color: cores.tinta,
            fontSize: 11,
            formatter: (p: { value: number }) => moedaDe(p.value),
          },
          universalTransition: true,
          data: linhas.map((f) => ({
            name: f.rotulo,
            value: f.valor,
            id: f.chave,
            itemStyle: { color: corDa(f.chave), borderRadius: [0, 4, 4, 0] },
          })),
        },
      ],
    };
  }, [visao, doPeriodo, metrica, ranking, total, cores, corDa]);

  /*
   * No sunburst o clique numa indústria é do próprio gráfico (abre os
   * clientes dela); só a folha — o cliente — leva para fora. Nas outras
   * visões, clicar leva à ficha da indústria.
   */
  function aoClicar(evento: EventoGrafico) {
    const id = (evento.data as { id?: string } | undefined)?.id;
    if (!id) return;

    if (visao === "sunburst") {
      const [, cliente] = id.split(":");
      if (cliente) router.push(`/clientes/${cliente}`);
      return;
    }
    router.push(`/fornecedores/${id}`);
  }

  return (
    <CartaoGrafico
      titulo="Comissão por indústria"
      subtitulo={`${descreverPeriodo(base, meses)} · ${moedaDe(total)} em ${ranking.length} ${
        ranking.length === 1 ? "indústria" : "indústrias"
      }`}
      icone={Factory}
      tom="pessego"
      vazio={ranking.length === 0 ? "Nenhum pedido enviado neste período." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "sunburst", rotulo: "Anéis", icone: CircleDot },
              { valor: "rosca", rotulo: "Rosca", icone: PieChart },
              { valor: "barras", rotulo: "Barras", icone: BarChart3 },
              { valor: "tabela", rotulo: "Tabela", icone: Table2 },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
          <SeletorMetrica atual={metrica} aoEscolher={setMetrica} />
        </>
      }
      rodape={
        visao === "sunburst" ? (
          <p className="text-mini text-tinta-3">
            Clique numa indústria para ver só os clientes dela; no centro, para voltar. Clique num
            cliente para abrir a ficha.
          </p>
        ) : null
      }
    >
      {visao === "tabela" ? (
        <TabelaDados
          rotuloColuna="Indústria"
          linhas={ranking.map((f) => ({
            ...f,
            href: `/fornecedores/${f.chave}`,
            cor: corDa(f.chave),
          }))}
        />
      ) : (
        <Grafico
          opcao={opcao}
          altura={visao === "barras" ? Math.max(160, ranking.length * 34) : 380}
          rotulo="Comissão por indústria"
          aoClicar={aoClicar}
        />
      )}
    </CartaoGrafico>
  );
}
