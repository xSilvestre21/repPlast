/**
 * O relatório dos gráficos, em papel.
 *
 * Diferente do PDF do pedido, este NÃO copia um documento existente: ele não
 * vai para a indústria, vai para quem já viu a tela. Então a regra é a mesma
 * da tela — nada de barra cortada, e todo valor impresso ao lado dela.
 *
 * A barra é uma `View` com largura em porcentagem, não um SVG. O react-pdf tem
 * primitivas de SVG, mas para um retângulo elas só acrescentariam conta: a
 * proporção já vem pronta de `geometria.ts`, e é a mesma que a tela usa.
 */

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Path, Svg } from "@react-pdf/renderer";

import { barrasRanqueadas, serieTemporal, type ItemBarra, type PontoSerie } from "../grafico/geometria";
import { EXPORTACAO, corExportada } from "../grafico/paleta-exportacao";

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (valor: number | string) => MOEDA.format(Number(valor));

export interface SecaoBarras {
  tipo: "barras";
  titulo: string;
  periodo: string;
  itens: ItemBarra[];
  teto?: number;
  rotuloResiduo?: string;
  unidade?: "moeda" | "dias";
  mostrarTotal?: boolean;
}

export interface SecaoSerie {
  tipo: "serie";
  titulo: string;
  periodo: string;
  pontos: PontoSerie[];
  series: { rotulo: string; cor: string; preencher?: boolean }[];
}

export interface SecaoTexto {
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
  totais: { rotulo: string; valor: string; detalhe?: string }[];
  secoes: Secao[];
}

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 34,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: EXPORTACAO.tinta,
  },

  titulo: { fontSize: 19, fontFamily: "Helvetica-Bold" },
  subtitulo: { fontSize: 9, color: EXPORTACAO.tinta3, marginTop: 3 },

  faixa: { flexDirection: "row", marginTop: 16, marginBottom: 6 },
  totalCaixa: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: EXPORTACAO.filete,
    paddingLeft: 8,
    paddingVertical: 2,
  },
  totalRotulo: { fontSize: 7, color: EXPORTACAO.tinta3, textTransform: "uppercase" },
  totalValor: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  totalDetalhe: { fontSize: 7, color: EXPORTACAO.tinta3, marginTop: 2 },

  // `wrap={false}` mantém a seção inteira numa página só; uma barra cortada
  // pela quebra de página seria exatamente o defeito que este relatório evita.
  secao: { marginTop: 16 },
  secaoTitulo: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  secaoPeriodo: { fontSize: 7.5, color: EXPORTACAO.tinta3, marginTop: 2, marginBottom: 8 },

  linha: { flexDirection: "row", alignItems: "center", height: 16 },
  rotulo: { width: 150, fontSize: 8, color: EXPORTACAO.tinta2 },
  trilhoCaixa: { flex: 1, marginHorizontal: 10 },
  trilho: { height: 7, backgroundColor: EXPORTACAO.folha2, borderRadius: 4 },
  barra: { height: 7, borderRadius: 4 },
  valor: { width: 84, fontSize: 8.5, fontFamily: "Helvetica-Bold", textAlign: "right" },

  rodapeSecao: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: EXPORTACAO.filete,
    marginTop: 6,
    paddingTop: 5,
  },
  rodapeTexto: { fontSize: 7.5, color: EXPORTACAO.tinta3 },

  legenda: { flexDirection: "row", marginBottom: 6 },
  legendaItem: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  legendaPonto: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  legendaTexto: { fontSize: 8, color: EXPORTACAO.tinta2 },

  eixo: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  eixoTexto: { fontSize: 6.5, color: EXPORTACAO.tinta3 },

  corpo: { fontSize: 8.5, color: EXPORTACAO.tinta2, lineHeight: 1.5 },

  rodape: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: EXPORTACAO.filete,
    paddingTop: 6,
  },
});

