"use client";

/**
 * Pontualidade de entrega — das entregas registradas, quantas no prazo.
 *
 * As cores são de ESTADO, e só aqui elas valem como dado: verde no prazo,
 * vermelho atrasado, azul adiantado. Mês a mês em barras 100% empilhadas, para
 * comparar a proporção entre meses de volumes diferentes; ou a rosca do
 * período inteiro, com a taxa no meio.
 *
 * Clicar num pedaço (o atrasado de setembro, a fatia dos adiantados) abre a
 * lista dessas entregas, e cada linha abre o pedido.
 */

import { BarChart3, List, PieChart, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import { ListaItens } from "@/components/grafico/lista-itens";
import { SeletorPeriodo, SeletorVisao, mesesDoPeriodo, type Periodo } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { SITUACOES, mesesAte, noPeriodo, pontualidadeNoPeriodo } from "@/lib/grafico/agregar";
import type { BaseDosGraficos, SituacaoEntregaGrafico } from "@/lib/grafico/base";
import { porcento } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["meses", "rosca", "lista"] as const;

/** O que o clique no gráfico escolheu mostrar na lista. */
interface FiltroDaLista {
  mes: string | null;
  situacao: SituacaoEntregaGrafico | null;
}
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
  const [filtro, setFiltro] = useState<FiltroDaLista>({ mes: null, situacao: null });

  function abrirLista(novo: FiltroDaLista) {
    setFiltro(novo);
    setVisao("lista");
  }
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

  // A mais recente primeiro.
  const daLista = noPeriodo(base.entregas, meses)
    .filter(
      (e) => (!filtro.mes || e.competencia === filtro.mes) && (!filtro.situacao || e.situacao === filtro.situacao),
    )
    .sort((a, b) => b.competencia.localeCompare(a.competencia) || b.numero - a.numero);

  const descricaoDoFiltro =
    [
      filtro.mes ? base.rotulos[filtro.mes]?.longo : null,
      filtro.situacao ? ROTULO[filtro.situacao].toLowerCase() : null,
    ]
      .filter(Boolean)
      .join(" · ") || null;

  const TOM: Record<SituacaoEntregaGrafico, string> = {
    no_prazo: "text-verde",
    adiantado: "text-carimbo",
    atrasado: "text-perigo",
  };

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
              { valor: "lista", rotulo: "Lista", icone: List },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
        </>
      }
    >
      {visao === "lista" ? (
        <ListaItens
          filtro={descricaoDoFiltro}
          aoLimparFiltro={() => setFiltro({ mes: null, situacao: null })}
          vazio="Nenhuma entrega com este filtro."
          itens={daLista.map((e) => ({
            chave: e.pedidoId,
            href: `/pedidos/${e.pedidoId}`,
            titulo: (
              <>
                <span className="numerico text-tinta-3">#{e.numero}</span> {e.cliente}
              </>
            ),
            destaque: (
              <span className={`text-mini font-semibold ${TOM[e.situacao]}`}>{ROTULO[e.situacao]}</span>
            ),
            detalhe: `entrega prometida para ${base.rotulos[e.competencia]?.curto ?? e.competencia}`,
          }))}
        />
      ) : (
        <Grafico
          opcao={opcao}
          altura={240}
          rotulo="Entregas no prazo, adiantadas e atrasadas"
          aoClicar={(e) => {
            if (visao === "rosca") {
              abrirLista({ mes: null, situacao: SITUACOES[e.dataIndex] ?? null });
              return;
            }
            abrirLista({ mes: meses[e.dataIndex] ?? null, situacao: SITUACOES[e.seriesIndex ?? -1] ?? null });
          }}
          aoClicarCategoria={
            visao === "meses" ? (i) => abrirLista({ mes: meses[i] ?? null, situacao: null }) : undefined
          }
        />
      )}
    </CartaoGrafico>
  );
}
