/**
 * Carrega um orçamento e o transforma em PDF.
 *
 * Mesmo desenho do gerador do pedido: a busca fica separada da rota para poder
 * ser reaproveitada por qualquer outro caminho que precise do mesmo arquivo.
 */

import { renderToBuffer } from "@react-pdf/renderer";

import { type Ator, dbParaOrganizacao } from "../db";
import { rotuloPrecoDosItens, type Familia, type UnidadeVenda } from "../produto-preco";
import { DocumentoOrcamento, type DadosOrcamentoPdf } from "./documento-orcamento";
import { nomeArquivoOrcamento } from "./nome-arquivo";

export type OrcamentoParaPdf = {
  dados: DadosOrcamentoPdf;
  nomeArquivo: string;
};

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
      // O rótulo da coluna de preço olha todas as linhas, como no pedido.
      rotuloPreco: rotuloPrecoDosItens(
        orcamento.itens.map((i) => ({
          familia: i.familia as Familia,
          unidade: i.unidade as UnidadeVenda,
        })),
      ),

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
