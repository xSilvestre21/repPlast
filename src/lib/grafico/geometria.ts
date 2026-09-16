/**
 * Geometria dos gráficos: dados entram, coordenadas saem.
 *
 * Fica separado do componente porque o mesmo gráfico é desenhado em quatro
 * lugares — na tela, no PNG, no PDF e no HTML que se manda por fora. Calcular a
 * proporção em cada um seria pedir para os quatro divergirem, que é a mesma
 * razão de `comissao-consulta.ts` existir.
 *
 * Nada aqui toca em DOM, cor ou React: é aritmética, e é testada como tal.
 */

export interface ItemBarra {
  chave: string;
  rotulo: string;
  valor: number;
  /** Texto miúdo sob o rótulo — "4 pedidos", "últimos 90 dias". */
  detalhe?: string;
  /**
   * Para onde a linha leva ao ser clicada, quando leva a algum lugar.
   *
   * Opcional porque nem toda série tem destino: a linha "Outros" junta gente
   * demais para levar a uma ficha só, e um pedido cancelado já é um pedido.
   */
  href?: string;
}

export interface LinhaBarra extends ItemBarra {
  /** 0 a 100, contra o MAIOR da série. A primeira barra sempre enche a linha. */
  proporcao: number;
  /** 0 a 100, contra o total da série. É o "quanto deste bolo". */
  participacao: number;
  /** `true` só na linha que junta o resto. */
  residuo: boolean;
}

export interface Ranking {
  linhas: LinhaBarra[];
  total: number;
  maior: number;
  /** Quantos itens foram para a linha "Outros". Zero quando todos aparecem. */
  agrupados: number;
  /** Quantos itens a série tinha antes do corte. */
  itens: number;
}

/**
 * Barras ranqueadas, do maior para o menor.
 *
 * **A proporção é contra o maior, não contra o total.** Contra o total, uma
 * carteira pulverizada em 55 clientes desenharia 55 barras de 2% — todas do
 * mesmo tamanho, nenhuma legível. Contra o maior, a primeira enche a linha e as
 * outras se posicionam em relação a ela, que é a comparação que interessa.
 * A fatia do bolo continua disponível em `participacao`, como número.
 *
 * **Valor zero ou negativo não entra.** Uma barra de comprimento zero não é uma
 * barra, e vinte delas são exatamente o ruído que este gráfico existe para
 * evitar: cliente sem comissão no mês não disputa espaço com quem teve.
 */
