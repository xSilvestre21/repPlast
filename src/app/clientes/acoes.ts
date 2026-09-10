"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dbParaOrganizacao } from "@/lib/db";
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

/** Mantém só os dígitos — CNPJ e CEP são digitados com pontuação variada. */
function somenteDigitos(valor: string | null): string | null {
  if (valor === null) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

function formatarCnpj(valor: string | null): string | null {
  const digitos = somenteDigitos(valor);
  if (digitos === null) return null;

  if (digitos.length !== 14) {
    throw new Error("O CNPJ precisa ter 14 dígitos.");
  }

  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatarCep(valor: string | null): string | null {
  const digitos = somenteDigitos(valor);
  if (digitos === null) return null;

  if (digitos.length !== 8) {
    throw new Error("O CEP precisa ter 8 dígitos.");
  }

  return digitos.replace(/^(\d{5})(\d{3})$/, "$1-$2");
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

  return {
    apelido,
    razaoSocial,
    cnpj: formatarCnpj(lerTexto(formData.get("cnpj"))),
    ie: lerTexto(formData.get("ie")),
    endereco: lerTexto(formData.get("endereco")),
    bairro: lerTexto(formData.get("bairro")),
    cep: formatarCep(lerTexto(formData.get("cep"))),
    municipio: lerTexto(formData.get("municipio")),
    uf: uf ? uf.toUpperCase() : null,
    telefone: lerTexto(formData.get("telefone")),
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
    const { organizacaoId, db } = await contexto();
    const cliente = await db.cliente.create({
      data: { organizacaoId, ...dadosDoFormulario(formData) },
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
/* Códigos do produto no cliente (coluna COD.CLI do pedido)                    */
/* -------------------------------------------------------------------------- */

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
    if (!codigo) return { erro: "Informe o código que este cliente usa." };

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
