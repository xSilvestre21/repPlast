"use client";

/**
 * Orçamento que virou pedido — das propostas feitas no período, quantas
 * fecharam.
 *
 * O funil diz a taxa de uma vez; as barras por mês dizem se ela está subindo.
 * A proposta conta no mês em que foi CRIADA (`orcamentosDoIntervalo`): a
 * pergunta é sobre o esforço do mês, não sobre quando fechou.
 *
 * Funil e barras são somas; a lista é onde cada proposta se abre. Clicar numa
 * etapa do funil ou numa barra leva à lista já filtrada (o mês, só as que
 * viraram), e a linha abre a proposta — ou o pedido em que ela virou.
 */

import { BarChart3, FileCheck2, Filter, List } from "lucide-react";
import { useMemo, useState } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import { ListaItens } from "@/components/grafico/lista-itens";
import { SeletorPeriodo, SeletorVisao, mesesDoPeriodo, type Periodo } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { conversaoNoPeriodo, mesesAte, noPeriodo } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { porcento } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["funil", "meses", "lista"] as const;

/** O que o clique no gráfico escolheu mostrar na lista. */
interface FiltroDaLista {
  mes: string | null;
  soViraram: boolean;
}
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
  const [filtro, setFiltro] = useState<FiltroDaLista>({ mes: null, soViraram: false });

  function abrirLista(novo: FiltroDaLista) {
    setFiltro(novo);
    setVisao("lista");
  }
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
            // O funil à esquerda e os rótulos ao lado: dentro, "Viraram pedido"
            // era mais largo que a ponta estreita do funil e vazava por ela.
            left: 4,
            right: "42%",
            top: 8,
            bottom: 8,
            minSize: "26%",
            sort: "none",
            gap: 4,
            label: {
              show: true,
              position: "right",
              formatter: (p: { name: string; value: number; dataIndex: number }) =>
                // Sem a ligação proposta → pedido (histórico importado), a taxa
                // não diz nada — o rodapé explica por quê.
                p.dataIndex === 0 || semHistorico
                  ? `{v|${p.value}}\n{n|${p.name}}`
                  : `{v|${p.value}}  {t|${porcento(taxa)}}\n{n|${p.name}}`,
              rich: {
                v: { fontSize: 18, fontWeight: 600, color: cores.tinta, lineHeight: 22 },
                t: { fontSize: 12, fontWeight: 600, color: cores.verde },
                n: { fontSize: 11, color: cores.tinta3, lineHeight: 15 },
              },
            },
            labelLine: { show: false },
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
  }, [visao, conversao, meses, base.rotulos, cores, taxa, semHistorico]);

  // A mais nova primeiro: é a que ainda dá para correr atrás.
  const daLista = noPeriodo(base.orcamentos, meses)
    .filter((o) => (!filtro.mes || o.competencia === filtro.mes) && (!filtro.soViraram || o.virou))
    .sort((a, b) => b.numero - a.numero);

  const descricaoDoFiltro =
    [filtro.mes ? base.rotulos[filtro.mes]?.longo : null, filtro.soViraram ? "as que viraram pedido" : null]
      .filter(Boolean)
      .join(" · ") || null;

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
              { valor: "lista", rotulo: "Lista", icone: List },
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
      {visao === "lista" ? (
        <ListaItens
          filtro={descricaoDoFiltro}
          aoLimparFiltro={() => setFiltro({ mes: null, soViraram: false })}
          vazio="Nenhuma proposta com este filtro."
          itens={daLista.map((o) => ({
            chave: o.id,
            // A que virou abre o pedido — é o desfecho que interessa; as
            // outras abrem a proposta, para dar seguimento.
            href: o.virou && o.pedidoId ? `/pedidos/${o.pedidoId}` : `/orcamentos/${o.id}`,
            titulo: (
              <>
                <span className="numerico text-tinta-3">#{o.numero}</span> {o.cliente}
              </>
            ),
            destaque: o.virou ? (
              <span className="text-mini font-semibold text-verde">virou pedido</span>
            ) : (
              <span className="text-mini text-tinta-3">proposta</span>
            ),
            detalhe: `criada em ${base.rotulos[o.competencia]?.curto ?? o.competencia}`,
          }))}
        />
      ) : (
        <Grafico
          opcao={opcao}
          altura={240}
          rotulo="Propostas feitas e as que viraram pedido"
          aoClicar={(e) => {
            if (visao === "funil") {
              // A etapa clicada: todas as propostas, ou só as que viraram.
              abrirLista({ mes: null, soViraram: e.dataIndex === 1 });
              return;
            }
            abrirLista({ mes: meses[e.dataIndex] ?? null, soViraram: e.seriesIndex === 1 });
          }}
          aoClicarCategoria={
            visao === "meses" ? (i) => abrirLista({ mes: meses[i] ?? null, soViraram: false }) : undefined
          }
        />
      )}
    </CartaoGrafico>
  );
}