export function barrasRanqueadas(
  itens: ItemBarra[],
  opcoes: { teto?: number; rotuloResiduo?: string } = {},
): Ranking {
  const { teto = 12, rotuloResiduo = "Outros" } = opcoes;

  const ordenados = itens
    .filter((item) => item.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const total = ordenados.reduce((soma, item) => soma + item.valor, 0);
  const maior = ordenados[0]?.valor ?? 0;

  /*
   * Só agrupa quando sobra mais de um.
   *
   * Com 13 itens e teto 12, cortar produziria "Outros (1)" — uma linha que
   * ocupa o mesmo espaço do item que ela esconde, e ainda o esconde. Nesse caso
   * mostrar os 13 é estritamente melhor.
   */
  const agrupar = ordenados.length > teto + 1;
  const visiveis = agrupar ? ordenados.slice(0, teto) : ordenados;
  const resto = agrupar ? ordenados.slice(teto) : [];

  /*
   * Limitado a 100.
   *
   * A linha do resíduo soma a cauda inteira, e essa soma passa da maior barra
   * com frequência — 43 clientes pequenos juntos rendem mais que o primeiro.
   * Sem o teto, a barra sai de 160% do trilho: na tela o `overflow:hidden` do
   * contêiner escondia o excesso, mas no PDF ela atravessava por cima do
   * valor. O número ao lado continua dizendo quanto é de verdade.
   */
  const proporcaoDe = (valor: number) =>
    maior > 0 ? Math.min(100, (valor / maior) * 100) : 0;
  const participacaoDe = (valor: number) => (total > 0 ? (valor / total) * 100 : 0);

  const linhas: LinhaBarra[] = visiveis.map((item) => ({
    ...item,
    proporcao: proporcaoDe(item.valor),
    participacao: participacaoDe(item.valor),
    residuo: false,
  }));

  if (resto.length > 0) {
    const somaDoResto = resto.reduce((soma, item) => soma + item.valor, 0);

    linhas.push({
      chave: "__residuo__",
      rotulo: `${rotuloResiduo} (${resto.length})`,
      valor: somaDoResto,
      proporcao: proporcaoDe(somaDoResto),
      participacao: participacaoDe(somaDoResto),
      residuo: true,
    });
  }

  return { linhas, total, maior, agrupados: resto.length, itens: ordenados.length };
}

/* -------------------------------------------------------------------------- */
/* Série temporal                                                             */
/* -------------------------------------------------------------------------- */

export interface PontoSerie {
  /** Curto, para o eixo: "set/26". */
  rotulo: string;
  /** Por extenso, para o balão: "Setembro de 2026". Cai no `rotulo` sem ele. */
  titulo?: string;
  /** Para onde o ponto leva ao ser clicado. */
  href?: string;
  /** Um valor por série desenhada, sempre na mesma ordem. */
  valores: number[];
}

export interface Serie {
  /** Caminho da linha, em coordenadas 0..100. */
  linha: string;
  /** O mesmo caminho fechado até a base, para o preenchimento. */
  area: string;
  pontos: { x: number; y: number; valor: number }[];
}

export interface Temporal {
  series: Serie[];
  rotulos: string[];
  maximo: number;
  /** Linhas de grade horizontais, com o valor que cada uma representa. */
  grade: { y: number; valor: number }[];
}

/**
 * Séries mensais num espaço normalizado de 0 a 100, nos dois eixos.
 *
 * O SVG que consome isto desenha com `preserveAspectRatio="none"` e
 * `vector-effect="non-scaling-stroke"`: a caixa estica para a largura que
 * tiver, e a espessura do traço não estica junto. É o que permite um gráfico
 * responsivo de verdade sem medir nada no navegador — e sem `ResizeObserver`,
 * que obrigaria o gráfico inteiro a virar componente de cliente.
 *
 * O `y` já sai invertido (0 é o topo), porque é assim que o SVG conta.
 */
export function serieTemporal(
  pontos: PontoSerie[],
  opcoes: { linhasDeGrade?: number } = {},
): Temporal {
  const { linhasDeGrade = 4 } = opcoes;

  const quantasSeries = pontos[0]?.valores.length ?? 0;
  const todos = pontos.flatMap((ponto) => ponto.valores);

  /*
   * O teto nunca é zero: com o mês inteiro zerado, dividir pelo máximo daria
   * NaN e o caminho sairia "MNaN,NaN" — um gráfico que some sem erro nenhum.
   */
  const maximo = Math.max(...todos, 0) || 1;

  // Um ponto só não tem linha: fica no meio, para não colar na borda esquerda.
  const xDe = (indice: number) =>
    pontos.length === 1 ? 50 : (indice / (pontos.length - 1)) * 100;
  const yDe = (valor: number) => 100 - (valor / maximo) * 100;

  const series: Serie[] = Array.from({ length: quantasSeries }, (_, s) => {
    const coordenadas = pontos.map((ponto, i) => ({
      x: xDe(i),
      y: yDe(ponto.valores[s]),
      valor: ponto.valores[s],
    }));

    const linha = coordenadas
      .map((p, i) => `${i === 0 ? "M" : "L"}${arredondar(p.x)},${arredondar(p.y)}`)
      .join(" ");

    const primeiro = coordenadas[0];
    const ultimo = coordenadas[coordenadas.length - 1];
    const area = `${linha} L${arredondar(ultimo.x)},100 L${arredondar(primeiro.x)},100 Z`;

    return { linha, area, pontos: coordenadas };
  });

  const grade = Array.from({ length: linhasDeGrade + 1 }, (_, i) => {
    const fracao = i / linhasDeGrade;
    return { y: 100 - fracao * 100, valor: maximo * fracao };
  });

  return { series, rotulos: pontos.map((p) => p.rotulo), maximo, grade };
}

/** Três casas bastam num espaço de 0 a 100, e encurtam o caminho no HTML. */
function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/* -------------------------------------------------------------------------- */
/* Curva ABC                                                                  */
/* -------------------------------------------------------------------------- */

export type Banda = "A" | "B" | "C";

export interface ItemAbc extends ItemBarra {
  participacao: number;
  /** Soma das participações até aqui, 0 a 100. */
  acumulado: number;
  banda: Banda;
  /**
   * Onde este item cai na curva, 0 a 100.
   *
   * Era calculado dentro do laço que monta o caminho e descartado ali mesmo.
   * Exposto para o cursor conseguir dizer QUAL cliente está sob o ponteiro —
   * sem ele, a curva é uma linha que não se liga a ninguém.
   */
  x: number;
}

export interface CurvaAbc {
  itens: ItemAbc[];
  total: number;
  /** Caminho do acumulado em coordenadas 0..100, para desenhar a curva. */
  curva: string;
  /** Quantos itens em cada banda. */
  contagem: Record<Banda, number>;
  /** Quantos itens fazem os primeiros 80%. É a manchete do gráfico. */
  vitais: number;
}

/**
 * Curva ABC: onde a carteira se concentra.
 *
 * Com 55 clientes, uma lista ordenada não responde "quantos eu não posso
 * perder". A curva responde — e é a leitura que sobra quando trinta barras
 * parecidas não dizem nada.
 *
 * As bandas são os cortes de sempre: A até 80% do acumulado, B até 95%, C o
 * resto. O item que CRUZA o corte fica na banda de baixo, e não na de cima:
 * ele é quem completa os 80%, então pertence ao grupo que os faz.
 */
export function curvaAbc(itens: ItemBarra[]): CurvaAbc {
  const ordenados = itens
    .filter((item) => item.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const total = ordenados.reduce((soma, item) => soma + item.valor, 0);

  let acumulado = 0;
  const comBanda: ItemAbc[] = ordenados.map((item, i) => {
    const participacao = total > 0 ? (item.valor / total) * 100 : 0;
    const anterior = acumulado;
    acumulado += participacao;

    // O corte olha o acumulado ANTERIOR: quem começa abaixo de 80% ainda é A,
    // porque é ele que fecha os 80%.
    const banda: Banda = anterior < 80 ? "A" : anterior < 95 ? "B" : "C";

    return {
      ...item,
      participacao,
      acumulado,
      banda,
      x: arredondar(((i + 1) / ordenados.length) * 100),
    };
  });

  /*
   * A curva COMEÇA na origem, em "zero clientes, zero por cento".
   *
   * Sem esse ponto ela nasce já no acumulado do primeiro item, e o desenho
   * deixa de ser uma curva de concentração: com um cliente só o caminho vira um
   * ponto solto, e o preenchimento até a base o transforma num triângulo que
   * sugere subida e descida onde não há nem uma nem outra.
   */
  const curva =
    comBanda.length === 0
      ? ""
      : [
          "M0,100",
          ...comBanda.map((item) => `L${item.x},${arredondar(100 - item.acumulado)}`),
        ].join(" ");

  const contagem = { A: 0, B: 0, C: 0 } as Record<Banda, number>;
  for (const item of comBanda) contagem[item.banda] += 1;

  return { itens: comBanda, total, curva, contagem, vitais: contagem.A };
}

/* -------------------------------------------------------------------------- */
/* Composição                                                                 */
/* -------------------------------------------------------------------------- */

export interface Fatia {
  participacao: number;
  /** Comprimento do traço no círculo, já em porcentagem da circunferência. */
  traco: number;
  /** Onde o traço começa, em porcentagem da circunferência. */
  inicio: number;
}

/**
 * Fatias de uma rosca.
 *
 * Desenhadas como traço sobre um círculo (`stroke-dasharray`), e não como
 * caminho de arco: o arco exigiria seno e cosseno para cada fatia e erra feio
 * no caso de uma fatia só com 100%, quando os dois pontos do arco coincidem e
 * o traço desaparece. Com dasharray, 100% é só um traço do tamanho da volta.
 *
 * É GENÉRICA para o item carregar a própria cor. Fatia de valor zero sai da
 * lista, e com isso o índice do item deixa de valer como índice da fatia — uma
 * cor escolhida por posição escorrega para a fatia seguinte. Foi o que pintou
 * "Ainda não" de verde, a cor de "alcançado", quando a conversão deu zero.
 */
export function fatias<T extends ItemBarra>(itens: T[]): { fatias: (T & Fatia)[]; total: number } {
  const positivos = itens.filter((item) => item.valor > 0);
  const total = positivos.reduce((soma, item) => soma + item.valor, 0);

  let inicio = 0;
  const desenhadas = positivos.map((item) => {
    const participacao = total > 0 ? (item.valor / total) * 100 : 0;
    const fatia = { ...item, participacao, traco: participacao, inicio };
    inicio += participacao;
    return fatia;
  });

  return { fatias: desenhadas, total };
}
