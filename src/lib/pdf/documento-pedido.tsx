/**
 * O PDF do pedido, como a indústria está acostumada a receber.
 *
 * O layout NÃO é uma escolha de design: foi copiado dos pedidos reais em
 * `referencia/`. Quem recebe já sabe onde procurar cada informação, e mudar a
 * ordem das colunas ou o nome dos rótulos só geraria dúvida do outro lado.
 *
 * Cuidado ao mexer: os quatro PDFs de referência são o gabarito.
 */

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { ROTULO_COLUNA_PRECO, ROTULO_UNIDADE, type Familia, type UnidadeVenda } from "../produto-preco";
import "./hifenizacao";

export interface ItemPdf {
  codigoFornecedor: string | null;
  codigoCliente: string | null;
  descricao: string;
  quantidade: string;
  unidade: UnidadeVenda;
  precoUnitario: string;
  totalSemIpi: string;
  valorIpi: string;
  total: string;
}

export interface DadosPedidoPdf {
  numero: number;
  data: Date;
  familia: Familia | null;

  fornecedor: { nome: string };
  /** Logo da INDÚSTRIA, vindo do banco. */
  logo: Buffer | null;

  cliente: {
    razaoSocial: string;
    cnpj: string | null;
    ie: string | null;
    uf: string | null;
    endereco: string | null;
    bairro: string | null;
    cep: string | null;
    municipio: string | null;
    telefone: string | null;
    emailNfe: string | null;
  };

  prazoPagamento: string | null;
  prazoEntrega: Date | null;
  pedidoDoCliente: string | null;
  tipoFrete: string | null;
  transportadora: string | null;
  observacoes: string | null;
  vendedor: string | null;

  comIpi: boolean;
  ipiPercentual: string;
  subtotalSemIpi: string;
  valorIpi: string;
  totalGeral: string;

  itens: ItemPdf[];
}

const LINHA = "#cccccc";

/** Margem lateral da referência. A faixa útil é 841,89 - 2 x 43 = 755,89 pt. */
const MARGEM = 43;

