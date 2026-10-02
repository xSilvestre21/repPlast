"use client";

/**
 * Comissão por cliente — em barras, em treemap ou em tabela.
 *
 * As três visões respondem perguntas diferentes sobre os mesmos números:
 * as barras ordenam ("quem vem primeiro"), o treemap mostra proporção ("quanto
 * do bolo é de quem") e a tabela entrega o número exato com a participação.
 *
 * A cor é UMA só, a primeira da paleta: o que varia entre clientes é tamanho,
 * e a skill de dataviz é clara — magnitude é um tom, não um arco-íris. Cliente
 * não tem cor de identidade; indústria e preposto têm.
 */

import { BarChart3, LayoutGrid, Search, Table2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
import { mesesAte, noPeriodo, porCliente, type Fatia, type Metrica } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe, porcento } from "@/lib/grafico/formato";
import { comAlfa } from "@/lib/grafico/tema-echarts";

import { descreverPeriodo } from "./periodo";

const VISOES = ["barras", "treemap", "tabela"] as const;
const PERIODOS = ["1", "3", "6", "12"] as const;
const METRICAS = ["previsto", "recebido"] as const;

/** Altura de cada barra, com o respiro. Abaixo de ~24px o nome não cabe ao lado. */
const POR_BARRA = 28;

export function CartaoClientes({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("cli_visao", "barras", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("cli_periodo", "1", PERIODOS);
  const [metrica, setMetrica] = useParametro<Metrica>("cli_medida", "previsto", METRICAS);
  const [busca, setBusca] = useState("");

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );

  const ranking = useMemo(
    () => porCliente(noPeriodo(base.itens, meses), metrica).filter((f) => f.valor > 0),
    [base.itens, meses, metrica],
  );

  const filtrado = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return termo ? ranking.filter((f) => f.rotulo.toLocaleLowerCase("pt-BR").includes(termo)) : ranking;
  }, [ranking, busca]);

  const total = ranking.reduce((acc, f) => acc + f.valor, 0);
  const abrir = (chave: string) => router.push(`/clientes/${chave}`);

  const opcao = useMemo<OpcaoGrafico>(() => {
    const tooltip = {
      trigger: "item" as const,
      formatter: (p: { data: { fatia: Fatia } }) => {
        const f = p.data.fatia;
        return `<b>${escapar(f.rotulo)}</b><br/>${moedaDe(f.valor)} · ${porcento(
          total ? f.valor / total : 0,
        )}<br/><span style="opacity:.7">${f.pedidos} ${f.pedidos === 1 ? "pedido" : "pedidos"}</span>`;
      },
    };

    if (visao === "treemap") {
      return {
        tooltip,
        series: [
          {
            type: "treemap",
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            itemStyle: { borderColor: cores.folha, borderWidth: 2, gapWidth: 2, borderRadius: 6 },
            label: {
              show: true,
              // Bloco pequeno demais fica sem nome — "G R" quebrado não é
              // rótulo. O tooltip e a tabela têm todos.
              formatter: (p: { name: string; value: number }) =>
                total && p.value / total < 0.02 ? "" : `${p.name}\n${moedaCompactaDe(p.value)}`,
              color: "#fff",
              fontSize: 11,
              lineHeight: 15,
              overflow: "truncate",
            },
            universalTransition: true,
            /*
             * Um tom só, mais opaco quanto maior: proporção sem arco-íris. O
             * `colorMappingBy` do treemap não respeita uma paleta de uma cor —
             * ele volta à paleta categórica do tema, e cliente não tem cor de
             * identidade. Daí a cor e a opacidade postas item a item.
             */
            data: filtrado.map((f) => ({
              name: f.rotulo,
              value: f.valor,
              id: f.chave,
              fatia: f,
              itemStyle: {
                color: comAlfa(
                  cores.categoricas[0],
                  0.35 + 0.65 * (f.valor / Math.max(1, filtrado[0]?.valor ?? 1)),
                ),
              },
            })),
          },
        ],
      };
    }

    const linhas = [...filtrado].reverse(); // o maior em cima

    return {
      tooltip,
      grid: { left: 4, right: 88, top: 4, bottom: 4 },
      xAxis: { type: "value", show: false },
      yAxis: {
        type: "category",
        data: linhas.map((f) => f.rotulo),
        axisLabel: { color: cores.tinta2, fontSize: 12, width: 130, overflow: "truncate" },
        axisLine: { show: false },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 14,
          // Ponta arredondada só no fim da barra; a base fica rente ao eixo.
          itemStyle: { color: cores.categoricas[0], borderRadius: [0, 4, 4, 0] },
          emphasis: { itemStyle: { opacity: 0.85 } },
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
          data: linhas.map((f) => ({ value: f.valor, id: f.chave, fatia: f })),
        },
      ],
    };
  }, [visao, filtrado, total, cores]);

  const altura = visao === "treemap" ? 380 : Math.max(160, filtrado.length * POR_BARRA);

  return (
    <CartaoGrafico
      titulo="Comissão por cliente"
      subtitulo={`${descreverPeriodo(base, meses)} · ${moedaDe(total)} em ${ranking.length} ${
        ranking.length === 1 ? "cliente" : "clientes"
      }`}
      icone={Users}
      tom="lilas"
      vazio={ranking.length === 0 ? "Nenhum pedido enviado neste período." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "barras", rotulo: "Barras", icone: BarChart3 },
              { valor: "treemap", rotulo: "Mapa", icone: LayoutGrid },
              { valor: "tabela", rotulo: "Tabela", icone: Table2 },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
          <SeletorMetrica atual={metrica} aoEscolher={setMetrica} />
          <label className="relative ml-auto">
            <span className="sr-only">Buscar cliente</span>
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              placeholder="Buscar"
              className="w-32 pl-7 pr-2.5 py-1 rounded-full text-mini bg-folha-2 border border-filete
                focus:outline-none focus:border-filete-forte"
            />
          </label>
        </>
      }
    >
      {visao === "tabela" ? (
        <TabelaDados
          rotuloColuna="Cliente"
          linhas={filtrado.map((f) => ({ ...f, href: `/clientes/${f.chave}` }))}
        />
      ) : (
        // A lista longa rola DENTRO do cartão — a página nunca rola de lado nem
        // cresce sem fim por causa de um gráfico.
        <div className={visao === "barras" ? "max-h-[26rem] overflow-y-auto pr-1" : ""}>
          <Grafico
            opcao={opcao}
            altura={altura}
            rotulo="Comissão por cliente"
            aoClicar={(e) => abrir((e.data as { id: string }).id)}
          />
        </div>
      )}
    </CartaoGrafico>
  );
}