export function DocumentoGraficos({ dados }: { dados: DadosDoRelatorio }) {
  return (
    <Document title={`RepPlast — gráficos de ${dados.mes}`}>
      <Page size="A4" style={estilos.pagina}>
        <View>
          <Text style={estilos.titulo}>Gráficos — {dados.mes}</Text>
          <Text style={estilos.subtitulo}>
            {dados.escritorio} · histórico de {dados.janela}
          </Text>
        </View>

        <View style={estilos.faixa}>
          {dados.totais.map((total) => (
            <View key={total.rotulo} style={estilos.totalCaixa}>
              <Text style={estilos.totalRotulo}>{total.rotulo}</Text>
              <Text style={estilos.totalValor}>{total.valor}</Text>
              {total.detalhe && <Text style={estilos.totalDetalhe}>{total.detalhe}</Text>}
            </View>
          ))}
        </View>

        {dados.secoes.map((secao) => (
          <View key={secao.titulo} style={estilos.secao} wrap={false}>
            <Text style={estilos.secaoTitulo}>{secao.titulo}</Text>
            <Text style={estilos.secaoPeriodo}>{secao.periodo}</Text>

            {secao.tipo === "barras" && <Barras secao={secao} />}
            {secao.tipo === "serie" && <Serie secao={secao} />}
            {secao.tipo === "texto" && <Text style={estilos.corpo}>{secao.corpo}</Text>}
          </View>
        ))}

        <View style={estilos.rodape} fixed>
          <Text style={estilos.rodapeTexto}>
            RepPlast · a mesma apuração da tela de Comissões
          </Text>
          <Text
            style={estilos.rodapeTexto}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function Barras({ secao }: { secao: SecaoBarras }) {
  const teto = secao.teto ?? 12;
  const ranking = barrasRanqueadas(secao.itens, {
    teto,
    rotuloResiduo: secao.rotuloResiduo ?? "Outros",
  });

  const formatar = (valor: number) =>
    secao.unidade === "dias" ? `${valor} dias` : moeda(valor);

  const esquerda =
    ranking.agrupados > 0 ? `${teto} de ${ranking.itens}` : `${ranking.itens} itens`;

  return (
    <View>
      {ranking.linhas.map((linha) => (
        <View key={linha.chave} style={estilos.linha}>
          <Text style={estilos.rotulo}>{linha.rotulo}</Text>
          <View style={estilos.trilhoCaixa}>
            <View style={estilos.trilho}>
              <View
                style={[
                  estilos.barra,
                  {
                    // Nunca zero: mesmo o menor valor continua sendo uma marca
                    // visível, como na tela.
                    width: `${Math.max(1, linha.proporcao)}%`,
                    backgroundColor: linha.residuo ? EXPORTACAO.tinta3 : EXPORTACAO.serie,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={estilos.valor}>{formatar(linha.valor)}</Text>
        </View>
      ))}

      <View style={estilos.rodapeSecao}>
        <Text style={estilos.rodapeTexto}>{esquerda}</Text>
        {secao.mostrarTotal !== false && (
          <Text style={estilos.rodapeTexto}>Total {formatar(ranking.total)}</Text>
        )}
      </View>
    </View>
  );
}

function Serie({ secao }: { secao: SecaoSerie }) {
  const { series, rotulos, maximo } = serieTemporal(secao.pontos);

  return (
    <View>
      <View style={estilos.legenda}>
        {secao.series.map((serie) => (
          <View key={serie.rotulo} style={estilos.legendaItem}>
            <View
              style={[estilos.legendaPonto, { backgroundColor: corExportada(serie.cor) }]}
            />
            <Text style={estilos.legendaTexto}>{serie.rotulo}</Text>
          </View>
        ))}
        <Text style={[estilos.legendaTexto, { marginLeft: "auto" }]}>Topo {moeda(maximo)}</Text>
      </View>

      {/*
        O `viewBox` é o mesmo espaço 0..100 da tela, então o caminho sai pronto
        da geometria. `preserveAspectRatio="none"` estica a caixa para a largura
        da página sem a conta ter que mudar.
      */}
      <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 96 }}>
        {series.map((desenhada, i) => {
          const cor = corExportada(secao.series[i]?.cor ?? "");
          return (
            <Path
              key={secao.series[i]?.rotulo ?? i}
              d={desenhada.linha}
              stroke={cor}
              strokeWidth={1.4}
              fill="none"
            />
          );
        })}
      </Svg>

      <View style={estilos.eixo}>
        {rotulos.map((rotulo) => (
          <Text key={rotulo} style={estilos.eixoTexto}>
            {rotulo}
          </Text>
        ))}
      </View>
    </View>
  );
}