const estilos = StyleSheet.create({
  /*
   * TODA a geometria deste documento foi MEDIDA dos pedidos que a indústria
   * emite (referência 2253, 2256 e 133), extraindo posição, corpo e fonte de
   * cada trecho do conteúdo dos arquivos. Os números abaixo não são escolha de
   * gosto: são o que a indústria imprime, e é o que faz o pedido chegar lá
   * parecendo o de sempre.
   *
   * A página é A4 DEITADA, 841,89 x 595,28 pt, com margem de 43 dos dois
   * lados — a faixa útil é de 755,89 pt.
   */
  pagina: {
    paddingTop: 18,
    paddingBottom: 40,
    paddingHorizontal: MARGEM,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111111",
  },

  topo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  /*
   * `alignItems: flex-end` e não `textAlign: right`.
   *
   * O bloco encolhe até o conteúdo mais largo — o número do pedido —, então
   * alinhar o TEXTO à direita não move nada: a linha da data já ocupa a caixa
   * inteira. Empurrando cada filho para o fim do bloco, as duas linhas passam
   * a terminar na margem, que é onde a referência as termina.
   */
  blocoNumero: { alignItems: "flex-end" },
  /*
   * A logo é desenhada a 128,9 x 70,0 pt na referência — proporção 1,84, a
   * mesma do arquivo de 1600x869 px do cadastro. Com `contain`, a caixa de
   * 150 x 70 reproduz esse tamanho: a altura limita, e 70 x 1,84 dá 128,8.
   *
   * O limite de largura existe para uma marca muito deitada não avançar sobre
   * o número do pedido, que divide esta linha com ela.
   */
  logo: { maxWidth: 150, maxHeight: 70, objectFit: "contain" },
  logoAusente: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  numeroPedido: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 1.6 },
  dataPedido: { fontSize: 9, textAlign: "right", marginTop: 4.5 },

  regua: { borderTopWidth: 0.5, borderTopColor: "#000000", marginBottom: 3.7 },

  tituloSecao: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 5.4 },

  /*
   * As linhas do bloco de cliente são EXPLÍCITAS, e não um `flexWrap`.
   *
   * Com refluxo automático, um campo vazio — o frete, que a referência nem
   * tem — some e puxa o seguinte para o lugar dele: o PEDIDO DO CLIENTE subia
   * para a terceira coluna da linha de cima. Cada linha declarada mantém o
   * campo na linha em que a indústria o imprime, tenha ou não vizinho.
   */
  linhaGrade: { flexDirection: "row" },
  /*
   * As três colunas do bloco de cliente caem em 43, 339 e 500 na referência.
   * Descontada a margem, isso é 296, 161 e 298,89 pt — e não três terços
   * iguais: a razão social precisa de espaço e a UF não.
   */
  campo1: { width: 296, marginBottom: 5.4, paddingRight: 8 },
  campo2: { width: 161, marginBottom: 5.4, paddingRight: 8 },
  campo3: { width: 298.89, marginBottom: 5.4, paddingRight: 8 },
  /** UF e IE dividem a terceira coluna: a UF ocupa 46 pt e a IE o resto. */
  linhaUfIe: { width: 298.89, marginBottom: 5.4, flexDirection: "row" },
  campoUf: { width: 46, paddingRight: 4 },
  campoIe: { width: 252.89, paddingRight: 8 },
  rotulo: { fontSize: 7.5, fontFamily: "Helvetica-Bold", marginBottom: 0.5 },
  valor: { fontSize: 9 },

  observacoes: { marginTop: 7.5, marginBottom: 9.1 },
  tituloObservacao: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 3.1 },
  linhaObservacao: { fontSize: 9, marginBottom: 0.5 },

  cabecalhoTabela: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    paddingVertical: 3.6,
  },
  colunaCabecalho: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Como no pedido real, não há fio entre os itens: só embaixo do bloco.
  /*
   * Os 4 pt de folga embaixo vêm da referência: lá as linhas têm passo de 16,
   * mas o fio que fecha o bloco não encosta na última — ele fica 4 pt abaixo
   * do que o passo pediria. Sem isso a tabela fecha apertada demais.
   */
  corpoTabela: { borderBottomWidth: 0.5, borderBottomColor: LINHA, paddingBottom: 4 },
  linhaItem: { flexDirection: "row", paddingVertical: 3.55 },
  celula: { fontSize: 8 },
  celulaNumero: { fontSize: 8, textAlign: "right" },

  /*
   * O bloco de totais começa em 533 e termina em 798,89 — a mesma borda
   * direita da tabela. O rótulo é alinhado à ESQUERDA nesse ponto, e não à
   * direita: é assim na referência.
   */
  totais: { marginTop: 6.7 },
  linhaTotal: { flexDirection: "row", marginLeft: 490, marginBottom: 3 },
  rotuloTotal: { width: 150, fontSize: 9 },
  valorTotal: { width: 115.89, textAlign: "right", fontSize: 9 },
  rotuloTotalGeral: { width: 150, fontSize: 11, fontFamily: "Helvetica-Bold" },
  valorTotalGeral: {
    width: 115.89,
    textAlign: "right",
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },

  rodape: { position: "absolute", bottom: 44.8, left: MARGEM, right: MARGEM, fontSize: 9 },
});

/**
 * Larguras das colunas, em PONTOS, somando os 755,89 da faixa útil.
 *
 * Vieram das bordas da referência. Para as colunas alinhadas à direita a borda
 * não está no x do texto — ela é o x mais a largura da string. Calculando essa
 * largura em Helvetica 8 e conferindo contra o cabeçalho e contra as duas
 * linhas de item, as bordas caem em 468,0 · 589,0 · 670,0 · 736,0 e 798,89 —
 * a última é exatamente a margem direita, o que confirma a leitura.
 */
const COLUNAS = {
  codigoFornecedor: 75,
  codigoCliente: 70,
  descricao: 236,
  quantidade: 44,
  unidade: 60,
  preco: 61,
  totalSemIpi: 81,
  ipi: 66,
  total: 62.89,
} as const;

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const dinheiro = (valor: string) => MOEDA.format(Number(valor));

const quantidade = (valor: string) =>
  Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/**
 * Campo do bloco de cliente: rótulo pequeno em negrito, valor embaixo.
 *
 * A `coluna` escolhe a largura, e não há terços iguais aqui — na referência as
 * três colunas medem 296, 161 e 298,89 pt, porque a razão social precisa de
 * espaço e a UF não.
 */
