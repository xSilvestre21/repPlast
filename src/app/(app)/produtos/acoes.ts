"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Familia } from "@/generated/prisma/enums";
import { lerNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

async function contexto() {
  return escopoAtual();
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/** Lê um número opcional, recusando valores negativos. */
function lerMedida(valor: FormDataEntryValue | null, rotulo: string): string | null {
  const numero = lerNumeroBr(valor);
  if (numero === null) return null;

  if (numero < 0) throw new Error(`${rotulo} não pode ser negativo.`);
  return String(numero);
}

/** Lê um número obrigatório e maior que zero. */
function lerMedidaObrigatoria(valor: FormDataEntryValue | null, rotulo: string): string {
  const medida = lerMedida(valor, rotulo);

  if (medida === null) throw new Error(`${rotulo} é obrigatório.`);
  if (Number(medida) === 0) throw new Error(`${rotulo} precisa ser maior que zero.`);

  return medida;
}

const FAMILIAS: Familia[] = ["SACO", "FITA", "STRETCH", "BOBINA", "AVULSO"];
const UNIDADES = ["MIL", "KG", "UN", "CX"] as const;

/**
 * Monta o produto a partir do formulário.
 *
 * A validação por família é a mesma que o banco impõe por CHECK
 * (migration `rls_e_checks`) — aqui ela existe para o usuário receber uma
 * mensagem legível em vez de um erro cru do Postgres.
 */
function dadosDoFormulario(formData: FormData) {
  const familiaBruta = String(formData.get("familia") ?? "");
  const familia = FAMILIAS.find((f) => f === familiaBruta);
  if (!familia) throw new Error("Escolha a família do produto.");

  const fornecedorId = lerTexto(formData.get("fornecedorId"));
  if (!fornecedorId) throw new Error("Escolha a indústria.");

  const descricao = lerTexto(formData.get("descricao"));
  if (!descricao) throw new Error("A descrição é obrigatória.");

  const comum = {
    familia,
    fornecedorId,
    /*
     * De quem é este produto.
     *
     * Opcional porque o escritório também cadastra item de catálogo sem dono,
     * mas o caminho normal é ter um: o mesmo saco cotado para dois clientes é
     * dois produtos, com preço próprio cada um.
     */
    clienteId: lerTexto(formData.get("clienteId")),
    descricao,
    codigoFornecedor: lerTexto(formData.get("codigoFornecedor")),
    // O número que o CLIENTE usa, ao lado do número que a indústria usa. Vazio
    // é legítimo: nem todo cliente numera o que compra.
    codigoCliente: lerTexto(formData.get("codigoCliente")),
    material: lerTexto(formData.get("material")),
    complemento: lerTexto(formData.get("complemento")),
    unidadeRotulo: lerTexto(formData.get("unidadeRotulo")),
  };

  if (familia === "SACO") {
    return {
      ...comum,
      larguraCm: lerMedidaObrigatoria(formData.get("larguraCm"), "A largura"),
      comprimentoCm: lerMedidaObrigatoria(formData.get("comprimentoCm"), "O comprimento"),
      espessuraMm: lerMedidaObrigatoria(formData.get("espessuraMm"), "A espessura"),
      fatorKg: lerMedidaObrigatoria(formData.get("fatorKg"), "O fator kg"),
      // Opcional: vazia, o motor usa DENSIDADE_PADRAO — que é o divisor 10 de
      // antes, e o que mantém produto antigo valendo o mesmo.
      densidade: lerMedida(formData.get("densidade"), "A densidade"),
      sanfona: lerTexto(formData.get("sanfona")),
      // Campos das outras famílias ficam nulos.
      larguraMm: null,
      metragemM: null,
      micragem: null,
      unidadesPorCaixa: null,
      precoUnidade: null,
      precoCaixa: null,
      precoKg: null,
      unidadeAvulsa: null,
      precoAvulso: null,
    };
  }

  if (familia === "FITA") {
    const precoUnidade = lerMedida(formData.get("precoUnidade"), "O preço por unidade");
    const precoCaixa = lerMedida(formData.get("precoCaixa"), "O preço da caixa");

    if (precoUnidade === null && precoCaixa === null) {
      throw new Error("Informe o preço por unidade, o preço da caixa, ou os dois.");
    }

    const unidades = lerMedida(formData.get("unidadesPorCaixa"), "As unidades por caixa");

    return {
      ...comum,
      larguraMm: lerMedida(formData.get("larguraMm"), "A largura"),
      metragemM: lerMedida(formData.get("metragemM"), "A metragem"),
      micragem: lerMedida(formData.get("micragem"), "A micragem"),
      unidadesPorCaixa: unidades === null ? null : Math.round(Number(unidades)),
      precoUnidade,
      precoCaixa,
      larguraCm: null,
      comprimentoCm: null,
      espessuraMm: null,
      fatorKg: null,
      densidade: null,
      sanfona: null,
      precoKg: null,
      unidadeAvulsa: null,
      precoAvulso: null,
    };
  }

  if (familia === "AVULSO") {
    const bruta = String(formData.get("unidadeAvulsa") ?? "");
    const unidadeAvulsa = UNIDADES.find((u) => u === bruta);
    if (!unidadeAvulsa) throw new Error("Escolha a unidade de venda.");

    return {
      ...comum,
      unidadeAvulsa,
      precoAvulso: lerMedidaObrigatoria(formData.get("precoAvulso"), "O preço"),
      larguraMm: lerMedida(formData.get("larguraMm"), "A largura"),
      larguraCm: null,
      comprimentoCm: null,
      espessuraMm: null,
      fatorKg: null,
      densidade: null,
      sanfona: null,
      metragemM: null,
      micragem: null,
      unidadesPorCaixa: null,
      precoUnidade: null,
      precoCaixa: null,
      precoKg: null,
    };
  }

  // STRETCH e BOBINA: vendidos por quilo, sem cálculo dimensional.
  return {
    ...comum,
    precoKg: lerMedidaObrigatoria(formData.get("precoKg"), "O preço por quilo"),
    larguraMm: lerMedida(formData.get("larguraMm"), "A largura"),
    micragem: lerMedida(formData.get("micragem"), "A micragem"),
    larguraCm: null,
    comprimentoCm: null,
    espessuraMm: null,
    fatorKg: null,
    densidade: null,
    sanfona: null,
    metragemM: null,
    unidadesPorCaixa: null,
    precoUnidade: null,
    precoCaixa: null,
    unidadeAvulsa: null,
    precoAvulso: null,
  };
}

function lerAditivos(formData: FormData): string[] {
  return formData.getAll("aditivos").map(String).filter(Boolean);
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
  return {};
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
