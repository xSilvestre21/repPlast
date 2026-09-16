import { barrasRanqueadas, serieTemporal, type ItemBarra, type PontoSerie } from "./geometria";

/**
 * O mesmo gráfico, desenhado em canvas para virar imagem.
 *
 * O plano original era serializar o `<svg>` da tela e rasterizar. Não serve: as
 * barras ranqueadas são HTML — `div` com largura em porcentagem —, e só a
 * série, a curva e a rosca são SVG de verdade. Metade dos gráficos não teria
 * nó para serializar.
 *
 * Então o canvas lê a MESMA geometria que a tela lê. É a razão de
 * `geometria.ts` existir separado: a imagem que a pessoa manda por mensagem
 * precisa mostrar o número que ela viu, e recalcular proporção aqui seria a
 * forma mais silenciosa de os dois discordarem.
 *
 * A imagem é maior e mais espaçada que a tela de propósito: ela vai ser vista
 * reduzida dentro de uma conversa, e o que sobrevive a essa redução é o
 * contraste e o tamanho do texto, não a densidade.
 */

/** Largura fixa: a imagem não tem viewport para se adaptar. */
const LARGURA = 1000;
const MARGEM = 44;
const ALTURA_LINHA = 42;

export interface Marca {
  titulo: string;
  periodo: string;
  /** Assinatura no rodapé — diz de onde a imagem saiu. */
  rodape: string;
}

export interface Tinta {
  fundo: string;
  texto: string;
  texto2: string;
  texto3: string;
  filete: string;
  trilho: string;
  serie: string;
  residuo: string;
  fonte: string;
  /**
   * Traduz `var(--token)` para o valor do tema atual.
   *
   * Vive na tinta, e não como função solta, porque solta dá para esquecer de
   * chamar — e foi o que aconteceu: a série saiu com as duas linhas cinzas,
   * porque `ctx.strokeStyle = "var(--verde)"` não é erro, é ignorado.
   */
  resolver: (valor: string) => string;
}

/**
 * A paleta do tema atual, já em valores que o canvas entende.
 *
 * Ler do documento, em vez de fixar um hex, é o que faz a imagem sair no mesmo
 * tema que a pessoa está vendo — e o que impede um hex de tema claro de vazar
 * para dentro do código, que o design system proíbe.
 */
export function tintaDoTema(): Tinta {
  const raiz = getComputedStyle(document.documentElement);
  const cor = (token: string) => raiz.getPropertyValue(token).trim();

  return {
    fundo: cor("--folha"),
    texto: cor("--tinta"),
    texto2: cor("--tinta-2"),
    texto3: cor("--tinta-3"),
    filete: cor("--filete-forte"),
    trilho: cor("--folha-2"),
    serie: cor("--placa-lilas-traco"),
    residuo: cor("--tinta-3"),
    fonte: getComputedStyle(document.body).fontFamily,
    resolver: (valor: string) => {
      const token = valor.match(/^var\((--[^)]+)\)$/);
      return token ? raiz.getPropertyValue(token[1]).trim() : valor;
    },
  };
}

/** Cabeçalho comum: título, período e a linha que os separa do desenho. */
function cabecalho(ctx: CanvasRenderingContext2D, marca: Marca, tinta: Tinta): number {
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = tinta.texto;
  ctx.font = `700 30px ${tinta.fonte}`;
  ctx.fillText(marca.titulo, MARGEM, MARGEM + 30);

  ctx.fillStyle = tinta.texto3;
  ctx.font = `500 17px ${tinta.fonte}`;
  ctx.fillText(marca.periodo, MARGEM, MARGEM + 58);

  return MARGEM + 88;
}

function rodape(
  ctx: CanvasRenderingContext2D,
  y: number,
  esquerda: string,
  direita: string,
  tinta: Tinta,
) {
  ctx.strokeStyle = tinta.filete;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGEM, y);
  ctx.lineTo(LARGURA - MARGEM, y);
  ctx.stroke();

  ctx.font = `500 15px ${tinta.fonte}`;
  ctx.fillStyle = tinta.texto3;
  ctx.fillText(esquerda, MARGEM, y + 26);
  ctx.textAlign = "right";
  ctx.fillText(direita, LARGURA - MARGEM, y + 26);
  ctx.textAlign = "left";
}

