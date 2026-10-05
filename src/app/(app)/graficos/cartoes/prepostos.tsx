"use client";

/**
 * Comissão por preposto — mês a mês, cada um na cor dele.
 *
 * A cor é a mesma da bolinha da tela de Comissões (`corDoPreposto`): o
 * preposto é reconhecido de uma tela para a outra sem ler o nome.
 *
 * Duas medidas, porque respondem perguntas diferentes:
 *   - "fatia dele": o que o escritório deve a ele — a pergunta do repasse;
 *   - "comissão gerada": o que a venda dele trouxe ao escritório — a pergunta
 *     de quem vende mais.
 */

import { BarChart3, ListOrdered, Table2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { ALTURA_DA_LINHA, opcaoRanking } from "@/components/grafico/opcao-ranking";
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
import {
  doPreposto,
  mesesAte,
  noPeriodo,
  somaPorMes,
  somarPor,
  type MedidaPreposto,
  type Metrica,
} from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { moedaCompactaDe, moedaDe, porcento } from "@/lib/grafico/formato";
import { resolverCor } from "@/lib/grafico/tema-echarts";

import { descreverPeriodo } from "./periodo";

const VISOES = ["meses", "ranking", "tabela"] as const;
const PERIODOS = ["3", "6", "12"] as const;
const METRICAS = ["previsto", "recebido"] as const;
const MEDIDAS = ["fatia", "gerada"] as const;

export function CartaoPrepostos({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("pre_visao", "meses", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("pre_periodo", "6", PERIODOS);
  const [metrica, setMetrica] = useParametro<Metrica>("pre_medida", "previsto", METRICAS);
  const [medida, setMedida] = useParametro<MedidaPreposto>("pre_conta", "fatia", MEDIDAS);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );
  const doPeriodo = useMemo(
    () => noPeriodo(base.itens, meses).filter((i) => i.prepostoId !== null),
    [base.itens, meses],
  );

  // A cor sai do cadastro (`base.prepostos`), na ordem de cadastro — nunca do
  // ranking, para ninguém trocar de cor ao trocar de período.
  const corDe = useMemo(() => {
    const mapa = new Map(base.prepostos.map((p) => [p.id, resolverCor(p.cor)]));
    return (id: string) => mapa.get(id) ?? cores.tinta3;
    // `cores` entra para a cor ser relida do CSS quando o tema troca.
  }, [base.prepostos, cores]);

  const ranking = useMemo(
    () =>
      somarPor(
        doPeriodo,
        (i) => i.prepostoId,
        (i) => base.prepostos.find((p) => p.id === i.prepostoId)?.nome ?? "Preposto",
        (i) => doPreposto(i, metrica, medida),
      ).filter((f) => f.valor > 0),
    [doPeriodo, base.prepostos, metrica, medida],
  );
  const total = ranking.reduce((acc, f) => acc + f.valor, 0);

  const opcao = useMemo<OpcaoGrafico>(() => {
    if (visao === "ranking") {
      // O ranking em lista, cada preposto na cor dele, com a fatia do total.
      return opcaoRanking({
        linhas: ranking.map((f) => ({ chave: f.chave, rotulo: f.rotulo, valor: f.valor, cor: corDe(f.chave) })),
        cores,
        valorDe: moedaDe,
        detalheDe: (l) => (total ? porcento(l.valor / total) : ""),
      });
    }

    // Mês a mês, empilhado: a altura é o total dos prepostos, cada fatia é um.
    return {
      legend: {
        // Um preposto por item: com vários, rola em vez de quebrar por cima do eixo.
        type: "scroll",
        top: 0,
        left: 0,
        right: 0,
        icon: "roundRect",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: cores.tinta2, fontSize: 12 },
      },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number) => moedaDe(v) },
      grid: { left: 8, right: 8, top: 36, bottom: 8 },
      xAxis: { type: "category", data: meses.map((m) => base.rotulos[m]?.curto ?? m) },
      yAxis: { type: "value", axisLabel: { formatter: (v: number) => moedaCompactaDe(v) } },
      series: ranking.map((f, i) => ({
        name: f.rotulo,
        type: "bar",
        stack: "prepostos",
        barMaxWidth: 34,
        emphasis: { focus: "series" },
        // Ponta arredondada só no segmento de cima da pilha.
        itemStyle: {
          color: corDe(f.chave),
          borderColor: cores.folha,
          borderWidth: 1,
          borderRadius: i === ranking.length - 1 ? [4, 4, 0, 0] : 0,
        },
        data: somaPorMes(
          doPeriodo.filter((it) => it.prepostoId === f.chave),
          meses,
          (it) => doPreposto(it, metrica, medida),
        ),
      })),
    };
  }, [visao, ranking, total, doPeriodo, meses, base.rotulos, metrica, medida, cores, corDe]);

  return (
    <CartaoGrafico
      titulo="Comissão por preposto"
      subtitulo={`${descreverPeriodo(base, meses)} · ${moedaDe(total)} ${
        medida === "fatia" ? "de fatia dos prepostos" : "gerados pelos prepostos"
      }`}
      icone={UserRound}
      tom="mar"
      vazio={ranking.length === 0 ? "Nenhum pedido deste período está creditado a um preposto." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "meses", rotulo: "Mês a mês", icone: BarChart3 },
              { valor: "ranking", rotulo: "Ranking", icone: ListOrdered },
              { valor: "tabela", rotulo: "Tabela", icone: Table2 },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
          <SeletorMetrica atual={metrica} aoEscolher={setMetrica} />
          <SeletorVisao
            nome="O que contar"
            atual={medida}
            aoEscolher={setMedida}
            opcoes={[
              { valor: "fatia", rotulo: "Fatia dele", icone: UserRound },
              { valor: "gerada", rotulo: "Comissão gerada", icone: BarChart3 },
            ]}
          />
        </>
      }
    >
      {visao === "tabela" ? (
        <TabelaDados
          rotuloColuna="Preposto"
          linhas={ranking.map((f) => ({ ...f, cor: corDe(f.chave) }))}
        />
      ) : (
        <Grafico
          opcao={opcao}
          altura={visao === "ranking" ? Math.max(140, ranking.length * ALTURA_DA_LINHA + 26) : 320}
          rotulo="Comissão por preposto"
          // O repasse de cada preposto mora na apuração do mês, em Comissões:
          // a barra do mês abre aquele mês; o ranking, o mês desta página.
          aoClicar={(e) =>
            router.push(
              `/comissoes?mes=${visao === "ranking" ? base.competencia : (meses[e.dataIndex] ?? base.competencia)}`,
            )
          }
          aoClicarCategoria={(i) =>
            router.push(`/comissoes?mes=${visao === "ranking" ? base.competencia : (meses[i] ?? base.competencia)}`)
          }
          eixoDaCategoria={visao === "ranking" ? "y" : "x"}
        />
      )}
    </CartaoGrafico>
  );
}
