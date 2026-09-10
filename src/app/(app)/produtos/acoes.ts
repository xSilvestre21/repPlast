"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Familia } from "@/generated/prisma/enums";
import { dbParaOrganizacao } from "@/lib/db";
import { lerNumeroBr } from "@/lib/numero-br";
import { organizacaoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

async function contexto() {
  const organizacaoId = await organizacaoAtual();
  return { organizacaoId, db: dbParaOrganizacao(organizacaoId) };
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

const FAMILIAS: Familia[] = ["SACO", "FITA", "STRETCH", "BOBINA"];

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
    descricao,
    codigoFornecedor: lerTexto(formData.get("codigoFornecedor")),
    material: lerTexto(formData.get("material")),
    complemento: lerTexto(formData.get("complemento")),
  };

  if (familia === "SACO") {
    return {
      ...comum,
      larguraCm: lerMedidaObrigatoria(formData.get("larguraCm"), "A largura"),
      comprimentoCm: lerMedidaObrigatoria(formData.get("comprimentoCm"), "O comprimento"),
      espessuraMm: lerMedidaObrigatoria(formData.get("espessuraMm"), "A espessura"),
      fatorKg: lerMedidaObrigatoria(formData.get("fatorKg"), "O fator kg"),
      sanfona: lerTexto(formData.get("sanfona")),
      // Campos das outras famílias ficam nulos.
      larguraMm: null,
      metragemM: null,
      micragem: null,
      unidadesPorCaixa: null,
      precoUnidade: null,
      precoCaixa: null,
      precoKg: null,
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
      sanfona: null,
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
    sanfona: null,
    metragemM: null,
    unidadesPorCaixa: null,
    precoUnidade: null,
    precoCaixa: null,
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
) {
  const fornecedor = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
  if (fornecedor === 0) throw new Error("Indústria não encontrada.");

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

    await validarVinculos(db, organizacaoId, dados.fornecedorId, aditivos);

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

    await validarVinculos(db, organizacaoId, dados.fornecedorId, aditivos);

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
