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
import "./hifenizacao";

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
   * Para quem a proposta vai — só o nome, e é o apelido.
   *
   * Sai igual para quem ainda não é cliente: quem recebe a carta não tem nada
   * com o estado do nosso cadastro.
   */
  cliente: { apelido: string };
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
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dinheiro(valor: string) {
  return `R$ ${MOEDA.format(Number(valor))}`;
}

/** "Americana, 16 de Setembro de 2026" — a abertura de uma carta, não de um formulário. */
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
    paddingTop: 30,
    paddingBottom: 34,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111",
  },

  /*
   * Altura FIXA, e é o que segura o cabeçalho de pé.
   *
   * Cada indústria manda o logo com a moldura que quiser: o da QualyPlast tem
   * a marca num terço da altura do arquivo, o da Eripack ocupa quase tudo.
   * Fosse a altura livre, o destinatário subiria ou desceria conforme o
   * arquivo — na Eripack ele chegou a encostar no logo. Com a caixa fixa, cada
   * logo cresce até onde couber e o resto do documento não se mexe.
   */
  topo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    height: 64,
  },
  /*
   * A largura é que manda aqui, e a altura só existe como trava.
   *
   * O arquivo que a indústria manda costuma vir com moldura transparente em
   * volta da arte — o da QualyPlast tem 1600x869 e a marca ocupa um terço da
   * altura. Limitando pela altura, o `contain` encolhe a MOLDURA até caber e a
   * marca some junto; limitando pela largura, ela sai do tamanho do modelo
   * impresso e a moldura vira só espaço em branco, que é o que ela é.
   */
  /*
   * `objectPositionX: 0` encosta a arte na margem, e não é detalhe.
   *
   * O `contain` centraliza a imagem na caixa, então um logo mais "quadrado"
   * que a caixa sobra espaço dos dois lados — e ele aparecia deslocado uns
   * 16pt para dentro, desalinhado do nome do cliente e da tabela logo abaixo.
   */
  logo: { maxWidth: 150, maxHeight: 64, objectFit: "contain", objectPositionX: 0 },
  marca: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  dataTopo: { fontSize: 10, textAlign: "right" },

  destinatario: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 12 },
  aos: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 4 },
  abertura: { marginTop: 3 },

  numero: { fontSize: 10, color: "#444", marginTop: 2 },

  // Tabela
  cabecalho: {
    flexDirection: "row",
    borderTopWidth: 0.5,
    borderTopColor: "#999",
    borderBottomWidth: 0.5,
    borderBottomColor: "#999",
    paddingVertical: 3.5,
    marginTop: 12,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  // Sem filete entre as linhas: o modelo separa item de item pelo espaço, e um
  // traço por linha transformaria quatro produtos numa grade.
  linha: { flexDirection: "row", paddingVertical: 4 },
  fimDaTabela: { borderTopWidth: 0.5, borderTopColor: "#999" },

  cQtd: { width: "5.5%" },
  cUn: { width: "4.5%" },
  // O código do cliente enche a coluna inteira ("P00B00006"), e sem a folga ele
  // encostaria na descrição — os dois viravam uma palavra só.
  cCod: { width: "9.5%", paddingRight: 5 },
  cItem: { width: "34%", paddingRight: 6 },
  cPreco: { width: "10.5%", textAlign: "right" },
  cTotalSemIpi: { width: "11%", textAlign: "right" },
  cIpi: { width: "11%", textAlign: "right" },
  cTotal: { width: "14%", textAlign: "right" },

  // Totais
  totais: { marginTop: 20, alignSelf: "flex-end", width: 275 },
  linhaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalGeral: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
  },

  condicoes: { marginTop: 13 },
  /*
   * Entrelinha das condições, medida contra o modelo impresso.
   *
   * O número parece pequeno porque no react-pdf `lineHeight` NÃO é múltiplo do
   * corpo da fonte — o padrão dele equivale a ~0,56 aqui. 0,48 é o que
   * reproduz as seis linhas coladas do modelo, e ele precisa estar no próprio
   * `Text`: posto no `View`, não desce para os filhos.
   */
  linhaCondicao: { lineHeight: 0.65 },

  fecho: { marginTop: 21 },
  saudacao: { marginTop: 12 },
  assinatura: { marginTop: 2, fontFamily: "Helvetica-Bold" },

  rodape: {
    position: "absolute",
    bottom: 18,
    left: 40,
    right: 40,
    fontSize: 8,
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
      {/*
        Paisagem, como o modelo impresso sempre foi: são oito colunas, e em
        retrato a descrição do produto perde metade da largura e passa a
        quebrar em duas linhas.
      */}
      <Page size="A4" orientation="landscape" style={e.pagina}>
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

        {/* O apelido, e não a razão social: a proposta é uma carta, e quem a
            recebe se reconhece pelo nome com que atende ao telefone. */}
        <Text style={e.destinatario}>{dados.cliente.apelido}</Text>
        {dados.attn && <Text style={e.aos}>A/C {dados.attn}</Text>}

        <Text style={e.abertura}>
          Segue abaixo nossa proposta com os valores e demais condições de fornecimento
        </Text>

        {/* Tabela */}
        <View style={e.cabecalho}>
          <Text style={e.cQtd}>QTDE</Text>
          <Text style={e.cUn}>UN</Text>
          <Text style={e.cCod}>CÓD.CLI</Text>
          <Text style={e.cItem}>ITEM</Text>
          <Text style={e.cPreco}>{rotuloPreco}</Text>
          <Text style={e.cTotalSemIpi}>TOTAL S/ IPI</Text>
          <Text style={e.cIpi}>VALOR IPI</Text>
          <Text style={e.cTotal}>TOTAL</Text>
        </View>

        {dados.itens.map((item, i) => (
          <View key={i} style={e.linha} wrap={false}>
            <Text style={e.cQtd}>{item.quantidade}</Text>
            <Text style={e.cUn}>{ROTULO_UNIDADE[item.unidade]}</Text>
            <Text style={e.cCod}>{item.codigoCliente ?? ""}</Text>
            <Text style={e.cItem}>{item.descricao}</Text>
            <Text style={e.cPreco}>{dinheiro(item.precoUnitario)}</Text>
            <Text style={e.cTotalSemIpi}>{dinheiro(item.totalSemIpi)}</Text>
            <Text style={e.cIpi}>{dinheiro(item.valorIpi)}</Text>
            <Text style={e.cTotal}>{dinheiro(item.total)}</Text>
          </View>
        ))}

        <View style={e.fimDaTabela} />

        <View style={e.totais}>
          <View style={e.linhaTotal}>
            <Text>Subtotal s/ IPI:</Text>
            <Text>{dinheiro(dados.subtotalSemIpi)}</Text>
          </View>
          {temIpi && (
            <View style={e.linhaTotal}>
              <Text>Total IPI ({dados.ipiPercentual}%):</Text>
              <Text>{dinheiro(dados.valorIpi)}</Text>
            </View>
          )}
          <View style={e.totalGeral}>
            <Text>TOTAL GERAL:</Text>
            <Text>{dinheiro(dados.totalGeral)}</Text>
          </View>
        </View>

        {(dados.observacoes || dados.prazoPagamento || dados.validoAte) && (
          <View style={e.condicoes}>
            {dados.prazoPagamento && (
              <Text style={e.linhaCondicao}>
                Condições de pagamento: {dados.prazoPagamento}
              </Text>
            )}
            {dados.observacoes && <Text style={e.linhaCondicao}>{dados.observacoes}</Text>}
            {dados.validoAte && (
              <Text style={e.linhaCondicao}>
                Proposta válida até: {dataCurta(dados.validoAte)}
              </Text>
            )}
          </View>
        )}

        <Text style={e.fecho}>
          No aguardo de um retorno positivo, coloco-me à disposição para maiores
          esclarecimentos
        </Text>
        {dados.vendedor && (
          <>
            <Text style={e.saudacao}>Sds</Text>
            <Text style={e.assinatura}>{dados.vendedor}</Text>
          </>
        )}

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
