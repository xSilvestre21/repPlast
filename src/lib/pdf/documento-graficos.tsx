/**
 * O relatório dos gráficos, em papel.
 *
 * Diferente do PDF do pedido, este NÃO copia um documento existente: ele não
 * vai para a indústria, vai para quem já viu a tela. Então ele se veste como a
 * tela — Luz & Superfície: a fonte do aplicativo, o campo de luz atrás do
 * topo, cartões brancos sobre o papel quase branco e a placa colorida de cada
 * seção, com o mesmo ícone e o mesmo tom do cartão dela. E a regra da tela
 * vale aqui também: nada de barra cortada, e todo valor impresso ao lado dela.
 *
 * A barra é uma `View` com largura em porcentagem, não um SVG. O react-pdf tem
 * primitivas de SVG, mas para um retângulo elas só acrescentariam conta: a
 * proporção já vem pronta de `geometria.ts`, e é a mesma que a tela usa.
 */

import path from "node:path";

import {
  Circle,
  Defs,
  Document,
  Ellipse,
  Font,
  G,
  Line,
  LinearGradient,
  Page,
  Path,
  RadialGradient,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import { barrasRanqueadas, serieTemporal, type ItemBarra, type PontoSerie } from "../grafico/geometria";
import { EXPORTACAO, corExportada, type TomPlaca } from "../grafico/paleta-exportacao";
import { IconePdf, type NomeIcone } from "./icones-pdf";

/*
 * A fonte da tela, a Plus Jakarta Sans. Arquivos estáticos por peso, do
 * `@fontsource`: o react-pdf só lê TTF/WOFF, e fonte variável não funciona
 * (o PDF não tem eixo de peso) — por isso um arquivo para cada peso.
 */
const FONTES = path.join(process.cwd(), "node_modules/@fontsource/plus-jakarta-sans/files");
const FAMILIA = "Jakarta";

Font.register({
  family: FAMILIA,
  fonts: [400, 500, 600, 700, 800].map((peso) => ({
    src: path.join(FONTES, `plus-jakarta-sans-latin-${peso}-normal.woff`),
    fontWeight: peso,
  })),
});

// Sem hifenização: a regra padrão é a do inglês, e partia "Comis-são" e
// nome de cliente no meio. Palavra que não cabe desce inteira.
Font.registerHyphenationCallback((palavra) => [palavra]);

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (valor: number | string) => MOEDA.format(Number(valor));

const COMPACTA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const INTEIRA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** O eixo: "R$ 366" abaixo de mil, "R$ 12,3 mil" acima — centavo ali é ruído. */
const eixo = (valor: number) => (valor < 1000 ? INTEIRA : COMPACTA).format(valor);

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** O que a seção veste: a placa do cartão dela na tela. */
interface Aparencia {
  tom?: TomPlaca;
  icone?: NomeIcone;
}

export interface SecaoBarras extends Aparencia {
  tipo: "barras";
  titulo: string;
  periodo: string;
  itens: ItemBarra[];
  teto?: number;
  rotuloResiduo?: string;
  unidade?: "moeda" | "dias";
  mostrarTotal?: boolean;
  /** Cor da barra, quando ela significa algo (perda); senão a da série. */
  cor?: string;
}

export interface SecaoSerie extends Aparencia {
  tipo: "serie";
  titulo: string;
  periodo: string;
  pontos: PontoSerie[];
  series: { rotulo: string; cor: string; preencher?: boolean }[];
}

export interface SecaoTexto extends Aparencia {
  tipo: "texto";
  titulo: string;
  periodo: string;
  corpo: string;
}

export type Secao = SecaoBarras | SecaoSerie | SecaoTexto;

/**
 * O relatorio inteiro, independente do meio.
 *
 * O PDF e o HTML autocontido consomem esta MESMA estrutura. O desenho muda
 * com o meio; a lista de secoes e os numeros, nao — senao um relatorio ganha
 * um cartao que o outro nao tem, e ninguem percebe.
 */
export interface DadosDoRelatorio {
  escritorio: string;
  mes: string;
  janela: string;
  totais: { rotulo: string; valor: string; detalhe?: string; tom?: "verde" | "perigo" }[];
  secoes: Secao[];
}

/* A4 em pontos, e as medidas que o gráfico de linha precisa saber de antemão. */
const PAGINA = { largura: 595.28, margem: 40 };
const CARTAO = { borda: 1, recuo: 18 };
const EIXO_Y = 50;
const PLOT = {
  largura: PAGINA.largura - PAGINA.margem * 2 - (CARTAO.borda + CARTAO.recuo) * 2 - EIXO_Y,
  altura: 128,
};

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 54,
    paddingBottom: 58,
    paddingHorizontal: PAGINA.margem,
    backgroundColor: EXPORTACAO.papel,
    fontFamily: FAMILIA,
    fontSize: 9,
    color: EXPORTACAO.tinta,
  },

  aurora: { position: "absolute", top: 0, left: 0, right: 0 },

  // Cabeçalho das páginas seguintes: a marca e o mês, discretos.
  corrente: {
    position: "absolute",
    top: 22,
    left: PAGINA.margem,
    right: PAGINA.margem,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  marca: { fontSize: 13, fontWeight: 800, letterSpacing: -0.4, color: EXPORTACAO.tinta },
  marcaPequena: { fontSize: 9, fontWeight: 800, letterSpacing: -0.2, color: EXPORTACAO.tinta },

  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: -24 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: EXPORTACAO.filete,
    backgroundColor: EXPORTACAO.folha,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipPonto: { width: 5, height: 5, borderRadius: 3, backgroundColor: EXPORTACAO.verde, marginRight: 6 },
  chipTexto: { fontSize: 7.5, fontWeight: 600, color: EXPORTACAO.tinta2 },

  sobretitulo: {
    marginTop: 30,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: EXPORTACAO.tinta3,
  },
  titulo: { marginTop: 6, fontSize: 30, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.15 },
  subtitulo: { marginTop: 9, fontSize: 9.5, color: EXPORTACAO.tinta2 },
  subtituloForte: { fontWeight: 600, color: EXPORTACAO.tinta },

  // Indicadores: um cartão, quatro células separadas por um fio — como na tela.
  totais: {
    flexDirection: "row",
    marginTop: 22,
    backgroundColor: EXPORTACAO.folha,
    borderWidth: 1,
    borderColor: EXPORTACAO.filete,
    borderRadius: 12,
  },
  total: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  totalDivisa: { borderLeftWidth: 1, borderLeftColor: EXPORTACAO.filete },
  rotulo: {
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: EXPORTACAO.tinta3,
  },
  totalValor: { marginTop: 5, fontSize: 15, fontWeight: 700, letterSpacing: -0.4 },
  totalDetalhe: { marginTop: 3, fontSize: 6.5, color: EXPORTACAO.tinta3 },

  // `wrap={false}` mantém o cartão inteiro numa página só; uma barra cortada
  // pela quebra de página seria exatamente o defeito que este relatório evita.
  cartao: {
    marginTop: 12,
    backgroundColor: EXPORTACAO.folha,
    borderWidth: CARTAO.borda,
    borderColor: EXPORTACAO.filete,
    borderRadius: 14,
    padding: CARTAO.recuo,
    paddingVertical: 16,
  },
  par: { flexDirection: "row", marginTop: 12 },
  metade: { flex: 1, marginTop: 0 },

  cabeca: { flexDirection: "row", alignItems: "center" },
  placa: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  secaoTitulo: { fontSize: 10.5, fontWeight: 700, letterSpacing: -0.2 },
  secaoPeriodo: { fontSize: 7, color: EXPORTACAO.tinta3, marginTop: 1.5 },
  resumo: { marginLeft: "auto", alignItems: "flex-end" },
  resumoValor: { fontSize: 10, fontWeight: 700, letterSpacing: -0.2 },

  corpoBarras: { marginTop: 12 },
  linha: { flexDirection: "row", alignItems: "center", height: 17 },
  posicao: { width: 16, fontSize: 7, fontWeight: 600, color: EXPORTACAO.tinta3 },
  rotuloLinha: { width: 138, fontSize: 8, color: EXPORTACAO.tinta2, maxLines: 1, textOverflow: "ellipsis" },
  rotuloResiduo: { color: EXPORTACAO.tinta3 },
  trilhoCaixa: { flex: 1, marginHorizontal: 10 },
  trilho: { height: 6, backgroundColor: EXPORTACAO.folha2, borderRadius: 3 },
  barra: { height: 6, borderRadius: 3 },
  valor: { width: 78, fontSize: 8.5, fontWeight: 600, textAlign: "right" },
  parte: { width: 30, fontSize: 7, color: EXPORTACAO.tinta3, textAlign: "right" },

  rodapeSecao: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: EXPORTACAO.filete,
    marginTop: 8,
    paddingTop: 7,
  },
  rodapeTexto: { fontSize: 7, color: EXPORTACAO.tinta3 },

  legenda: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 10 },
  legendaItem: { flexDirection: "row", alignItems: "center", marginRight: 18 },
  legendaMarca: { width: 10, height: 3, borderRadius: 2, marginRight: 6 },
  legendaTexto: { fontSize: 7.5, color: EXPORTACAO.tinta2 },
  legendaValor: { fontSize: 7.5, fontWeight: 700, color: EXPORTACAO.tinta, marginLeft: 4 },

  grafico: { flexDirection: "row" },
  eixoY: { width: EIXO_Y, height: PLOT.altura, position: "relative" },
  eixoYTexto: {
    position: "absolute",
    right: 8,
    fontSize: 6.5,
    color: EXPORTACAO.tinta3,
  },
  eixoX: { marginLeft: EIXO_Y, height: 12, marginTop: 5, position: "relative" },
  eixoXTexto: { position: "absolute", width: 40, fontSize: 6.5, color: EXPORTACAO.tinta3, textAlign: "center" },

  corpo: { marginTop: 10, fontSize: 8.5, color: EXPORTACAO.tinta2, lineHeight: 1.55 },

  rodape: {
    position: "absolute",
    bottom: 24,
    left: PAGINA.margem,
    right: PAGINA.margem,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: EXPORTACAO.filete,
    paddingTop: 8,
  },
  rodapeEsquerda: { flexDirection: "row", alignItems: "center" },
});

