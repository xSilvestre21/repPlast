"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { escopoAtual, exigirAdmin } from "@/lib/sessao";

import { dadosDoFormulario, lerAditivos } from "./leitura";

export type EstadoFormulario = { erro?: string };

/**
 * Cadastro de produto é do administrador: o preposto consulta,
 * mas não cria, altera nem exclui. O banco recusa de todo jeito (migration
 * `cadastros_so_do_admin`); a checagem aqui é para a mensagem ser legível.
 */
async function contexto() {
  await exigirAdmin();
  return escopoAtual();
}

/** Confirma que fornecedor e aditivos pertencem ao escritório antes de gravar. */
async function validarVinculos(
  db: Awaited<ReturnType<typeof contexto>>["db"],
  organizacaoId: string,
  fornecedorId: string,
  aditivos: string[],
  clienteId: string | null,
) {
  const fornecedor = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
  if (fornecedor === 0) throw new Error("Indústria não encontrada.");

  /*
   * O cliente é conferido pelo mesmo caminho da indústria, e não só pelo RLS.
   * A policy recusaria a gravação de qualquer jeito, mas com um erro de banco;
   * aqui a pessoa lê uma frase que explica o que houve.
   */
  if (clienteId) {
    const cliente = await db.cliente.count({ where: { id: clienteId, organizacaoId } });
    if (cliente === 0) throw new Error("Cliente não encontrado.");
  }

  if (aditivos.length > 0) {
    const validos = await db.aditivo.count({
      where: { id: { in: aditivos }, fornecedorId },
    });

    if (validos !== aditivos.length) {
      throw new Error("Algum aditivo selecionado não pertence a esta indústria.");
    }
  }
}

export async function criarProduto(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, db } = await contexto();
    const dados = dadosDoFormulario(formData);
    const aditivos = lerAditivos(formData);

    await validarVinculos(db, organizacaoId, dados.fornecedorId, aditivos, dados.clienteId);

    const produto = await db.produto.create({
      data: {
        organizacaoId,
        ...dados,
        aditivos: { create: aditivos.map((aditivoId) => ({ aditivoId })) },
      },
    });

    destino = `/produtos/${produto.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/produtos");
  redirect(destino);
}

/**
 * Cadastra como produto do cliente um item de proposta que nasceu de conta, e
 * liga o item a ele.
 *
 * O formulário chega preenchido com a conta; aqui só se confere que o produto
 * continua sendo DAQUELA proposta — mesma indústria, mesmo cliente. Trocar um
 * dos dois no formulário faria a proposta apontar para produto de outra
 * empresa, que é justamente o que o pedido não pode levar.
 *
 * Preço e descrição do item não mudam: a proposta é o que o cliente recebeu.
 */
export async function criarProdutoDoItem(
  itemId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, db } = await contexto();

    const item = await db.orcamentoItem.findFirst({
      where: { id: itemId, orcamento: { organizacaoId } },
      select: {
        produtoId: true,
        orcamento: { select: { id: true, clienteId: true, fornecedorId: true } },
      },
    });

    if (!item) return { erro: "Item da proposta não encontrado." };
    if (item.produtoId) return { erro: "Este item já é um produto cadastrado." };
    if (!item.orcamento.clienteId) return { erro: "Cadastre o cliente da proposta antes." };

    const dados = dadosDoFormulario(formData);
    const aditivos = lerAditivos(formData);

    if (dados.fornecedorId !== item.orcamento.fornecedorId) {
      return { erro: "O produto tem de ser da indústria da proposta." };
    }
    if (dados.clienteId !== item.orcamento.clienteId) {
      return { erro: "O produto tem de ser do cliente da proposta." };
    }

    await validarVinculos(db, organizacaoId, dados.fornecedorId, aditivos, dados.clienteId);

    const produto = await db.produto.create({
      data: {
        organizacaoId,
        ...dados,
        aditivos: { create: aditivos.map((aditivoId) => ({ aditivoId })) },
      },
      select: { id: true, codigoFornecedor: true, codigoCliente: true },
    });

    await db.orcamentoItem.update({
      where: { id: itemId },
      data: {
        produtoId: produto.id,
        codigoFornecedor: produto.codigoFornecedor,
        codigoCliente: produto.codigoCliente,
      },
    });

    destino = `/orcamentos/${item.orcamento.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/produtos");
  revalidatePath(destino);
  redirect(destino);
}

export async function atualizarProduto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    const dados = dadosDoFormulario(formData);
    const aditivos = lerAditivos(formData);

    await validarVinculos(db, organizacaoId, dados.fornecedorId, aditivos, dados.clienteId);

    const { count } = await db.produto.updateMany({
      where: { id, organizacaoId },
      data: dados,
    });

    if (count === 0) return { erro: "Produto não encontrado." };

    // A lista de aditivos é substituída inteira — mais simples e sem risco de
    // sobrar vínculo órfão de uma troca de indústria.
    await db.produtoAditivo.deleteMany({ where: { produtoId: id } });
    if (aditivos.length > 0) {
      await db.produtoAditivo.createMany({
        data: aditivos.map((aditivoId) => ({ produtoId: id, aditivoId })),
      });
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  // "Salvar e voltar", como no pedido: gravou, a ficha volta a ser leitura.
  redirect("/produtos");
}

export async function excluirProduto(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const emPedidos = await db.pedidoItem.count({ where: { produtoId: id } });
  if (emPedidos > 0) {
    throw new Error(
      `Este produto está em ${emPedidos} item(ns) de pedido e não pode ser excluído.`,
    );
  }

  await db.produto.deleteMany({ where: { id, organizacaoId } });

  revalidatePath("/produtos");
  redirect("/produtos");
}

/**
 * Liga e desliga o produto.
 *
 * Inativar, e não apagar: produto que o cliente deixou de comprar continua nos
 * pedidos e propostas em que já entrou — e um produto com pedido nem pode ser
 * excluído. Inativo, ele sai das escolhas de item de pedido e de proposta (que
 * já filtram `ativo`), da ficha do cliente e da lista padrão — e volta com um
 * clique, quando o cliente voltar a comprar.
 */
export async function alternarAtivoProduto(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const produto = await db.produto.findFirst({
    where: { id, organizacaoId },
    select: { ativo: true },
  });
  if (!produto) throw new Error("Produto não encontrado.");

  await db.produto.updateMany({
    where: { id, organizacaoId },
    data: { ativo: !produto.ativo },
  });

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
}
