"use client";

/**
 * Comissão por indústria — em rosca, em fluxo (indústria → cliente), em
 * barras ou em tabela.
 *
 * O fluxo (diagrama de Sankey) responde de uma vez "de qual indústria vem" e
 * "para quem vai": as indústrias à esquerda, os clientes à direita, e cada
 * faixa tem a largura da comissão daquele par. Um cliente que compra de duas
 * indústrias recebe as duas faixas — o que nenhum gráfico de partes mostra.
 * Ele substituiu o anel duplo (zoom animado, anel de fora borrado, raio que
 * vazava do cartão) e o mapa de blocos (pesado, nomes cortados): é linha e
 * texto, no mesmo vocabulário visual dos outros cartões.
 *
 * Indústria TEM cor de identidade, e ela segue a indústria, não a posição no
 * ranking: a ordem alfabética de todas as indústrias da base decide a cor, então
 * trocar de período não repinta ninguém (regra da skill de dataviz).
 */

import { BarChart3, Factory, PieChart, Table2, Workflow } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { ALTURA_DA_LINHA, opcaoRanking } from "@/components/grafico/opcao-ranking";
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
  fluxoIndustriaCliente,
  industriaCliente,
  mesesAte,
  noPeriodo,
  porIndustria,
  type Metrica,
  type NoFluxo,
} from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe, porcento } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["rosca", "fluxo", "barras", "tabela"] as const;
const PERIODOS = ["1", "3", "6", "12"] as const;
const METRICAS = ["previsto", "recebido"] as const;

/** A faixa da direita que a legenda da rosca ocupa: marcador, nome e fatia. */
const LEGENDA_AO_LADO = 204;

/**
 * Quantos clientes o fluxo mostra pelo nome; o resto vai para "Outros". Dez
 * cabem na altura do cartão com o nome legível ao lado de cada um.
 */
const CLIENTES_NO_FLUXO = 10;

