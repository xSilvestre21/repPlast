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

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 34,
    paddingBottom: 56,
    paddingHorizontal: 34,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#111111",
  },

  topo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  /*
   * A caixa da logo veio MEDIDA dos pedidos reais, não escolhida no olho.
   *
   * Nos PDFs que a QUALYPLAST emite (referência 2253 e 2256) a marca é
   * desenhada a 128,9 x 70,0 pt — proporção 1,84, a mesma do arquivo de
   * 1600x869 px que está no cadastro. Com `contain`, uma caixa de 150 x 70
   * reproduz esse tamanho exato: a altura é quem limita, e 70 x 1,84 dá os
   * 128,8 pt da referência.
   *
   * A altura era 46, e é por isso que a marca saía menor que a da indústria:
   * o teto cortava em 84,6 pt de largura, dois terços do que deveria.
   *
   * O limite de largura continua em 150 para uma marca muito deitada não
   * avançar sobre o número do pedido, que divide esta linha com ela.
   */
  logo: { maxWidth: 150, maxHeight: 70, objectFit: "contain" },
  logoAusente: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  numeroPedido: { fontSize: 15, fontFamily: "Helvetica-Bold", textAlign: "right" },
  dataPedido: { fontSize: 8, textAlign: "right", marginTop: 2 },

  regua: { borderTopWidth: 1, borderTopColor: LINHA, marginBottom: 10 },

  tituloSecao: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 6 },

  grade: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  campo: { width: "33.33%", marginBottom: 7, paddingRight: 8 },
  campoLargo: { width: "66.66%", marginBottom: 7, paddingRight: 8 },
  rotulo: { fontSize: 6.5, fontFamily: "Helvetica-Bold", marginBottom: 1.5 },
  valor: { fontSize: 8 },

  observacoes: { marginTop: 6, marginBottom: 12 },
  linhaObservacao: { fontSize: 8, marginBottom: 1.5 },

  cabecalhoTabela: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#333333",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    paddingVertical: 4,
  },
  colunaCabecalho: { fontSize: 6.5, fontFamily: "Helvetica-Bold", paddingRight: 4 },
  // Como no pedido real, não há fio entre os itens: só embaixo do bloco.
  corpoTabela: { borderBottomWidth: 0.5, borderBottomColor: LINHA },
  linhaItem: { flexDirection: "row", paddingVertical: 4 },
  celula: { fontSize: 8, paddingRight: 4 },
  /** Respiro para as colunas alinhadas à direita não encostarem na seguinte. */
  celulaNumero: { fontSize: 8, textAlign: "right", paddingRight: 4 },

  totais: { marginTop: 10, alignItems: "flex-end" },
  linhaTotal: { flexDirection: "row", marginBottom: 2 },
  rotuloTotal: { width: 120, textAlign: "right", paddingRight: 10, fontSize: 8 },
  valorTotal: { width: 90, textAlign: "right", fontSize: 8 },
  rotuloTotalGeral: {
    width: 120,
    textAlign: "right",
    paddingRight: 10,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  valorTotalGeral: { width: 90, textAlign: "right", fontSize: 11, fontFamily: "Helvetica-Bold" },

  rodape: { position: "absolute", bottom: 30, left: 34, right: 34, fontSize: 8 },
});

/**
 * Larguras das colunas, em porcentagem da faixa útil (~527pt no A4).
 *
 * As colunas de dinheiro têm largura mínima calculada: "R$ 111.687,53" mede
 * cerca de 61pt em Helvetica 8, então 12% (63pt) é o piso. Abaixo disso o
 * texto não quebra — ele transborda por cima da coluna vizinha, que foi
 * exatamente o que aconteceu na primeira versão.
 */
const COLUNAS = {
  codigoFornecedor: "7%",
  codigoCliente: "10%",
  descricao: "24%",
  quantidade: "5%",
  unidade: "4%",
  preco: "12%",
  totalSemIpi: "13%",
  ipi: "12%",
  total: "13%",
} as const;

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const dinheiro = (valor: string) => MOEDA.format(Number(valor));

