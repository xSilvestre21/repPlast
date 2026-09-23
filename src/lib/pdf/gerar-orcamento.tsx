/**
 * Carrega um orçamento e o transforma em PDF.
 *
 * Mesmo desenho do gerador do pedido: a busca fica separada da rota para poder
 * ser reaproveitada por qualquer outro caminho que precise do mesmo arquivo.
 */

import { renderToBuffer } from "@react-pdf/renderer";

import { type Ator, dbParaOrganizacao } from "../db";
import type { Familia, UnidadeVenda } from "../produto-preco";
import { DocumentoOrcamento, type DadosOrcamentoPdf } from "./documento-orcamento";

export type OrcamentoParaPdf = {
  dados: DadosOrcamentoPdf;
  nomeArquivo: string;
};

/**
 * Nome do arquivo da proposta.
 *
 * Começa com "orcamento" de propósito: o cliente costuma receber os dois
 * documentos, e o do pedido abre com o número puro. Sem a palavra, dois
 * arquivos na mesma pasta de downloads ficariam indistinguíveis.
 */
function nomeArquivoOrcamento(numero: number, apelidoCliente: string, data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");

  const limpo = apelidoCliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return `orcamento-${numero}-${limpo}-${dia}-${mes}-${data.getFullYear()}.pdf`;
}

export async function carregarOrcamentoParaPdf(
  orcamentoId: string,
  organizacaoId: string,
  ator: Ator,
): Promise<OrcamentoParaPdf | null> {
  const db = dbParaOrganizacao(organizacaoId, ator);

  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    include: {
      cliente: { select: { apelido: true } },
      fornecedor: { select: { nome: true, logo: true } },
      itens: { orderBy: { ordem: "asc" } },
    },
  });

  if (!orcamento) return null;

  return {
    dados: {
      numero: orcamento.numero,
      data: orcamento.criadoEm,
      validoAte: orcamento.validoAte,
      // O rótulo da coluna de preço segue a família da primeira linha, como no
      // pedido: uma proposta é de uma indústria e costuma ser de uma família.
      familia: (orcamento.itens[0]?.familia as Familia | undefined) ?? null,
      unidade: (orcamento.itens[0]?.unidade as UnidadeVenda | undefined) ?? null,

      fornecedor: { nome: orcamento.fornecedor.nome },
      /*
       * A cidade que abre a carta é a de QUEM ESCREVEU, congelada na proposta.
       *
       * Era a do fornecedor, o que dizia ao cliente que a proposta saiu da
       * cidade da fábrica — a 400 km de quem assinou embaixo, às vezes. Proposta
       * antiga não tem cidade e abre só com a data, que é discreto; repetir ali a
       * da indústria seria manter a informação errada de propósito.
       */
      cidade: orcamento.cidade,
      logo: orcamento.fornecedor.logo ? Buffer.from(orcamento.fornecedor.logo) : null,

      cliente: {
        apelido:
          orcamento.cliente?.apelido ?? orcamento.clienteAvulsoNome ?? "(sem destinatário)",
      },
      attn: orcamento.attn,

      itens: orcamento.itens.map((i) => ({
        codigoCliente: i.codigoCliente,
        descricao: i.descricao,
        quantidade: i.quantidade.toString(),
        unidade: i.unidade,
        precoUnitario: i.precoUnitario.toString(),
        totalSemIpi: i.totalSemIpi.toString(),
        valorIpi: i.valorIpi.toString(),
        total: i.total.toString(),
      })),

      subtotalSemIpi: orcamento.subtotalSemIpi.toString(),
      valorIpi: orcamento.valorIpi.toString(),
      totalGeral: orcamento.totalGeral.toString(),
      ipiPercentual: orcamento.ipiPercentual.toString(),

      prazoPagamento: orcamento.prazoPagamento,
      observacoes: orcamento.observacoes,
      vendedor: orcamento.vendedor,
    },
    nomeArquivo: nomeArquivoOrcamento(
      orcamento.numero,
      orcamento.cliente?.apelido ?? orcamento.clienteAvulsoNome ?? "proposta",
      orcamento.criadoEm,
    ),
  };
}

export async function gerarPdfOrcamento(dados: DadosOrcamentoPdf): Promise<Buffer> {
  return renderToBuffer(<DocumentoOrcamento dados={dados} />);
}
