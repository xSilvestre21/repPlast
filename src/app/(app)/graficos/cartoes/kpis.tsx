"use client";

/**
 * As quatro caixas do topo, agora como "stat tiles": o número do mês, a
 * variação contra o mês anterior e uma linha fina dos últimos doze meses.
 *
 * O número é o mesmo da tela de Comissões — líquido para o administrador,
 * fatia para o preposto (`kpisDoMes`, testado contra `resumirComissao`).
 */

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Grafico } from "@/components/grafico/echarts";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { kpisDoMes, mesesAte, type Kpis } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { moedaDe, porcento } from "@/lib/grafico/formato";
import { deslocarCompetencia } from "@/lib/comissao";

type Chave = "previsto" | "recebido" | "aAcertar" | "diferenca";

const CAIXAS: { chave: Chave; rotulo: string; detalhe: (k: Kpis) => string }[] = [
  { chave: "previsto", rotulo: "Previsto", detalhe: (k) => plural(k.pedidos, "pedido") },
  { chave: "recebido", rotulo: "Recebido", detalhe: (k) => `${plural(k.acertados, "acerto")}` },
  { chave: "aAcertar", rotulo: "A acertar", detalhe: () => "ainda sem acerto" },
  { chave: "diferenca", rotulo: "Diferença", detalhe: () => "recebido − previsto dos acertados" },
];

function plural(n: number, palavra: string) {
  return `${n} ${palavra}${n === 1 ? "" : "s"}`;
}

export function FaixaKpis({ base }: { base: BaseDosGraficos }) {
  const cores = useTemaGrafico();
  const meses = useMemo(() => mesesAte(base.competencia, 12), [base.competencia]);

  const porMes = useMemo(
    () => meses.map((mes) => kpisDoMes(base.itens, mes)),
    [base.itens, meses],
  );

  const atual = porMes.at(-1)!;
  const anterior = porMes.at(-2)!;
  const nomeAnterior = base.rotulos[deslocarCompetencia(base.competencia, -1)]?.curto ?? "";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-filete border border-filete rounded-suave overflow-hidden">
      {CAIXAS.map(({ chave, rotulo, detalhe }) => {
        const valor = atual[chave];
        const antes = anterior[chave];
        const serie = porMes.map((k) => k[chave] / 100);

        // A diferença é um saldo, não um volume: o tom vem do sinal dela.
        const tomValor =
          chave === "diferenca"
            ? valor < 0
              ? "text-perigo"
              : valor > 0
                ? "text-verde"
                : "text-tinta"
            : chave === "recebido"
              ? "text-verde"
              : "text-tinta";

        const corLinha =
          chave === "recebido" ? cores.verde : chave === "diferenca" ? cores.tinta3 : cores.categoricas[0];

        return (
          // O total abre a apuração do mês em Comissões, de onde ele vem.
          <Link
            key={chave}
            href={`/comissoes?mes=${base.competencia}`}
            className="block bg-folha hover:bg-folha-2 transition-colors px-4 pt-3.5 pb-2 min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rotulo">{rotulo}</span>
              <Variacao atual={valor} anterior={antes} contra={nomeAnterior} invertida={chave === "aAcertar"} />
            </div>
            <div className={`cifra text-forte mt-1.5 numerico ${tomValor}`}>{moedaDe(valor)}</div>
            <div className="text-mini text-tinta-3 mt-1">{detalhe(atual)}</div>

            <Grafico
              altura={44}
              rotulo={`${rotulo} nos últimos 12 meses`}
              opcao={{
                animationDuration: 600,
                grid: { left: 2, right: 2, top: 6, bottom: 2 },
                xAxis: { type: "category", show: false, data: meses.map((m) => base.rotulos[m].longo) },
                yAxis: { type: "value", show: false, scale: chave === "diferenca" },
                tooltip: {
                  trigger: "axis",
                  axisPointer: { type: "line", lineStyle: { color: cores.fileteForte } },
                  valueFormatter: (v: number) => moedaDe(Math.round(v * 100)),
                  confine: true,
                },
                series: [
                  {
                    type: "line",
                    name: rotulo,
                    data: serie,
                    smooth: 0.3,
                    symbol: "circle",
                    symbolSize: 5,
                    showSymbol: false,
                    lineStyle: { width: 2, color: corLinha },
                    itemStyle: { color: corLinha },
                    areaStyle: { color: corLinha, opacity: 0.08 },
                    // O ponto do mês atual fica marcado: é o número grande acima.
                    markPoint: {
                      symbol: "circle",
                      symbolSize: 6,
                      itemStyle: { color: corLinha },
                      label: { show: false },
                      data: [{ coord: [serie.length - 1, serie.at(-1)!] }],
                    },
                  },
                ],
              }}
            />
          </Link>
        );
      })}
    </div>
  );
}

/**
 * "▲ 12% vs set/26". Verde quando melhorou — e no "a acertar" melhorar é
 * DIMINUIR, daí o `invertida`.
 */
function Variacao({
  atual,
  anterior,
  contra,
  invertida = false,
}: {
  atual: number;
  anterior: number;
  contra: string;
  invertida?: boolean;
}) {
  if (anterior === 0) return null;

  const razao = (atual - anterior) / Math.abs(anterior);
  const subiu = razao > 0.0005;
  const desceu = razao < -0.0005;
  const bom = invertida ? desceu : subiu;
  const ruim = invertida ? subiu : desceu;

  const Icone = subiu ? ArrowUpRight : desceu ? ArrowDownRight : Minus;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-mini font-semibold numerico ${
        bom ? "text-verde" : ruim ? "text-perigo" : "text-tinta-3"
      }`}
      title={`Comparado com ${contra}`}
    >
      <Icone size={12} strokeWidth={2.5} aria-hidden="true" />
      {porcento(Math.abs(razao))}
      <span className="sr-only"> em relação a {contra}</span>
    </span>
  );
}
