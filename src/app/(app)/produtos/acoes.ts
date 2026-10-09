"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";

import { dadosDoFormulario, lerAditivos } from "./leitura";

export type { EstadoFormulario };

const PRODUTO_SUMIU =
  "Este produto não foi encontrado — ele pode ter sido excluído em outra tela. " +
  "Volte à lista de produtos e confira.";

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
  if (fornecedor === 0) {
    throw new ErroDeCampo(
      "fornecedorId",
      "Esta indústria não foi encontrada — ela pode ter sido excluída. Escolha outra na lista.",
    );
  }

  /*
   * O cliente é conferido pelo mesmo caminho da indústria, e não só pelo RLS.
   * A policy recusaria a gravação de qualquer jeito, mas com um erro de banco;
   * aqui a pessoa lê uma frase que explica o que houve.
   */
  if (clienteId) {
    const cliente = await db.cliente.count({ where: { id: clienteId, organizacaoId } });
    if (cliente === 0) {
      throw new ErroDeCampo(
        "clienteId",
        "Este cliente não foi encontrado — ele pode ter sido excluído. Escolha outro na lista.",
      );
    }
  }

  if (aditivos.length > 0) {
    const validos = await db.aditivo.count({
      where: { id: { in: aditivos }, fornecedorId },
    });

    if (validos !== aditivos.length) {
      throw new ErroDeCampo(
        "aditivos",
        "Um dos aditivos marcados não é desta indústria — isso acontece ao trocar a indústria " +
          "depois de marcar. Desmarque os aditivos e marque de novo.",
      );
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
    return falhou(erro, formData);
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

    if (!item) {
      throw new ErroParaUsuario(
        "Este item da proposta não foi encontrado — ele pode ter sido removido. Volte à proposta e confira.",
      );
    }
    if (item.produtoId) {
      throw new ErroParaUsuario("Este item já virou produto cadastrado. Volte à proposta para vê-lo.");
    }
    if (!item.orcamento.clienteId) {
      throw new ErroParaUsuario(
        "Antes de cadastrar o produto, cadastre o cliente da proposta — o produto é dele.",
      );
    }

    const dados = dadosDoFormulario(formData);
    const aditivos = lerAditivos(formData);

    if (dados.fornecedorId !== item.orcamento.fornecedorId) {
      throw new ErroDeCampo(
        "fornecedorId",
        "O produto precisa ser da mesma indústria da proposta. Volte a indústria para a da proposta.",
      );
    }
    if (dados.clienteId !== item.orcamento.clienteId) {
      throw new ErroDeCampo(
        "clienteId",
        "O produto precisa ser do mesmo cliente da proposta. Volte o cliente para o da proposta.",
      );
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
    return falhou(erro, formData);
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

    if (count === 0) throw new ErroParaUsuario(PRODUTO_SUMIU);

    // A lista de aditivos é substituída inteira — mais simples e sem risco de
    // sobrar vínculo órfão de uma troca de indústria.
    await db.produtoAditivo.deleteMany({ where: { produtoId: id } });
    if (aditivos.length > 0) {
      await db.produtoAditivo.createMany({
        data: aditivos.map((aditivoId) => ({ produtoId: id, aditivoId })),
      });
    }
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
  // "Salvar e voltar", como no pedido: gravou, a ficha volta a ser leitura.
  redirect("/produtos");
}

export async function excluirProduto(
  id: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const emPedidos = await db.pedidoItem.count({ where: { produtoId: id } });
    if (emPedidos > 0) {
      const onde = emPedidos === 1 ? "1 pedido" : `${emPedidos} itens de pedido`;
      throw new ErroParaUsuario(
        `Este produto está em ${onde} e não pode ser excluído. Se não é mais vendido, use ` +
          `“Marcar como inativo”: sai das listas e continua nos pedidos antigos.`,
      );
    }

    await db.produto.deleteMany({ where: { id, organizacaoId } });
  } catch (erro) {
    return falhou(erro);
  }

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
async function gravarAlternarAtivoProduto(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const produto = await db.produto.findFirst({
    where: { id, organizacaoId },
    select: { ativo: true },
  });
  if (!produto) throw new ErroParaUsuario(PRODUTO_SUMIU);

  await db.produto.updateMany({
    where: { id, organizacaoId },
    data: { ativo: !produto.ativo },
  });

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${id}`);
}

/** `gravarAlternarAtivoProduto`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function alternarAtivoProduto(
  id: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAlternarAtivoProduto(id, _formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}