/** Corta o texto com reticências quando ele não cabe na coluna. */
function encurtar(ctx: CanvasRenderingContext2D, texto: string, limite: number): string {
  if (ctx.measureText(texto).width <= limite) return texto;

  let corte = texto;
  while (corte.length > 1 && ctx.measureText(`${corte}…`).width > limite) {
    corte = corte.slice(0, -1);
  }
  return `${corte}…`;
}

export function desenharBarras(
  canvas: HTMLCanvasElement,
  itens: ItemBarra[],
  opcoes: {
    marca: Marca;
    formatar: (valor: number) => string;
    tinta: Tinta;
    teto?: number;
    rotuloResiduo?: string;
    mostrarTotal?: boolean;
  },
): void {
  const { marca, formatar, tinta, teto = 12, rotuloResiduo = "Outros", mostrarTotal = true } = opcoes;
  const ranking = barrasRanqueadas(itens, { teto, rotuloResiduo });

  const altura = MARGEM + 88 + ranking.linhas.length * ALTURA_LINHA + 24 + 44 + MARGEM;
  const ctx = preparar(canvas, altura, tinta);

  let y = cabecalho(ctx, marca, tinta);

  // Larguras fixas: rótulo, trilho e valor. O valor é medido primeiro porque é
  // ele que não pode ser cortado — a barra pode encolher, o número não.
  ctx.font = `600 17px ${tinta.fonte}`;
  const larguraValor = Math.max(
    ...ranking.linhas.map((linha) => ctx.measureText(formatar(linha.valor)).width),
  );

  const xRotulo = MARGEM;
  const larguraRotulo = 250;
  const xTrilho = xRotulo + larguraRotulo + 22;
  const larguraTrilho = LARGURA - MARGEM - larguraValor - 22 - xTrilho;

  for (const linha of ranking.linhas) {
    const centro = y + ALTURA_LINHA / 2;

    ctx.font = `${linha.residuo ? "italic " : ""}500 17px ${tinta.fonte}`;
    ctx.fillStyle = linha.residuo ? tinta.texto3 : tinta.texto2;
    ctx.fillText(encurtar(ctx, linha.rotulo, larguraRotulo), xRotulo, centro + 6);

    ctx.fillStyle = tinta.trilho;
    ctx.beginPath();
    ctx.roundRect(xTrilho, centro - 7, larguraTrilho, 14, 7);
    ctx.fill();

    // Mesmo o menor valor continua sendo uma marca visível, como na tela.
    const largura = Math.max(4, (linha.proporcao / 100) * larguraTrilho);
    ctx.fillStyle = linha.residuo ? tinta.residuo : tinta.serie;
    ctx.beginPath();
    ctx.roundRect(xTrilho, centro - 7, largura, 14, 7);
    ctx.fill();

    ctx.font = `600 17px ${tinta.fonte}`;
    ctx.fillStyle = tinta.texto;
    ctx.textAlign = "right";
    ctx.fillText(formatar(linha.valor), LARGURA - MARGEM, centro + 6);
    ctx.textAlign = "left";

    y += ALTURA_LINHA;
  }

  const esquerda =
    ranking.agrupados > 0 ? `${teto} de ${ranking.itens}` : `${ranking.itens} itens`;

  rodape(
    ctx,
    y + 16,
    mostrarTotal ? `${esquerda}  ·  Total ${formatar(ranking.total)}` : esquerda,
    marca.rodape,
    tinta,
  );
}

