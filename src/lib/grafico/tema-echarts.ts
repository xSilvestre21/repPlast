/**
 * O tema do ECharts, montado a partir dos tokens do design system.
 *
 * O ECharts desenha em canvas, e canvas não entende `var(--token)` — os
 * gráficos de SVG próprio usavam `var()` direto no `fill`, o que aqui não dá.
 * Então as cores são LIDAS do CSS já resolvido (`getComputedStyle`) e o tema é
 * remontado quando a página troca de tema (`use-tema-grafico.ts`).
 *
 * Nenhuma cor nasce aqui: todas são tokens de `globals.css`. Trocar uma cor do
 * sistema troca a dos gráficos junto.
 */

export interface CoresDoGrafico {
  modo: "claro" | "escuro";
  tinta: string;
  tinta2: string;
  tinta3: string;
  filete: string;
  fileteForte: string;
  folha: string;
  folha2: string;
  verde: string;
  perigo: string;
  carimbo: string;
  /** A paleta categórica em ordem fixa (`--grafico-1` … `--grafico-6`). */
  categoricas: string[];
  fonte: string;
}

/** Valores de quando não há DOM (render no servidor): nada é desenhado mesmo. */
export const CORES_NEUTRAS: CoresDoGrafico = {
  modo: "claro",
  tinta: "#111117",
  tinta2: "#5a5a68",
  tinta3: "#8d8d9c",
  filete: "rgba(17,17,24,0.07)",
  fileteForte: "rgba(17,17,24,0.15)",
  folha: "#ffffff",
  folha2: "#f4f4f7",
  verde: "#0f9d70",
  perigo: "#e0484d",
  carimbo: "#2f6fed",
  categoricas: ["#6d54d6", "#d9652f", "#0f8ea6", "#b97f0c", "#c93a86", "#2f6fed"],
  fonte: "system-ui, sans-serif",
};

export function lerCores(): CoresDoGrafico {
  if (typeof document === "undefined") return CORES_NEUTRAS;

  const estilo = getComputedStyle(document.documentElement);
  const token = (nome: string) => estilo.getPropertyValue(`--${nome}`).trim();

  return {
    modo: estilo.colorScheme.includes("dark") ? "escuro" : "claro",
    tinta: token("tinta"),
    tinta2: token("tinta-2"),
    tinta3: token("tinta-3"),
    filete: token("filete"),
    fileteForte: token("filete-forte"),
    folha: token("folha"),
    folha2: token("folha-2"),
    verde: token("verde"),
    perigo: token("perigo"),
    carimbo: token("carimbo"),
    categoricas: [1, 2, 3, 4, 5, 6].map((i) => token(`grafico-${i}`)),
    fonte: getComputedStyle(document.body).fontFamily,
  };
}

/**
 * Resolve uma cor que pode vir como `var(--token)` — é assim que
 * `corDoPreposto` e `paleta.ts` entregam — para o valor que o canvas entende.
 */
export function resolverCor(cor: string): string {
  const token = /^var\(--([\w-]+)\)$/.exec(cor.trim());
  if (!token || typeof document === "undefined") return cor;
  return getComputedStyle(document.documentElement).getPropertyValue(`--${token[1]}`).trim();
}

/**
 * A mesma cor com transparência — "#6d54d6" a 0,4 vira "rgba(109,84,214,0.4)".
 *
 * Existe porque o treemap ignora `opacity` no item: a única forma de um tom só
 * variar de intensidade bloco a bloco é a própria cor já trazer o alfa. Cor
 * que não é hex de 6 dígitos volta como veio.
 */
export function comAlfa(cor: string, alfa: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  if (!hex) return cor;
  const n = parseInt(hex[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alfa})`;
}

/**
 * O tema: eixos e grade recessivos, texto nos tons de tinta, tooltip na
 * superfície do cartão. A skill de dataviz pede exatamente isso — a tinta é
 * para os dados; a moldura não disputa atenção com eles.
 */
export function temaEcharts(c: CoresDoGrafico) {
  const eixo = {
    axisLine: { lineStyle: { color: c.fileteForte } },
    axisTick: { show: false },
    axisLabel: { color: c.tinta3, fontSize: 11 },
    splitLine: { lineStyle: { color: c.filete } },
    nameTextStyle: { color: c.tinta3 },
  };

  return {
    color: c.categoricas,
    backgroundColor: "transparent",
    textStyle: { fontFamily: c.fonte, color: c.tinta2 },
    title: { textStyle: { color: c.tinta } },
    legend: { textStyle: { color: c.tinta2 }, inactiveColor: c.fileteForte },
    tooltip: {
      backgroundColor: c.folha,
      borderColor: c.filete,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: c.tinta, fontSize: 12 },
      extraCssText: "border-radius: 12px; box-shadow: 0 8px 24px -8px rgba(0,0,0,0.25);",
    },
    categoryAxis: eixo,
    valueAxis: { ...eixo, axisLine: { show: false } },
    timeAxis: eixo,
    dataZoom: {
      borderColor: c.filete,
      fillerColor: c.modo === "escuro" ? "rgba(255,255,255,0.06)" : "rgba(17,17,24,0.05)",
      handleStyle: { color: c.folha, borderColor: c.fileteForte },
      textStyle: { color: c.tinta3 },
      dataBackground: {
        lineStyle: { color: c.fileteForte },
        areaStyle: { color: c.filete },
      },
    },
    visualMap: { textStyle: { color: c.tinta2 } },
  };
}
