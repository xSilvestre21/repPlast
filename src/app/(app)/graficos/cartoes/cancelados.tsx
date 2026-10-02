"use client";

/**
 * Pedidos cancelados — o que se perdeu, pelo mês do cancelamento.
 *
 * O mês é o de quando a perda aconteceu (`canceladoEm`), não o da entrega: a
 * pergunta é "o que eu perdi neste mês" (ver `pedidosCanceladosDaCompetencia`).
 * A lista traz o motivo, quando alguém o escreveu — é ele que diz se a perda
 * era evitável.
 */

import { BarChart3, List, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import { SeletorPeriodo, SeletorVisao, mesesDoPeriodo, type Periodo } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { canceladosPorMes, mesesAte, noPeriodo } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["meses", "lista"] as const;
const PERIODOS = ["3", "6", "12"] as const;

export function CartaoCancelados({ base }: { base: BaseDosGraficos }) {
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("can_visao", "meses", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("can_periodo", "6", PERIODOS);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );
  const doPeriodo = useMemo(() => noPeriodo(base.cancelados, meses), [base.cancelados, meses]);
  const porMes = useMemo(() => canceladosPorMes(doPeriodo, meses), [doPeriodo, meses]);
  const total = doPeriodo.reduce((acc, c) => acc + c.valor, 0);

  const opcao = useMemo<OpcaoGrafico>(
    () => ({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (p: { dataIndex: number }[]) => {
          const i = p[0]?.dataIndex ?? 0;
          const n = porMes.quantidade[i];
          return `<b>${escapar(base.rotulos[meses[i]]?.longo ?? meses[i])}</b><br/>${moedaDe(porMes.valor[i])} em vendas<br/><span style="opacity:.7">${n} ${n === 1 ? "pedido" : "pedidos"}</span>`;
        },
      },
      grid: { left: 8, right: 8, top: 12, bottom: 8 },
      xAxis: { type: "category", data: meses.map((m) => base.rotulos[m]?.curto ?? m) },
      yAxis: { type: "value", axisLabel: { formatter: (v: number) => moedaCompactaDe(v) } },
      series: [
        {
          type: "bar",
          barMaxWidth: 28,
          // Perda é o vermelho de verdade: é o único cartão em que ele é o dado.
          itemStyle: { color: cores.perigo, borderRadius: [4, 4, 0, 0] },
          data: porMes.valor,
        },
      ],
    }),
    [porMes, meses, base.rotulos, cores],
  );

  return (
    <CartaoGrafico
      titulo="Pedidos cancelados"
      subtitulo={`${descreverPeriodo(base, meses)} · ${moedaDe(total)} em ${doPeriodo.length} ${
        doPeriodo.length === 1 ? "pedido" : "pedidos"
      }`}
      icone={XCircle}
      tom="pessego"
      vazio={doPeriodo.length === 0 ? "Nenhum pedido cancelado neste período." : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "meses", rotulo: "Por mês", icone: BarChart3 },
              { valor: "lista", rotulo: "Lista", icone: List },
            ]}
          />
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
        </>
      }
    >
      {visao === "lista" ? (
        <ul className="max-h-[17rem] overflow-y-auto divide-y divide-filete rounded-suave border border-filete">
          {doPeriodo.map((c) => (
            <li key={c.pedidoId}>
              <Link href={`/pedidos/${c.pedidoId}`} className="block px-3 py-2 hover:bg-folha-2 transition-colors">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-corpo truncate">
                    <span className="numerico text-tinta-3">#{c.numero}</span> {c.cliente}
                  </span>
                  <span className="numerico text-corpo font-medium text-perigo shrink-0">{moedaDe(c.valor)}</span>
                </span>
                <span className="block text-mini text-tinta-3 truncate">
                  {base.rotulos[c.competencia]?.curto} · {c.fornecedor}
                  {c.motivo ? ` · ${c.motivo}` : " · sem motivo escrito"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Grafico
          opcao={opcao}
          altura={240}
          rotulo="Valor dos pedidos cancelados por mês"
          aoClicar={(e) => {
            // O mês clicado abre a lista já no período — o pedido está lá.
            if (porMes.quantidade[e.dataIndex] > 0) setVisao("lista");
          }}
        />
      )}
    </CartaoGrafico>
  );
}