export function desenharSerie(
  canvas: HTMLCanvasElement,
  pontos: PontoSerie[],
  opcoes: {
    marca: Marca;
    formatar: (valor: number) => string;
    tinta: Tinta;
    series: { rotulo: string; cor: string; preencher?: boolean }[];
  },
): void {
  const { marca, formatar, tinta, series } = opcoes;
  const { series: desenhadas, rotulos, maximo, grade } = serieTemporal(pontos);

  const alturaPlot = 300;
  const altura = MARGEM + 88 + 40 + alturaPlot + 34 + 44 + MARGEM;
  const ctx = preparar(canvas, altura, tinta);

  let y = cabecalho(ctx, marca, tinta);

  // Legenda: a cor sozinha não diz qual série é qual.
  let x = MARGEM;
  ctx.font = `500 16px ${tinta.fonte}`;
  for (const serie of series) {
    ctx.fillStyle = tinta.resolver(serie.cor);
    ctx.beginPath();
    ctx.arc(x + 6, y + 8, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = tinta.texto2;
    ctx.fillText(serie.rotulo, x + 20, y + 14);
    x += 20 + ctx.measureText(serie.rotulo).width + 28;
  }

  ctx.fillStyle = tinta.texto3;
  ctx.textAlign = "right";
  ctx.fillText(`Topo ${formatar(maximo)}`, LARGURA - MARGEM, y + 14);
  ctx.textAlign = "left";

  y += 40;

  const esquerdaPlot = MARGEM;
  const larguraPlot = LARGURA - MARGEM * 2;
  const paraX = (normalizado: number) => esquerdaPlot + (normalizado / 100) * larguraPlot;
  const paraY = (normalizado: number) => y + (normalizado / 100) * alturaPlot;

  ctx.strokeStyle = tinta.filete;
  ctx.lineWidth = 1;
  for (const linha of grade) {
    ctx.beginPath();
    ctx.moveTo(esquerdaPlot, paraY(linha.y));
    ctx.lineTo(esquerdaPlot + larguraPlot, paraY(linha.y));
    ctx.stroke();
  }

  desenhadas.forEach((desenhada, i) => {
    const serie = series[i];
    if (!serie) return;

    const cor = tinta.resolver(serie.cor);

    if (serie.preencher) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.moveTo(paraX(desenhada.pontos[0].x), paraY(100));
      for (const ponto of desenhada.pontos) ctx.lineTo(paraX(ponto.x), paraY(ponto.y));
      ctx.lineTo(paraX(desenhada.pontos[desenhada.pontos.length - 1].x), paraY(100));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = cor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    desenhada.pontos.forEach((ponto, indice) => {
      const px = paraX(ponto.x);
      const py = paraY(ponto.y);
      if (indice === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  y += alturaPlot + 22;

  ctx.font = `500 14px ${tinta.fonte}`;
  ctx.fillStyle = tinta.texto3;
  rotulos.forEach((rotulo, i) => {
    const px = paraX(desenhadas[0]?.pontos[i]?.x ?? 0);
    // Primeiro e último encostam na borda; os do meio ficam centrados.
    ctx.textAlign = i === 0 ? "left" : i === rotulos.length - 1 ? "right" : "center";
    ctx.fillText(rotulo, px, y);
  });
  ctx.textAlign = "left";

  rodape(ctx, y + 16, `${rotulos.length} meses`, marca.rodape, tinta);
}

/**
 * Dimensiona o canvas no dobro do tamanho e reescala o contexto.
 *
 * Sem isso a imagem sai borrada em qualquer tela moderna — e ela vai ser vista
 * justamente num celular.
 */
function preparar(
  canvas: HTMLCanvasElement,
  altura: number,
  tinta: Tinta,
): CanvasRenderingContext2D {
  const escala = 2;
  canvas.width = LARGURA * escala;
  canvas.height = altura * escala;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não desenha em canvas.");

  ctx.scale(escala, escala);

  // Fundo sólido: PNG transparente vira xadrez em alguns aplicativos de
  // mensagem, e preto em outros.
  ctx.fillStyle = tinta.fundo;
  ctx.fillRect(0, 0, LARGURA, altura);

  return ctx;
}