function Campo({
  rotulo,
  valor,
  coluna = 1,
}: {
  rotulo: string;
  valor: string | null | undefined;
  coluna?: 1 | 2 | 3;
}) {
  if (!valor) return null;

  const larguras = { 1: estilos.campo1, 2: estilos.campo2, 3: estilos.campo3 } as const;

  return (
    <View style={larguras[coluna]}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

export function DocumentoPedido({ pedido }: { pedido: DadosPedidoPdf }) {
  const { cliente } = pedido;

  // O rótulo da coluna de preço muda por família — MILHEIRO no saco, PREÇO/CX
  // na fita, PREÇO/KG no stretch. Vem dos pedidos reais.
  const rotuloPreco = pedido.familia ? ROTULO_COLUNA_PRECO[pedido.familia] : "PREÇO";

  const frete =
    pedido.tipoFrete && pedido.transportadora
      ? `${pedido.tipoFrete} — ${pedido.transportadora}`
      : (pedido.tipoFrete ?? pedido.transportadora);

  return (
    <Document
      title={`Pedido ${pedido.numero} — ${cliente.razaoSocial}`}
      author={pedido.vendedor ?? undefined}
    >
      <Page size="A4" orientation="landscape" style={estilos.pagina}>
        <View style={estilos.topo} fixed>
          {pedido.logo ? (
            // O Image aqui é do @react-pdf, não do HTML: não existe alt em PDF.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={estilos.logo} src={pedido.logo} />
          ) : (
            <Text style={estilos.logoAusente}>{pedido.fornecedor.nome}</Text>
          )}

          <View style={estilos.blocoNumero}>
            <Text style={estilos.numeroPedido}>PEDIDO Nº {pedido.numero}</Text>
            <Text style={estilos.dataPedido}>Data: {DATA.format(pedido.data)}</Text>
          </View>
        </View>

        <View style={estilos.regua} />

        <Text style={estilos.tituloSecao}>DADOS DO CLIENTE</Text>

        <View style={estilos.linhaGrade}>
          <Campo rotulo="RAZÃO SOCIAL" valor={cliente.razaoSocial} coluna={1} />
          <Campo rotulo="CNPJ" valor={cliente.cnpj} coluna={2} />
          {/*
            UF e IE são DOIS campos na referência, em 500 e 546 — não um "UF / IE"
            só. A UF cabe em 46 pt e a inscrição fica com o resto da coluna.
          */}
          <View style={estilos.linhaUfIe}>
            <View style={estilos.campoUf}>
              <Text style={estilos.rotulo}>UF</Text>
              <Text style={estilos.valor}>{cliente.uf ?? ""}</Text>
            </View>
            <View style={estilos.campoIe}>
              <Text style={estilos.rotulo}>IE</Text>
              <Text style={estilos.valor}>{cliente.ie ?? ""}</Text>
            </View>
          </View>

        </View>

        <View style={estilos.linhaGrade}>
          <Campo rotulo="ENDEREÇO" valor={cliente.endereco} coluna={1} />
          <Campo rotulo="BAIRRO" valor={cliente.bairro} coluna={2} />
          <Campo rotulo="CEP" valor={cliente.cep} coluna={3} />
        </View>

        <View style={estilos.linhaGrade}>
          <Campo rotulo="MUNICÍPIO" valor={cliente.municipio} coluna={1} />
          <Campo rotulo="TELEFONE" valor={cliente.telefone} coluna={2} />
          <Campo rotulo="E-MAIL PARA ENVIO DA NF-e" valor={cliente.emailNfe} coluna={3} />
        </View>

        <View style={estilos.linhaGrade}>
          <Campo rotulo="PRAZO PARA PAGAMENTO" valor={pedido.prazoPagamento} coluna={1} />
          <Campo
            rotulo="PRAZO PARA ENTREGA"
            valor={pedido.prazoEntrega ? DATA.format(pedido.prazoEntrega) : null}
            coluna={2}
          />
          {/* Frete e transportadora não constam dos pedidos de referência, e
              por isso ocupam a vaga que fica livre nesta linha: aparecendo, não
              empurram nada; ausentes, a linha fica igual à da indústria. */}
          <Campo rotulo="FRETE" valor={frete} coluna={3} />
        </View>

        <View style={estilos.linhaGrade}>
          <Campo rotulo="PEDIDO DO CLIENTE" valor={pedido.pedidoDoCliente} coluna={1} />
        </View>

        {pedido.observacoes && (
          <View style={estilos.observacoes}>
            <Text style={estilos.tituloObservacao}>OBSERVAÇÃO</Text>
            {pedido.observacoes.split("\n").map((linha, indice) => (
              <Text key={indice} style={estilos.linhaObservacao}>
                {/*
                  Linha vazia vira espaço DURO: string vazia não ocupa altura, e o
                  parágrafo em branco que separa os recados do fecho colapsava,
                  subindo meia linha tudo o que vem abaixo.
                */}
                {linha || " "}
              </Text>
            ))}
          </View>
        )}

        <View style={estilos.cabecalhoTabela}>
          <Text style={[estilos.colunaCabecalho, { width: COLUNAS.codigoFornecedor }]}>
            COD.FORN
          </Text>
          <Text style={[estilos.colunaCabecalho, { width: COLUNAS.codigoCliente }]}>COD.CLI</Text>
          <Text style={[estilos.colunaCabecalho, { width: COLUNAS.descricao }]}>DESCRIÇÃO</Text>
          <Text
            style={[
              estilos.colunaCabecalho,
              { width: COLUNAS.quantidade, textAlign: "right" },
            ]}
          >
            QNT
          </Text>
          <Text style={[estilos.colunaCabecalho, { width: COLUNAS.unidade, paddingLeft: 6 }]}>
            UN
          </Text>
          <Text
            style={[
              estilos.colunaCabecalho,
              { width: COLUNAS.preco, textAlign: "right" },
            ]}
          >
            {rotuloPreco}
          </Text>
          <Text
            style={[
              estilos.colunaCabecalho,
              { width: COLUNAS.totalSemIpi, textAlign: "right" },
            ]}
          >
            TOT S/IPI
          </Text>
          <Text
            style={[
              estilos.colunaCabecalho,
              { width: COLUNAS.ipi, textAlign: "right" },
            ]}
          >
            IPI
          </Text>
          <Text style={[estilos.colunaCabecalho, { width: COLUNAS.total, textAlign: "right" }]}>
            TOTAL
          </Text>
        </View>

        <View style={estilos.corpoTabela}>
          {pedido.itens.map((item, indice) => (
            <View key={indice} style={estilos.linhaItem} wrap={false}>
              <Text style={[estilos.celula, { width: COLUNAS.codigoFornecedor }]}>
                {item.codigoFornecedor ?? ""}
              </Text>
              <Text style={[estilos.celula, { width: COLUNAS.codigoCliente }]}>
                {item.codigoCliente ?? ""}
              </Text>
              <Text style={[estilos.celula, { width: COLUNAS.descricao }]}>{item.descricao}</Text>
              <Text style={[estilos.celulaNumero, { width: COLUNAS.quantidade }]}>
                {quantidade(item.quantidade)}
              </Text>
              <Text style={[estilos.celula, { width: COLUNAS.unidade, paddingLeft: 6 }]}>
                {ROTULO_UNIDADE[item.unidade]}
              </Text>
              <Text style={[estilos.celulaNumero, { width: COLUNAS.preco }]}>
                {dinheiro(item.precoUnitario)}
              </Text>
              <Text style={[estilos.celulaNumero, { width: COLUNAS.totalSemIpi }]}>
                {dinheiro(item.totalSemIpi)}
              </Text>
              <Text style={[estilos.celulaNumero, { width: COLUNAS.ipi }]}>
                {dinheiro(item.valorIpi)}
              </Text>
              <Text
                style={[estilos.celulaNumero, { width: COLUNAS.total }]}
              >
                {dinheiro(item.total)}
              </Text>
            </View>
          ))}
        </View>

        <View style={estilos.totais}>
          <View style={estilos.linhaTotal}>
            <Text style={estilos.rotuloTotal}>Subtotal s/ IPI:</Text>
            <Text style={estilos.valorTotal}>{dinheiro(pedido.subtotalSemIpi)}</Text>
          </View>

          {pedido.comIpi && (
            <View style={estilos.linhaTotal}>
              <Text style={estilos.rotuloTotal}>
                IPI ({Number(pedido.ipiPercentual).toLocaleString("pt-BR")}%):
              </Text>
              <Text style={estilos.valorTotal}>{dinheiro(pedido.valorIpi)}</Text>
            </View>
          )}

          <View style={estilos.linhaTotal}>
            <Text style={estilos.rotuloTotalGeral}>TOTAL GERAL:</Text>
            <Text style={estilos.valorTotalGeral}>{dinheiro(pedido.totalGeral)}</Text>
          </View>
        </View>

        {pedido.vendedor && (
          <Text style={estilos.rodape} fixed>
            {pedido.vendedor}
          </Text>
        )}
      </Page>
    </Document>
  );
}