const quantidade = (valor: string) =>
  Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function Campo({
  rotulo,
  valor,
  largo = false,
}: {
  rotulo: string;
  valor: string | null | undefined;
  largo?: boolean;
}) {
  if (!valor) return null;

  return (
    <View style={largo ? estilos.campoLargo : estilos.campo}>
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
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.topo} fixed>
          {pedido.logo ? (
            // O Image aqui é do @react-pdf, não do HTML: não existe alt em PDF.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={estilos.logo} src={pedido.logo} />
          ) : (
            <Text style={estilos.logoAusente}>{pedido.fornecedor.nome}</Text>
          )}

          <View>
            <Text style={estilos.numeroPedido}>PEDIDO Nº {pedido.numero}</Text>
            <Text style={estilos.dataPedido}>Data: {DATA.format(pedido.data)}</Text>
          </View>
        </View>

        <View style={estilos.regua} />

        <Text style={estilos.tituloSecao}>DADOS DO CLIENTE</Text>

        <View style={estilos.grade}>
          <Campo rotulo="RAZÃO SOCIAL" valor={cliente.razaoSocial} />
          <Campo rotulo="CNPJ" valor={cliente.cnpj} />
          <Campo rotulo="UF / IE" valor={[cliente.uf, cliente.ie].filter(Boolean).join("   ")} />

          <Campo rotulo="ENDEREÇO" valor={cliente.endereco} />
          <Campo rotulo="BAIRRO" valor={cliente.bairro} />
          <Campo rotulo="CEP" valor={cliente.cep} />

          <Campo rotulo="MUNICÍPIO" valor={cliente.municipio} />
          <Campo rotulo="TELEFONE" valor={cliente.telefone} />
          <Campo rotulo="E-MAIL PARA ENVIO DA NF-e" valor={cliente.emailNfe} />

          <Campo rotulo="PRAZO PARA PAGAMENTO" valor={pedido.prazoPagamento} />
          <Campo
            rotulo="PRAZO PARA ENTREGA"
            valor={pedido.prazoEntrega ? DATA.format(pedido.prazoEntrega) : null}
          />
          {/* Frete e transportadora não constam dos pedidos de referência:
              só aparecem quando preenchidos, para não poluir o de sempre. */}
          <Campo rotulo="FRETE" valor={frete} />

          <Campo rotulo="PEDIDO DO CLIENTE" valor={pedido.pedidoDoCliente} />
        </View>

        {pedido.observacoes && (
          <View style={estilos.observacoes}>
            <Text style={estilos.tituloSecao}>OBSERVAÇÃO</Text>
            {pedido.observacoes.split("\n").map((linha, indice) => (
              <Text key={indice} style={estilos.linhaObservacao}>
                {linha}
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
              { width: COLUNAS.quantidade, textAlign: "right", paddingRight: 4 },
            ]}
          >
            QNT
          </Text>
          <Text style={[estilos.colunaCabecalho, { width: COLUNAS.unidade, paddingLeft: 2 }]}>
            UN
          </Text>
          <Text
            style={[
              estilos.colunaCabecalho,
              { width: COLUNAS.preco, textAlign: "right", paddingRight: 4 },
            ]}
          >
            {rotuloPreco}
          </Text>
          <Text
            style={[
              estilos.colunaCabecalho,
              { width: COLUNAS.totalSemIpi, textAlign: "right", paddingRight: 4 },
            ]}
          >
            TOT S/IPI
          </Text>
          <Text
            style={[
              estilos.colunaCabecalho,
              { width: COLUNAS.ipi, textAlign: "right", paddingRight: 4 },
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
              <Text style={[estilos.celula, { width: COLUNAS.unidade, paddingLeft: 2 }]}>
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
                style={[estilos.celulaNumero, { width: COLUNAS.total, paddingRight: 0 }]}
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