export function DocumentoGraficos({ dados, geradoEm }: { dados: DadosDoRelatorio; geradoEm: Date }) {
  return (
    <Document title={`RepPlast — gráficos de ${dados.mes}`} author={dados.escritorio} creator="RepPlast">
      <Page size="A4" style={estilos.pagina}>
        <Aurora />

        <View
          style={estilos.corrente}
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 && (
              <>
                <Text style={estilos.marcaPequena}>RepPlast</Text>
                <Text style={estilos.rodapeTexto}>
                  Relatório de comissões · {dados.mes}
                </Text>
              </>
            )
          }
        />

        <View style={estilos.topo}>
          <Text style={estilos.marca}>RepPlast</Text>
          <View style={estilos.chip}>
            <View style={estilos.chipPonto} />
            <Text style={estilos.chipTexto}>Relatório de comissões</Text>
          </View>
        </View>

        <Text style={estilos.sobretitulo}>Fechamento do mês</Text>
        <Text style={estilos.titulo}>{dados.mes}</Text>
        <Text style={estilos.subtitulo}>
          <Text style={estilos.subtituloForte}>{dados.escritorio}</Text>
          {` · histórico de ${dados.janela} · gerado em ${QUANDO.format(geradoEm)}`}
        </Text>

        <View style={estilos.totais} wrap={false}>
          {dados.totais.map((total, i) => (
            <View key={total.rotulo} style={[estilos.total, i > 0 ? estilos.totalDivisa : {}]}>
              <Text style={estilos.rotulo}>{total.rotulo}</Text>
              <Text
                style={[
                  estilos.totalValor,
                  { color: total.tom ? EXPORTACAO[total.tom] : EXPORTACAO.tinta },
                ]}
              >
                {total.valor}
              </Text>
              {total.detalhe && <Text style={estilos.totalDetalhe}>{total.detalhe}</Text>}
            </View>
          ))}
        </View>

        {blocos(dados.secoes).map((bloco) =>
          bloco.length === 1 ? (
            <Cartao key={bloco[0].titulo} secao={bloco[0]} />
          ) : (
            // Dois textos curtos lado a lado: um cartão de página inteira para
            // uma frase deixaria mais papel em branco do que conteúdo.
            <View key={bloco[0].titulo} style={estilos.par} wrap={false}>
              <Cartao secao={bloco[0]} metade />
              <View style={{ width: 12 }} />
              <Cartao secao={bloco[1]} metade />
            </View>
          ),
        )}

        <View style={estilos.rodape} fixed>
          <View style={estilos.rodapeEsquerda}>
            <Text style={estilos.marcaPequena}>RepPlast</Text>
            <Text style={[estilos.rodapeTexto, { marginLeft: 6 }]}>
              · a mesma apuração da tela de Comissões
            </Text>
          </View>
          <Text
            style={estilos.rodapeTexto}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Agrupa textos vizinhos dois a dois; o resto fica sozinho na linha. */
function blocos(secoes: Secao[]): Secao[][] {
  const saida: Secao[][] = [];
  for (const secao of secoes) {
    const anterior = saida[saida.length - 1];
    if (secao.tipo === "texto" && anterior?.length === 1 && anterior[0].tipo === "texto") {
      anterior.push(secao);
    } else {
      saida.push([secao]);
    }
  }
  return saida;
}

/**
 * O campo de luz do topo da primeira página, o mesmo `--aurora` da tela:
 * manchas de cor que se desfazem no papel. Só na primeira página — é capa,
 * não papel de parede.
 */
function Aurora() {
  // Os centros ficam no alto da página: assim a borda de cada mancha cai fora
  // do papel ou já transparente — uma mancha inteira dentro da página deixava
  // o contorno da elipse aparecer sobre o título.
  const manchas = [
    { cx: 60, cy: 0, rx: 260, ry: 190 },
    { cx: 300, cy: -30, rx: 260, ry: 190 },
    { cx: 560, cy: 10, rx: 240, ry: 190 },
    { cx: 420, cy: -60, rx: 200, ry: 200 },
  ];

  return (
    <Svg style={estilos.aurora} width={PAGINA.largura} height={240} viewBox={`0 0 ${PAGINA.largura} 240`}>
      <Defs>
        {EXPORTACAO.aurora.map((cor, i) => (
          <RadialGradient key={cor} id={`aurora-${i}`}>
            <Stop offset="0" stopColor={cor} stopOpacity={0.8} />
            <Stop offset="0.55" stopColor={cor} stopOpacity={0.35} />
            <Stop offset="1" stopColor={cor} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {manchas.map((mancha, i) => (
        <Ellipse key={i} {...mancha} fill={`url(#aurora-${i})`} />
      ))}
    </Svg>
  );
}

function Cartao({ secao, metade = false }: { secao: Secao; metade?: boolean }) {
  const placa = EXPORTACAO.placas[secao.tom ?? "neutro"];

  return (
    <View style={[estilos.cartao, metade ? estilos.metade : {}]} wrap={false}>
      <View style={estilos.cabeca}>
        <View style={[estilos.placa, { backgroundColor: placa.fundo }]}>
          {secao.icone && <IconePdf nome={secao.icone} cor={placa.traco} tamanho={12} />}
        </View>
        <View>
          <Text style={estilos.secaoTitulo}>{secao.titulo}</Text>
          <Text style={estilos.secaoPeriodo}>{secao.periodo}</Text>
        </View>
        {secao.tipo === "barras" && <ResumoBarras secao={secao} />}
      </View>

      {secao.tipo === "barras" && <Barras secao={secao} />}
      {secao.tipo === "serie" && <Serie secao={secao} />}
      {secao.tipo === "texto" && <Text style={estilos.corpo}>{secao.corpo}</Text>}
    </View>
  );
}

function rankingDe(secao: SecaoBarras) {
  const teto = secao.teto ?? 12;
  return {
    teto,
    ranking: barrasRanqueadas(secao.itens, { teto, rotuloResiduo: secao.rotuloResiduo ?? "Outros" }),
  };
}

const formatarDe = (secao: SecaoBarras) => (valor: number) =>
  secao.unidade === "dias" ? `${valor} dias` : moeda(valor);

/** O total no canto do cartão, onde o olho procura antes de ler as linhas. */
function ResumoBarras({ secao }: { secao: SecaoBarras }) {
  if (secao.mostrarTotal === false) return null;
  const { ranking } = rankingDe(secao);

  return (
    <View style={estilos.resumo}>
      <Text style={estilos.rotulo}>Total</Text>
      <Text style={estilos.resumoValor}>{formatarDe(secao)(ranking.total)}</Text>
    </View>
  );
}

function Barras({ secao }: { secao: SecaoBarras }) {
  const { teto, ranking } = rankingDe(secao);
  const formatar = formatarDe(secao);
  const cor = secao.cor ? corExportada(secao.cor) : EXPORTACAO.serie;
  // A fatia só faz sentido onde os valores somam: dias sem comprar não somam.
  const comParte = secao.unidade !== "dias" && ranking.total > 0;

  const contagem =
    ranking.agrupados > 0
      ? `${teto} de ${ranking.itens} — o resto somado na última linha`
      : `${ranking.itens} ${ranking.itens === 1 ? "item" : "itens"}`;

  return (
    <View style={estilos.corpoBarras}>
      {ranking.linhas.map((linha, i) => (
        <View key={linha.chave} style={estilos.linha}>
          <Text style={estilos.posicao}>{linha.residuo ? "" : i + 1}</Text>
          <Text style={[estilos.rotuloLinha, linha.residuo ? estilos.rotuloResiduo : {}]}>
            {linha.rotulo}
          </Text>
          <View style={estilos.trilhoCaixa}>
            <View style={estilos.trilho}>
              <View
                style={[
                  estilos.barra,
                  {
                    // Nunca zero: mesmo o menor valor continua sendo uma marca
                    // visível, como na tela.
                    width: `${Math.max(1.5, linha.proporcao)}%`,
                    backgroundColor: linha.residuo ? EXPORTACAO.tinta3 : cor,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={estilos.valor}>{formatar(linha.valor)}</Text>
          {comParte && <Text style={estilos.parte}>{parte(linha.valor, ranking.total)}</Text>}
        </View>
      ))}

      <View style={estilos.rodapeSecao}>
        <Text style={estilos.rodapeTexto}>{contagem}</Text>
        {comParte && <Text style={estilos.rodapeTexto}>% do total na última coluna</Text>}
      </View>
    </View>
  );
}

/** "38%", e "<1%" em vez de um "0%" que leria como nada. */
function parte(valor: number, total: number): string {
  const fracao = (valor / total) * 100;
  return fracao > 0 && fracao < 1 ? "<1%" : `${Math.round(fracao)}%`;
}

function Serie({ secao }: { secao: SecaoSerie }) {
  const { series, rotulos, grade } = serieTemporal(secao.pontos);

  // A geometria vem em 0..100; aqui ela vira pontos de verdade. Esticar um
  // `viewBox` com `preserveAspectRatio="none"` deformaria o traço e os pontos.
  // A folga nas bordas é o raio do ponto: sem ela, o do primeiro mês, o do
  // topo e os zerados saíam cortados ao meio.
  const FOLGA = 4;
  const x = (v: number) => FOLGA + (v / 100) * (PLOT.largura - FOLGA * 2);
  const y = (v: number) => FOLGA + (v / 100) * (PLOT.altura - FOLGA * 2);

  return (
    <View>
      <View style={estilos.legenda}>
        {secao.series.map((serie, s) => {
          const soma = secao.pontos.reduce((total, ponto) => total + (ponto.valores[s] ?? 0), 0);
          return (
            <View key={serie.rotulo} style={estilos.legendaItem}>
              <View style={[estilos.legendaMarca, { backgroundColor: corExportada(serie.cor) }]} />
              <Text style={estilos.legendaTexto}>{serie.rotulo}</Text>
              <Text style={estilos.legendaValor}>{moeda(soma)}</Text>
            </View>
          );
        })}
        <Text style={[estilos.rodapeTexto, { marginLeft: "auto" }]}>soma da janela</Text>
      </View>

      <View style={estilos.grafico}>
        <View style={estilos.eixoY}>
          {grade.map((linha) => (
            <Text key={linha.y} style={[estilos.eixoYTexto, { top: y(linha.y) - 4 }]}>
              {eixo(linha.valor)}
            </Text>
          ))}
        </View>

        <Svg width={PLOT.largura} height={PLOT.altura}>
          <Defs>
            {secao.series.map((serie, s) => (
              <LinearGradient key={serie.rotulo} id={`area-${s}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={corExportada(serie.cor)} stopOpacity={0.22} />
                <Stop offset="1" stopColor={corExportada(serie.cor)} stopOpacity={0} />
              </LinearGradient>
            ))}
          </Defs>

          {grade.map((linha, i) => (
            <Line
              key={linha.y}
              x1={x(0)}
              x2={x(100)}
              y1={y(linha.y)}
              y2={y(linha.y)}
              stroke={i === 0 ? EXPORTACAO.filiteForte : EXPORTACAO.filete}
              strokeWidth={0.75}
              strokeDasharray={i === 0 ? undefined : "2 3"}
            />
          ))}

          {series.map((desenhada, s) => {
            const serie = secao.series[s];
            const cor = corExportada(serie?.cor ?? "");
            const pontos = desenhada.pontos.map((p) => `${x(p.x).toFixed(2)},${y(p.y).toFixed(2)}`);
            const linha = `M${pontos.join(" L")}`;
            const primeiro = desenhada.pontos[0];
            const ultimo = desenhada.pontos[desenhada.pontos.length - 1];

            return (
              <G key={serie?.rotulo ?? s}>
                {serie?.preencher && (
                  <Path
                    d={`${linha} L${x(ultimo.x)},${y(100)} L${x(primeiro.x)},${y(100)} Z`}
                    fill={`url(#area-${s})`}
                  />
                )}
                <Path
                  d={linha}
                  stroke={cor}
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  // O previsto é "presente, mas fantasma": tracejado.
                  strokeDasharray={serie?.preencher ? undefined : "4 3"}
                  fill="none"
                />
                {desenhada.pontos.map((p, i) => (
                  <Circle
                    key={i}
                    cx={x(p.x)}
                    cy={y(p.y)}
                    r={2.2}
                    fill={EXPORTACAO.folha}
                    stroke={cor}
                    strokeWidth={1.4}
                  />
                ))}
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={estilos.eixoX}>
        {rotulos.map((rotulo, i) => {
          const centro = x(rotulos.length === 1 ? 50 : (i / (rotulos.length - 1)) * 100);
          // As pontas encostam na borda em vez de vazar para fora do cartão.
          const esquerda = Math.min(Math.max(centro - 20, -6), PLOT.largura - 34);
          return (
            <Text key={rotulo} style={[estilos.eixoXTexto, { left: esquerda }]}>
              {rotulo}
            </Text>
          );
        })}
      </View>
    </View>
  );
}
