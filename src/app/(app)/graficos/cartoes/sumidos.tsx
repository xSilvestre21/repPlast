"use client";

/**
 * Clientes sumidos — quem parou de comprar, e quanto pesava.
 *
 * A dispersão cruza as duas coisas que decidem para quem ligar primeiro: há
 * quanto tempo o cliente sumiu (para a direita, mais tempo) e quanto ele
 * comprava (para cima, mais). O canto de cima à direita é a urgência: cliente
 * grande que já sumiu há muito tempo. O ranking é a mesma lista em ordem.
 *
 * O corte (30, 60, 90, 180 dias) é o do Painel, e mora no cartão.
 */

import { ListOrdered, ScatterChart, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import { SeletorVisao } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { Segmentado } from "@/components/ui";
import { sumidos } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe } from "@/lib/grafico/formato";
import { comAlfa } from "@/lib/grafico/tema-echarts";

const VISOES = ["dispersao", "ranking"] as const;
const CORTES = ["30", "60", "90", "180"] as const;

export function CartaoSumidos({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [visao, setVisao] = useParametro("sum_visao", "dispersao", VISOES);
  const [corte, setCorte] = useParametro("sum_dias", "60", CORTES);

  const lista = useMemo(() => sumidos(base, Number(corte)), [base, corte]);

  const opcao = useMemo<OpcaoGrafico>(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (p: { data: [number, number, string, string] }) => {
          const [dias, valor, apelido] = p.data;
          return `<b>${escapar(apelido)}</b><br/>${dias} dias sem comprar<br/><span style="opacity:.75">última compra: ${moedaDe(valor)}</span>`;
        },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 28 },
      xAxis: {
        type: "value",
        name: "dias sem comprar",
        nameLocation: "middle",
        nameGap: 24,
        min: Number(corte),
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (v: number) => moedaCompactaDe(v) },
      },
      series: [
        {
          type: "scatter",
          // O ponto cresce com o valor: o cliente grande salta aos olhos.
          symbolSize: (d: [number, number]) =>
            8 + 16 * Math.sqrt(d[1] / Math.max(1, ...lista.map((s) => s.ultimoValor))),
          itemStyle: {
            color: comAlfa(cores.categoricas[1], 0.7),
            borderColor: cores.categoricas[1],
            borderWidth: 1,
          },
          emphasis: { scale: 1.3, itemStyle: { color: cores.categoricas[1] } },
          data: lista.map((s) => [s.dias, s.ultimoValor, s.apelido, s.id]),
        },
      ],
    }),
    [lista, corte, cores],
  );

  const maisDias = Math.max(1, ...lista.map((s) => s.dias));

  return (
    <CartaoGrafico
      titulo="Clientes sumidos"
      subtitulo={`${lista.length} ${lista.length === 1 ? "cliente" : "clientes"} sem comprar há mais de ${corte} dias`}
      icone={UserMinus}
      tom="pessego"
      vazio={lista.length === 0 ? `Ninguém passou de ${corte} dias sem comprar.` : null}
      controles={
        <>
          <SeletorVisao
            atual={visao}
            aoEscolher={setVisao}
            opcoes={[
              { valor: "dispersao", rotulo: "Dispersão", icone: ScatterChart },
              { valor: "ranking", rotulo: "Ranking", icone: ListOrdered },
            ]}
          />
          <Segmentado
            nome="Dias sem comprar"
            atual={corte}
            aoEscolher={setCorte}
            opcoes={CORTES.map((c) => ({ valor: c, rotulo: `${c} dias` }))}
          />
        </>
      }
      rodape={
        visao === "dispersao" ? (
          <p className="text-mini text-tinta-3">
            Mais à direita, mais tempo sumido; mais acima, maior a última compra. Clique num ponto para
            abrir a ficha — é lá que está o telefone.
          </p>
        ) : null
      }
    >
      {visao === "ranking" ? (
        <ul className="max-h-[22rem] overflow-y-auto divide-y divide-filete rounded-suave border border-filete">
          {lista.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => router.push(`/clientes/${s.id}`)}
                className="w-full text-left px-3 py-2 hover:bg-folha-2 transition-colors cursor-pointer"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-corpo truncate">{s.apelido}</span>
                  <span className="numerico text-corpo font-semibold text-perigo shrink-0">
                    {s.dias} <span className="text-mini font-normal text-tinta-3">dias</span>
                  </span>
                </span>
                <span className="block h-1 mt-1.5 rounded-full bg-folha-2 overflow-hidden">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(s.dias / maisDias) * 100}%`, background: "var(--grafico-2)" }}
                  />
                </span>
                <span className="block text-mini text-tinta-3 mt-1">última compra {moedaDe(s.ultimoValor)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Grafico
          opcao={opcao}
          altura={300}
          rotulo="Clientes sumidos: dias sem comprar e valor da última compra"
          aoClicar={(e) => {
            const id = (e.data as [number, number, string, string])[3];
            if (id) router.push(`/clientes/${id}`);
          }}
        />
      )}
    </CartaoGrafico>
  );
}
