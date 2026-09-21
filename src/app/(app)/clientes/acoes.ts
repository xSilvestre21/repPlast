"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizarCep, normalizarDocumento, normalizarTelefone } from "@/lib/mascara";
import { escopoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

async function contexto() {
  return escopoAtual();
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

function validarEmail(valor: string | null, rotulo: string): string | null {
  if (valor === null) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    throw new Error(`${rotulo} não parece um e-mail válido.`);
  }
  return valor;
}

function dadosDoFormulario(formData: FormData) {
  const apelido = lerTexto(formData.get("apelido"));
  if (!apelido) throw new Error("O nome curto é obrigatório.");

  const razaoSocial = lerTexto(formData.get("razaoSocial"));
  if (!razaoSocial) throw new Error("A razão social é obrigatória — ela sai impressa no pedido.");

  const uf = lerTexto(formData.get("uf"));
  if (uf && uf.length !== 2) throw new Error("A UF precisa ter duas letras.");

  /*
   * Documento, CEP e telefone são normalizados aqui, e não só pela máscara do
   * campo: o formulário continua enviando por POST comum quando o JavaScript
   * não roda, e nesse caminho o texto chega como a pessoa escreveu.
   */
  const cnpj = lerTexto(formData.get("cnpj"));
  const cep = lerTexto(formData.get("cep"));
  const telefone = lerTexto(formData.get("telefone"));

  return {
    apelido,
    razaoSocial,
    cnpj: cnpj === null ? null : normalizarDocumento(cnpj),
    ie: lerTexto(formData.get("ie")),
    endereco: lerTexto(formData.get("endereco")),
    bairro: lerTexto(formData.get("bairro")),
    cep: cep === null ? null : normalizarCep(cep),
    municipio: lerTexto(formData.get("municipio")),
    uf: uf ? uf.toUpperCase() : null,
    telefone: telefone === null ? null : normalizarTelefone(telefone),
    email: validarEmail(lerTexto(formData.get("email")), "O e-mail"),
    emailNfe: validarEmail(lerTexto(formData.get("emailNfe")), "O e-mail para NF-e"),
    observacoes: lerTexto(formData.get("observacoes")),
  };
}

export async function criarCliente(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, usuarioId, ehAdmin, db } = await contexto();

    /*
     * Preposto só cadastra na própria carteira; administrador cadastra para o
     * escritório. Não é escolha de tela: o RLS recusaria de todo jeito um
     * cliente carimbado com o nome de outro preposto.
     */
    const cliente = await db.cliente.create({
      data: {
        organizacaoId,
        representanteId: ehAdmin ? null : usuarioId,
        ...dadosDoFormulario(formData),
      },
    });

    destino = `/clientes/${cliente.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/clientes");
  redirect(destino);
}

export async function atualizarCliente(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const { count } = await db.cliente.updateMany({
      where: { id, organizacaoId },
      data: dadosDoFormulario(formData),
    });

    if (count === 0) return { erro: "Cliente não encontrado." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return {};
}

export async function excluirCliente(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const pedidos = await db.pedido.count({ where: { clienteId: id, organizacaoId } });
  if (pedidos > 0) {
    throw new Error(`Este cliente tem ${pedidos} pedido(s) e não pode ser excluído.`);
  }

  await db.cliente.deleteMany({ where: { id, organizacaoId } });

  revalidatePath("/clientes");
  redirect("/clientes");
}

/* -------------------------------------------------------------------------- */
/* Produtos do cliente (e o código dele, quando houver)                        */
/* -------------------------------------------------------------------------- */

/**
 * Liga um produto a este cliente.
 *
 * O código é opcional: ele preenche a coluna COD.CLI do pedido, e nem todo
 * cliente numera o que compra. O que a linha afirma é o vínculo — é ela que faz
 * o produto aparecer na hora de lançar pedido ou proposta para ele.
 */
export async function salvarCodigoProduto(
  clienteId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const produtoId = String(formData.get("produtoId") ?? "");
    const codigo = lerTexto(formData.get("codigo"));

    if (!produtoId) return { erro: "Escolha o produto." };

    const [cliente, produto] = await Promise.all([
      db.cliente.count({ where: { id: clienteId, organizacaoId } }),
      db.produto.count({ where: { id: produtoId, organizacaoId } }),
    ]);

    if (cliente === 0 || produto === 0) return { erro: "Cliente ou produto não encontrado." };

    await db.produtoCodigoCliente.upsert({
      where: { produtoId_clienteId: { produtoId, clienteId } },
      create: { produtoId, clienteId, codigo },
      update: { codigo },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/clientes/${clienteId}`);
  return {};
}

export async function removerCodigoProduto(
  clienteId: string,
  formData: FormData,
): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const produtoId = String(formData.get("produtoId") ?? "");
  if (!produtoId) return;

  const cliente = await db.cliente.count({ where: { id: clienteId, organizacaoId } });
  if (cliente === 0) throw new Error("Cliente não encontrado.");

  await db.produtoCodigoCliente.deleteMany({ where: { produtoId, clienteId } });

  revalidatePath(`/clientes/${clienteId}`);
}
