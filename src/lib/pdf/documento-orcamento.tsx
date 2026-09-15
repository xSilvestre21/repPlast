/**
 * O PDF da proposta.
 *
 * NÃO é o PDF do pedido com outro título. O pedido é um documento de compra
 * dirigido a quem já decidiu: caixas, códigos, dados fiscais completos. A
 * proposta é uma carta comercial dirigida a quem ainda está decidindo — abre
 * com a cidade e a data por extenso, chama a pessoa pelo nome, mostra o preço,
 * e fecha esperando resposta.
 *
 * Por isso ele existe como arquivo próprio: `documento-pedido.tsx` é cópia
 * medida do formulário que a indústria imprime, e não tem por que carregar
 * condicionais de um documento que vai para outra pessoa.
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { ROTULO_COLUNA_PRECO, ROTULO_UNIDADE, type Familia, type UnidadeVenda } from "../produto-preco";

export interface ItemOrcamentoPdf {
  codigoCliente: string | null;
  descricao: string;
  quantidade: string;
  unidade: UnidadeVenda;
  precoUnitario: string;
  totalSemIpi: string;
  valorIpi: string;
  total: string;
}

export interface DadosOrcamentoPdf {
  numero: number;
  data: Date;
  validoAte: Date | null;
  familia: Familia | null;

  fornecedor: { nome: string; municipio: string | null };
  logo: Buffer | null;

  /**
   * Para quem a proposta vai.
   *
   * `cadastrado` falso quer dizer que ainda não é cliente — o documento sai
   * igual, porque quem recebe não tem nada com o estado do nosso cadastro.
   */
  cliente: {
    apelido: string;
    razaoSocial: string;
    municipio: string | null;
    uf: string | null;
    cadastrado: boolean;
  };
  attn: string | null;

  itens: ItemOrcamentoPdf[];

  subtotalSemIpi: string;
  valorIpi: string;
  totalGeral: string;
  ipiPercentual: string;

  prazoPagamento: string | null;
  observacoes: string | null;
  vendedor: string | null;
}

const MOEDA = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 });
const MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dinheiro(valor: string) {
  return MOEDA.format(Number(valor));
}

/** "Barretos, 14 de setembro de 2026" — a abertura de uma carta, não de um formulário. */
function dataPorExtenso(cidade: string | null, data: Date) {
  const dia = data.getDate();
  const texto = `${dia} de ${MES[data.getMonth()]} de ${data.getFullYear()}`;

  return cidade ? `${cidade}, ${texto}` : texto;
}

function dataCurta(data: Date) {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const e = StyleSheet.create({
  pagina: {
    paddingTop: 34,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111",
  },

  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 210, maxHeight: 56, objectFit: "contain" },
  marca: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  dataTopo: { fontSize: 9, textAlign: "right" },

  regua: { borderBottomWidth: 1, borderBottomColor: "#111", marginTop: 14, marginBottom: 16 },

  destinatario: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  cidadeCliente: { fontSize: 9, color: "#444", marginTop: 2 },
  aos: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 6 },
  abertura: { marginTop: 14, lineHeight: 1.5 },

  numero: { fontSize: 9, color: "#444", marginTop: 3 },

  // Tabela
  cabecalho: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111",
    paddingBottom: 4,
    marginTop: 18,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
  },
  linha: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#CCC",
    paddingVertical: 5,
  },
  cQtd: { width: "9%" },
  cUn: { width: "7%" },
  cCod: { width: "12%" },
  cItem: { width: "38%", paddingRight: 6 },
  cPreco: { width: "12%", textAlign: "right" },
  cIpi: { width: "10%", textAlign: "right" },
  cTotal: { width: "12%", textAlign: "right" },

  // Totais
  totais: { marginTop: 14, alignSelf: "flex-end", width: 210 },
  linhaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalGeral: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#111",
    marginTop: 4,
    paddingTop: 5,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },

  condicoes: { marginTop: 22, fontSize: 8.5, color: "#333", lineHeight: 1.55 },
  rotuloBloco: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#666", marginBottom: 3 },

  fecho: { marginTop: 26, lineHeight: 1.5 },
  assinatura: { marginTop: 16, fontFamily: "Helvetica-Bold" },

  rodape: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: "#888",
    textAlign: "center",
  },
});

