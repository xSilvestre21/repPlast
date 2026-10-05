"use client";

/**
 * Pedidos cancelados — o que se perdeu, pelo mês do cancelamento.
 *
 * O mês é o de quando a perda aconteceu (`canceladoEm`), não o da entrega: a
 * pergunta é "o que eu perdi neste mês" (ver `pedidosCanceladosDaCompetencia`).
 * A lista traz o motivo, quando alguém o escreveu — é ele que diz se a perda
 * era evitável.
 *
 * Cada pedido é um bloco da barra do mês: clicar no bloco abre AQUELE pedido.
 * Uma barra única por mês só podia levar a uma lista, e quem clica num
 * cancelamento quer o pedido. Clicar no vão da coluna abre a lista do mês.
 */

import { BarChart3, List, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import { SeletorPeriodo, SeletorVisao, mesesDoPeriodo, type Periodo } from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { ListaItens } from "@/components/grafico/lista-itens";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { canceladosPorMes, mesesAte, noPeriodo } from "@/lib/grafico/agregar";
import type { BaseDosGraficos, CanceladoGrafico } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe } from "@/lib/grafico/formato";

import { descreverPeriodo } from "./periodo";

const VISOES = ["meses", "lista"] as const;
const PERIODOS = ["3", "6", "12"] as const;

export function CartaoCancelados({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();
  // O mês clicado no gráfico, para a lista mostrar só ele.
  const [mesDaLista, setMesDaLista] = useState<string | null>(null);

  const [visao, setVisao] = useParametro("can_visao", "meses", VISOES);
  const [periodo, setPeriodo] = useParametro<Periodo>("can_periodo", "6", PERIODOS);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );
  const doPeriodo = useMemo(() => noPeriodo(base.cancelados, meses), [base.cancelados, meses]);
  const porMes = useMemo(() => canceladosPorMes(doPeriodo, meses), [doPeriodo, meses]);
  const total = doPeriodo.reduce((acc, c) => acc + c.valor, 0);

  /*
   * Os pedidos de cada mês, do maior para o menor: o maior fica na base da
   * pilha. A camada k é o k-ésimo pedido de cada mês — uma série por camada,
   * empilhadas, e cada bloco carrega o pedido que representa.
   */
  const camadas = useMemo(() => {
    const doMes = meses.map((m) =>
      doPeriodo.filter((c) => c.competencia === m).sort((a, b) => b.valor - a.valor),
    );
    const altura = Math.max(0, ...doMes.map((l) => l.length));
    return Array.from({ length: altura }, (_, k) => doMes.map((l) => l[k] ?? null));
  }, [doPeriodo, meses]);

  const opcao = useMemo<OpcaoGrafico>(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (p: { data?: { pedido?: CanceladoGrafico } }) => {
          const c = p.data?.pedido;
          if (!c) return "";
          return (
            `<b>#${c.numero} · ${escapar(c.cliente)}</b><br/>${moedaDe(c.valor)} em vendas` +
            `<br/><span style="opacity:.7">${escapar(c.fornecedor)}` +
            `${c.motivo ? ` · ${escapar(c.motivo)}` : ""}</span>` +
            `<br/><span style="opacity:.7">clique para abrir o pedido</span>`
          );
        },
      },
      grid: { left: 8, right: 8, top: 12, bottom: 8 },
      xAxis: { type: "category", data: meses.map((m) => base.rotulos[m]?.curto ?? m) },
      yAxis: { type: "value", axisLabel: { formatter: (v: number) => moedaCompactaDe(v) } },
      series: camadas.map((camada, k) => ({
        type: "bar",
        stack: "cancelados",
        barMaxWidth: 28,
        // Perda é o vermelho de verdade: é o único cartão em que ele é o dado.
        // O fio da cor do cartão separa um pedido do outro dentro da barra.
        itemStyle: { color: cores.perigo, borderColor: cores.folha, borderWidth: 1 },
        emphasis: { itemStyle: { color: cores.perigo, opacity: 0.8 } },
        data: camada.map((c, i) =>
          c
            ? {
                value: c.valor,
                pedido: c,
                // Ponta arredondada só no bloco de cima de cada mês.
                itemStyle: camadas[k + 1]?.[i] ? undefined : { borderRadius: [4, 4, 0, 0] },
              }
            : null,
        ),
      })),
    }),
    [camadas, meses, base.rotulos, cores],
  );

  const daLista = mesDaLista ? doPeriodo.filter((c) => c.competencia === mesDaLista) : doPeriodo;

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
        <ListaItens
          filtro={mesDaLista ? base.rotulos[mesDaLista]?.longo : null}
          aoLimparFiltro={() => setMesDaLista(null)}
          vazio="Nenhum pedido cancelado neste mês."
          itens={daLista.map((c) => ({
            chave: c.pedidoId,
            href: `/pedidos/${c.pedidoId}`,
            titulo: (
              <>
                <span className="numerico text-tinta-3">#{c.numero}</span> {c.cliente}
              </>
            ),
            destaque: (
              <span className="numerico text-corpo font-medium text-perigo">{moedaDe(c.valor)}</span>
            ),
            detalhe: `${base.rotulos[c.competencia]?.curto} · ${c.fornecedor}${
              c.motivo ? ` · ${c.motivo}` : " · sem motivo escrito"
            }`,
          }))}
        />
      ) : (
        <Grafico
          opcao={opcao}
          altura={240}
          rotulo="Valor dos pedidos cancelados por mês"
          aoClicar={(e) => {
            const pedido = (e.data as { pedido?: CanceladoGrafico } | null)?.pedido;
            if (pedido) router.push(`/pedidos/${pedido.pedidoId}`);
          }}
          aoClicarCategoria={(i) => {
            // O vão da coluna: a lista daquele mês.
            if (!porMes.quantidade[i]) return;
            setMesDaLista(meses[i]);
            setVisao("lista");
          }}
        />
      )}
    </CartaoGrafico>
  );
}
