"use client";

/**
 * Mapa de calor cliente × mês — a sazonalidade e quem esfriou.
 *
 * Os maiores clientes nas linhas, os meses nas colunas, a cor pela comissão.
 * Uma linha que vai clareando para a direita é o cliente esfriando, antes de
 * ele aparecer na lista de sumidos.
 *
 * Escala sequencial de UM tom (o primeiro da paleta), do fundo ao cheio: é
 * magnitude, e a skill de dataviz é clara — magnitude não leva arco-íris.
 * Célula vazia é zero, e zero é informação: "não comprou neste mês".
 */

import { Grid3x3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { AreaRolavel } from "@/components/grafico/area-rolavel";
import { CartaoGrafico } from "@/components/grafico/cartao-grafico";
import { Grafico, type OpcaoGrafico } from "@/components/grafico/echarts";
import {
  Alternancia,
  SeletorMetrica,
  SeletorPeriodo,
  mesesDoPeriodo,
  type Periodo,
} from "@/components/grafico/seletores";
import { useParametro } from "@/components/grafico/use-parametro";
import { useTemaGrafico } from "@/components/grafico/use-tema-grafico";
import { gradeClienteMes, mesesAte, type Metrica } from "@/lib/grafico/agregar";
import type { BaseDosGraficos } from "@/lib/grafico/base";
import { escapar, moedaCompactaDe, moedaDe } from "@/lib/grafico/formato";
import { comAlfa } from "@/lib/grafico/tema-echarts";

import { descreverPeriodo } from "./periodo";

const PERIODOS = ["6", "12"] as const;
const METRICAS = ["previsto", "recebido"] as const;
const SIM_NAO = ["sim", "nao"] as const;

/** Quantos clientes cabem sem a grade virar um borrão. "Todos" abre o resto. */
const LIMITE = 15;
const ALTURA_DA_LINHA = 26;

export function CartaoMapaCalor({ base }: { base: BaseDosGraficos }) {
  const router = useRouter();
  const cores = useTemaGrafico();

  const [periodo, setPeriodo] = useParametro<Periodo>("cal_periodo", "12", PERIODOS);
  const [metrica, setMetrica] = useParametro<Metrica>("cal_medida", "previsto", METRICAS);
  const [todos, setTodos] = useParametro("cal_todos", "nao", SIM_NAO);

  const meses = useMemo(
    () => mesesAte(base.competencia, mesesDoPeriodo(periodo)),
    [base.competencia, periodo],
  );

  const grade = useMemo(
    () => gradeClienteMes(base.itens, meses, metrica, todos === "sim" ? Infinity : LIMITE),
    [base.itens, meses, metrica, todos],
  );

  const opcao = useMemo<OpcaoGrafico>(() => {
    // O de cima é o maior: o eixo de categorias do ECharts desenha de baixo
    // para cima, então a ordem é invertida aqui.
    const linhas = [...grade.linhas].reverse();
    const ultima = grade.linhas.length - 1;

    return {
      tooltip: {
        position: "top",
        formatter: (p: { data: [number, number, number] }) => {
          const [x, y, valor] = p.data;
          const cliente = linhas[y];
          return (
            `<b>${escapar(cliente.rotulo)}</b><br/>${escapar(base.rotulos[meses[x]]?.longo ?? meses[x])}<br/>` +
            (valor > 0 ? moedaDe(valor) : `<span style="opacity:.7">não comprou</span>`)
          );
        },
      },
      // O fundo reserva a régua E os números das alças dela, que ficam por
      // cima da barra: com 56px, "R$ 7,3 mil" caía em cima dos meses.
      grid: { left: 8, right: 16, top: 8, bottom: 76 },
      xAxis: {
        type: "category",
        data: meses.map((m) => base.rotulos[m]?.curto ?? m),
        splitArea: { show: false },
        axisLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: linhas.map((l) => l.rotulo),
        // O nome do cliente na lateral também abre a ficha.
        triggerEvent: true,
        axisLine: { show: false },
        axisLabel: { color: cores.tinta2, fontSize: 11, width: 120, overflow: "truncate" },
      },
      visualMap: {
        min: 0,
        max: Math.max(1, grade.maximo),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 4,
        itemHeight: 160,
        itemWidth: 10,
        // Só os números das alças, em reais — com `text` nas pontas, cada valor
        // aparecia duas vezes. Sem o formatador saíam os centavos crus
        // ("730920"): a base dos gráficos guarda dinheiro em centavos.
        formatter: (valor: number) => moedaCompactaDe(valor),
        textStyle: { color: cores.tinta3, fontSize: 10 },
        handleStyle: { borderColor: cores.fileteForte },
        // Do quase-fundo ao tom cheio: um tom só, mais escuro quanto mais comissão.
        inRange: {
          color: [comAlfa(cores.categoricas[0], 0.06), comAlfa(cores.categoricas[0], 0.45), cores.categoricas[0]],
        },
      },
      series: [
        {
          type: "heatmap",
          // `y` invertido junto com as linhas.
          data: grade.celulas.map(([x, y, valor]) => [x, ultima - y, valor]),
          itemStyle: { borderColor: cores.folha, borderWidth: 2, borderRadius: 4 },
          emphasis: { itemStyle: { borderColor: cores.tinta, borderWidth: 1 } },
          label: { show: false },
        },
      ],
    };
  }, [grade, meses, base.rotulos, cores]);

  const alturaDaGrade = Math.max(240, grade.linhas.length * ALTURA_DA_LINHA + 100);

  return (
    <CartaoGrafico
      titulo="Mapa de calor: cliente × mês"
      subtitulo={`${descreverPeriodo(base, meses)} · ${
        todos === "sim" ? "todos os clientes" : `os ${Math.min(LIMITE, grade.linhas.length)} maiores`
      } · mais escuro, mais comissão`}
      icone={Grid3x3}
      tom="lilas"
      vazio={grade.linhas.length === 0 ? "Nenhum pedido enviado neste período." : null}
      controles={
        <>
          <SeletorPeriodo opcoes={PERIODOS} atual={periodo} aoEscolher={setPeriodo} />
          <SeletorMetrica atual={metrica} aoEscolher={setMetrica} />
          <Alternancia ligada={todos === "sim"} aoMudar={(l) => setTodos(l ? "sim" : "nao")}>
            Todos os clientes
          </Alternancia>
        </>
      }
      rodape={
        <p className="text-mini text-tinta-3">
          Clique numa célula para abrir o cliente · arraste a régua da legenda para destacar uma faixa
          de valores.
        </p>
      }
    >
      {/* Com todos os clientes a grade cresce — e rola dentro do cartão. */}
      <AreaRolavel
        teto={todos === "sim" ? 576 : alturaDaGrade}
        conteudo={alturaDaGrade}
        className={todos === "sim" ? "pr-1" : ""}
      >
        <Grafico
          opcao={opcao}
          altura={alturaDaGrade}
          rotulo="Mapa de calor da comissão por cliente e mês"
          aoClicar={(e) => {
            const [, y] = e.data as [number, number, number];
            const cliente = [...grade.linhas].reverse()[y];
            if (cliente) router.push(`/clientes/${cliente.chave}`);
          }}
          aoClicarCategoria={(y) => {
            const cliente = [...grade.linhas].reverse()[y];
            if (cliente) router.push(`/clientes/${cliente.chave}`);
          }}
          eixoDaCategoria="y"
        />
      </AreaRolavel>
    </CartaoGrafico>
  );
}