export function CartaoIndustrias({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("ind_visao", "rosca", VISOES);
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

    if (visao === "fluxo") {
      const { nos, ligacoes } = fluxoIndustriaCliente(
        industriaCliente(doPeriodo, metrica),
        CLIENTES_NO_FLUXO,
      );
      const porId = new Map(nos.map((n) => [n.id, n]));
      const corDoNo = (n: NoFluxo) =>
        n.lado === "industria" ? corDa(n.id.slice(2)) : n.outros ? cores.fileteForte : cores.tinta3;

      /*
       * O nome por cima das faixas: um contorno da cor do cartão em volta das
       * letras as separa do degradê que passa por baixo, sem caixa nem fundo.
       */
      /*
       * O nome é cortado aqui, com reticências, e o percentual vem sempre
       * inteiro: cortar pela largura do rótulo comia o fim — justamente o "86%".
       */
      const formatarNo = (letras: number) => (p: { name: string }) => {
        const no = porId.get(p.name);
        if (!no) return "";
        const nome = no.nome.length > letras ? `${no.nome.slice(0, letras - 1).trimEnd()}…` : no.nome;
        return `{n|${nome}}  {v|${parte(no.valor)}}`;
      };
      const rotulo = {
        color: cores.tinta,
        fontSize: 11,
        textBorderColor: cores.folha,
        textBorderWidth: 3,
        rich: {
          n: { color: cores.tinta, fontSize: 11, fontWeight: 600 },
          v: { color: cores.tinta3, fontSize: 10 },
        },
      };

      const niveis = (formatter: ReturnType<typeof formatarNo>) => [
        // Indústrias à esquerda: o nome do lado de dentro, à direita do nó.
        { depth: 0, label: { ...rotulo, formatter, position: "right", distance: 8 } },
        // Clientes à direita: o nome do lado de dentro, à esquerda do nó.
        { depth: 1, label: { ...rotulo, formatter, position: "left", distance: 8 } },
      ];

      return {
        tooltip: {
          trigger: "item",
          formatter: (p: {
            dataType?: string;
            name: string;
            value: number;
            data: { source?: string; target?: string };
          }) => {
            if (p.dataType === "edge") {
              const de = porId.get(p.data.source ?? "")?.nome ?? "";
              const para = porId.get(p.data.target ?? "")?.nome ?? "";
              return `<b>${escapar(de)} → ${escapar(para)}</b><br/>${moedaDe(p.value)} · ${parte(p.value)}`;
            }
            const no = porId.get(p.name);
            return no ? `<b>${escapar(no.nome)}</b><br/>${moedaDe(no.valor)} · ${parte(no.valor)}` : "";
          },
        },
        /*
         * No celular as duas colunas de nomes dividem 330px: ficam mais curtos.
         * O nível vai INTEIRO na regra — a lista `levels` é trocada, não
         * mesclada, e um nível só com o formatador perdia a posição e o estilo.
         */
        media: [
          {
            query: { maxWidth: 440 },
            option: { series: [{ levels: niveis(formatarNo(13)) }] },
          },
        ],
        series: [
          {
            type: "sankey",
            left: 0,
            right: 0,
            top: 8,
            bottom: 8,
            nodeWidth: 10,
            nodeGap: 12,
            nodeAlign: "justify",
            // Zero iterações: os nós ficam na ordem dada (do maior para o
            // menor), em vez de o algoritmo embaralhá-los para cruzar menos.
            layoutIterations: 0,
            draggable: false,
            emphasis: { focus: "adjacency", lineStyle: { opacity: 0.55 } },
            // Rótulo de nó vizinho que se sobreporia some (o tooltip o tem).
            labelLayout: { hideOverlap: true },
            itemStyle: { borderWidth: 0, borderRadius: 3 },
            lineStyle: { color: "gradient", curveness: 0.55, opacity: 0.28 },
            levels: niveis(formatarNo(24)),
            data: nos.map((n) => ({ name: n.id, value: n.valor, itemStyle: { color: corDoNo(n) } })),
            links: ligacoes.map((l) => ({ source: l.origem, target: l.destino, value: l.valor })),
          },
        ],
      };
    }

    if (visao === "rosca") {
      const parteDe = new Map(ranking.map((f) => [f.rotulo, parte(f.valor)]));
      // No celular a legenda vai para baixo: até seis linhas, e daí pagina.
      const legendaEmbaixo = Math.min(ranking.length, 6) * 22 + 8;
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
          itemGap: 10,
          // O nome e a fatia dele. Nome comprido é cortado aqui, com
          // reticências: o `overflow` do texto rico não vale na legenda, e o
          // nome inteiro passava por cima do percentual.
          formatter: (nome: string) =>
            `{n|${nome.length > 18 ? `${nome.slice(0, 17).trimEnd()}…` : nome}}{p|${parteDe.get(nome) ?? ""}}`,
          textStyle: {
            color: cores.tinta2,
            fontSize: 12,
            rich: {
              n: { width: 136, color: cores.tinta2, fontSize: 12 },
              p: { width: 40, align: "right", color: cores.tinta3, fontSize: 11 },
            },
          },
        },
        // Estreito (celular, tela dividida), a legenda desce para baixo da
        // rosca, um item por linha — ao lado, ela cobria metade do anel.
        media: [
          {
            query: { maxWidth: 440 },
            option: {
              // Ainda `scroll`: com mais indústrias que linhas, ela pagina em
              // vez de sair pelo pé do cartão.
              legend: {
                orient: "vertical",
                left: "center",
                right: "auto",
                top: "auto",
                bottom: 4,
                height: legendaEmbaixo,
              },
              series: [{ right: 0, bottom: legendaEmbaixo + 8 }],
            },
          },
        ],
        series: [
          {
            type: "pie",
            /*
             * A rosca mora na caixa da série, e a faixa da legenda fica de
             * fora dela (`right`). O raio é medido sobre o lado MENOR dessa
             * caixa e o centro é o meio dela — então o anel cabe sempre, com o
             * cartão alto ou baixo. Antes, centro e raio eram frações do
             * gráfico inteiro: esticado ao lado de um vizinho alto, o anel
             * crescia, vazava pela borda esquerda e encostava na legenda.
             */
            left: 0,
            right: LEGENDA_AO_LADO,
            top: 8,
            bottom: 8,
            center: ["50%", "50%"],
            radius: ["58%", "90%"],
            avoidLabelOverlap: true,
            // Com uma fatia só, o espaçamento abria um corte no anel inteiro.
            padAngle: ranking.length > 1 ? 1.5 : 0,
            itemStyle: {
              borderRadius: 6,
              borderColor: cores.folha,
              borderWidth: ranking.length > 1 ? 2 : 0,
            },
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

    // Barras: o ranking em lista, com a fatia de cada indústria ao lado do valor.
    return opcaoRanking({
      linhas: ranking.map((f) => ({ chave: f.chave, rotulo: f.rotulo, valor: f.valor, cor: corDa(f.chave) })),
      cores,
      valorDe: moedaDe,
      detalheDe: (l) => parte(l.valor),
    });
  }, [visao, doPeriodo, metrica, ranking, total, cores, corDa]);

  /*
   * No fluxo, o nó de uma indústria ("i:…") abre a ficha dela e o de um
   * cliente ("c:…") abre o cliente; a faixa entre os dois abre o cliente, que
   * é o lado mais específico. A faixa até "Outros" abre a indústria de origem,
   * onde os clientes dela estão um a um; o nó "Outros" abre a lista de
   * clientes. Nas outras visões, o clique leva à ficha da indústria.
   */
  function aoClicar(evento: EventoGrafico) {
    if (visao === "fluxo") {
      const dado = evento.data as { name?: string; source?: string; target?: string } | undefined;
      const no = evento.dataType === "edge" ? dado?.target : dado?.name;
      const origem = evento.dataType === "edge" ? dado?.source : undefined;
      if (!no) return;
      if (no === "c:outros") {
        router.push(origem ? `/fornecedores/${origem.slice(2)}` : "/clientes");
        return;
      }
      router.push(no.startsWith("i:") ? `/fornecedores/${no.slice(2)}` : `/clientes/${no.slice(2)}`);
      return;
    }

    const id = (evento.data as { id?: string } | undefined)?.id;
    if (id) router.push(`/fornecedores/${id}`);
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
              { valor: "rosca", rotulo: "Rosca", icone: PieChart },
              { valor: "fluxo", rotulo: "Fluxo", icone: Workflow },
              { valor: "barras", rotulo: "Barras", icone: BarChart3 },
              { valor: "tabela", rotulo: "Tabela", icone: Table2 },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
          <SeletorMetrica atual={metrica} aoEscolher={setMetrica} />
        </>
      }
      rodape={
        visao === "fluxo" ? (
          <p className="text-mini text-tinta-3">
            Cada faixa vai de uma indústria a um cliente, da largura da comissão entre os dois. Passe
            o mouse para destacar um caminho; clique numa indústria ou num cliente para abrir a
            ficha.
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
          altura={
            visao === "barras"
              ? Math.max(160, ranking.length * ALTURA_DA_LINHA + 26)
              : visao === "fluxo"
                ? 420
                : 380
          }
          rotulo="Comissão por indústria"
          aoClicar={aoClicar}
          // Nas barras, a linha inteira da indústria (e o nome) abre a ficha.
          aoClicarCategoria={
            visao === "barras"
              ? (i) => {
                  // O ranking está na ordem da lista: a linha i é a i-ésima.
                  const f = ranking[i];
                  if (f) router.push(`/fornecedores/${f.chave}`);
                }
              : undefined
          }
          eixoDaCategoria="y"
        />
      )}
    </CartaoGrafico>
  );
}