export function DocumentoOrcamento({ dados }: { dados: DadosOrcamentoPdf }) {
  const rotuloPreco = dados.familia ? ROTULO_COLUNA_PRECO[dados.familia] : "PREÇO";
  const temIpi = Number(dados.valorIpi) > 0;

  return (
    <Document
      title={`Orçamento ${dados.numero} — ${dados.cliente.apelido}`}
      author={dados.fornecedor.nome}
    >
      <Page size="A4" style={e.pagina}>
        <View style={e.topo}>
          {dados.logo ? (
            // O <Image> aqui é o do react-pdf, não o do HTML: não existe alt
            // num PDF, e o logo é decorativo — o nome da indústria já está no
            // documento.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={dados.logo} style={e.logo} />
          ) : (
            <Text style={e.marca}>{dados.fornecedor.nome}</Text>
          )}

          <View>
            <Text style={e.dataTopo}>
              {dataPorExtenso(dados.fornecedor.municipio, dados.data)}
            </Text>
            <Text style={[e.numero, { textAlign: "right" }]}>
              Proposta nº {dados.numero}
            </Text>
          </View>
        </View>

        <View style={e.regua} />

        <Text style={e.destinatario}>{dados.cliente.razaoSocial}</Text>
        {dados.cliente.municipio && (
          <Text style={e.cidadeCliente}>
            {dados.cliente.municipio}
            {dados.cliente.uf ? `/${dados.cliente.uf}` : ""}
          </Text>
        )}
        {dados.attn && <Text style={e.aos}>A/C {dados.attn}</Text>}

        <Text style={e.abertura}>
          Segue abaixo nossa proposta com os valores e demais condições de fornecimento.
        </Text>

        {/* Tabela */}
        <View style={e.cabecalho}>
          <Text style={e.cQtd}>QTDE</Text>
          <Text style={e.cUn}>UN</Text>
          <Text style={e.cCod}>CÓD.CLI</Text>
          <Text style={e.cItem}>ITEM</Text>
          <Text style={e.cPreco}>{rotuloPreco}</Text>
          <Text style={e.cIpi}>IPI</Text>
          <Text style={e.cTotal}>TOTAL</Text>
        </View>

        {dados.itens.map((item, i) => (
          <View key={i} style={e.linha} wrap={false}>
            <Text style={e.cQtd}>{item.quantidade}</Text>
            <Text style={e.cUn}>{ROTULO_UNIDADE[item.unidade]}</Text>
            <Text style={e.cCod}>{item.codigoCliente ?? ""}</Text>
            <Text style={e.cItem}>{item.descricao}</Text>
            <Text style={e.cPreco}>{dinheiro(item.precoUnitario)}</Text>
            <Text style={e.cIpi}>{dinheiro(item.valorIpi)}</Text>
            <Text style={e.cTotal}>{dinheiro(item.total)}</Text>
          </View>
        ))}

        <View style={e.totais}>
          <View style={e.linhaTotal}>
            <Text>Subtotal s/ IPI</Text>
            <Text>{dinheiro(dados.subtotalSemIpi)}</Text>
          </View>
          {temIpi && (
            <View style={e.linhaTotal}>
              <Text>IPI ({dados.ipiPercentual}%)</Text>
              <Text>{dinheiro(dados.valorIpi)}</Text>
            </View>
          )}
          <View style={e.totalGeral}>
            <Text>TOTAL</Text>
            <Text>{dinheiro(dados.totalGeral)}</Text>
          </View>
        </View>

        {(dados.observacoes || dados.prazoPagamento || dados.validoAte) && (
          <View style={e.condicoes}>
            <Text style={e.rotuloBloco}>CONDIÇÕES</Text>
            {dados.prazoPagamento && (
              <Text>Condições de pagamento: {dados.prazoPagamento}</Text>
            )}
            {dados.observacoes && <Text>{dados.observacoes}</Text>}
            {dados.validoAte && (
              <Text>Proposta válida até {dataCurta(dados.validoAte)}.</Text>
            )}
          </View>
        )}

        <Text style={e.fecho}>
          No aguardo de um retorno positivo, permanecemos à disposição para qualquer
          esclarecimento.
        </Text>
        {dados.vendedor && <Text style={e.assinatura}>{dados.vendedor}</Text>}

        <Text
          style={e.rodape}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} de ${totalPages}` : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}
