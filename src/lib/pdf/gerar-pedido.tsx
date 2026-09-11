/**
 * Carrega um pedido e o transforma em PDF.
 *
 * Isolado da rota de propósito: o envio por e-mail precisa exatamente do mesmo
 * arquivo que o download entrega, e duplicar a montagem seria pedir para os
 * dois divergirem.
 */

import { renderToBuffer } from "@react-pdf/renderer";

import { dbParaOrganizacao } from "../db";
import type { Familia, UnidadeVenda } from "../produto-preco";
import { DocumentoPedido, type DadosPedidoPdf } from "./documento-pedido";
import { nomeArquivoPedido } from "./nome-arquivo";

export type PedidoParaPdf = {
  dados: DadosPedidoPdf;
  nomeArquivo: string;
  emailsFornecedor: string[];
  status: string;
};

/** Busca o pedido com escopo de escritório e monta os dados do PDF. */
export async function carregarPedidoParaPdf(
  pedidoId: string,
  organizacaoId: string,
): Promise<PedidoParaPdf | null> {
  const db = dbParaOrganizacao(organizacaoId);

  const pedido = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    include: {
      cliente: true,
      fornecedor: { select: { nome: true, logo: true, emailsPedido: true } },
      itens: { orderBy: { ordem: "asc" } },
    },
  });

  if (!pedido) return null;

  const texto = (v: { toString(): string } | null) => (v === null ? null : v.toString());

  return {
    status: pedido.status,
    emailsFornecedor: pedido.fornecedor.emailsPedido,
    nomeArquivo: nomeArquivoPedido({
      numero: pedido.numero,
      apelidoCliente: pedido.cliente.apelido,
      pedidoDoCliente: pedido.pedidoDoCliente,
      prazoEntrega: pedido.prazoEntrega,
    }),
    dados: {
      numero: pedido.numero,
      data: pedido.criadoEm,
      // Todos os itens de um pedido são da mesma indústria, mas podem ser de
      // famílias diferentes; o rótulo da coluna de preço segue o primeiro.
      familia: (pedido.itens[0]?.familia as Familia | undefined) ?? null,

      fornecedor: { nome: pedido.fornecedor.nome },
      logo: pedido.fornecedor.logo ? Buffer.from(pedido.fornecedor.logo) : null,

      cliente: {
        razaoSocial: pedido.cliente.razaoSocial,
        cnpj: pedido.cliente.cnpj,
        ie: pedido.cliente.ie,
        uf: pedido.cliente.uf,
        endereco: pedido.cliente.endereco,
        bairro: pedido.cliente.bairro,
        cep: pedido.cliente.cep,
        municipio: pedido.cliente.municipio,
        telefone: pedido.cliente.telefone,
        emailNfe: pedido.cliente.emailNfe,
      },

      prazoPagamento: pedido.prazoPagamento,
      prazoEntrega: pedido.prazoEntrega,
      pedidoDoCliente: pedido.pedidoDoCliente,
      tipoFrete: pedido.tipoFrete,
      transportadora: pedido.transportadora,
      observacoes: pedido.observacoes,
      vendedor: pedido.vendedor,

      // Derivado das LINHAS: a faixa de IPI só sai no PDF se alguma delas for
      // tributada. Antes isto era um campo do pedido; com a isenção por item,
      // perguntar às linhas é a única resposta que não pode divergir do que a
      // coluna IPI mostra logo acima.
      comIpi: pedido.itens.some((item) => item.comIpi),
      ipiPercentual: pedido.ipiPercentual.toString(),
      subtotalSemIpi: pedido.subtotalSemIpi.toString(),
      valorIpi: pedido.valorIpi.toString(),
      totalGeral: pedido.totalGeral.toString(),

      itens: pedido.itens.map((item) => ({
        codigoFornecedor: item.codigoFornecedor,
        codigoCliente: item.codigoCliente,
        descricao: item.descricao,
        quantidade: item.quantidade.toString(),
        unidade: item.unidade as UnidadeVenda,
        precoUnitario: texto(item.precoUnitario)!,
        totalSemIpi: item.totalSemIpi.toString(),
        valorIpi: item.valorIpi.toString(),
        total: item.total.toString(),
      })),
    },
  };
}

export async function gerarPdfPedido(dados: DadosPedidoPdf): Promise<Buffer> {
  return renderToBuffer(<DocumentoPedido pedido={dados} />);
}
