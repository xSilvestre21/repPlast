"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dbParaOrganizacao } from "@/lib/db";
import { lerNumeroBr } from "@/lib/numero-br";
import { organizacaoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

async function contexto() {
  const organizacaoId = await organizacaoAtual();
  return { organizacaoId, db: dbParaOrganizacao(organizacaoId) };
}

/** Lê um percentual do formulário, exigindo que fique entre 0 e 100. */
function lerPercentual(valor: FormDataEntryValue | null, rotulo: string): number {
  const numero = lerNumeroBr(valor) ?? 0;

  if (numero < 0 || numero > 100) {
    throw new Error(`${rotulo} precisa ficar entre 0 e 100.`);
  }
  return numero;
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

function lerEmails(valor: FormDataEntryValue | null): string[] {
  const texto = typeof valor === "string" ? valor : "";

  return texto
    .split(/[,;\n]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function dadosDoFormulario(formData: FormData) {
  const nome = lerTexto(formData.get("nome"));
  if (!nome) throw new Error("O nome da indústria é obrigatório.");

  const emails = lerEmails(formData.get("emailsPedido"));
  const invalido = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (invalido) throw new Error(`E-mail inválido: ${invalido}`);

  const fatorKgPadrao = lerNumeroBr(formData.get("fatorKgPadrao"));

  return {
    nome,
    razaoSocial: lerTexto(formData.get("razaoSocial")),
    cnpj: lerTexto(formData.get("cnpj")),
    emailsPedido: emails,
    ipiPercentual: lerPercentual(formData.get("ipiPercentual"), "O IPI"),
    comissaoPercentual: lerPercentual(formData.get("comissaoPercentual"), "A comissão"),
    fatorKgPadrao: fatorKgPadrao === null ? null : String(fatorKgPadrao),
  } as const;
}

export async function criarFornecedor(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, db } = await contexto();
    const dados = dadosDoFormulario(formData);

    const fornecedor = await db.fornecedor.create({ data: { organizacaoId, ...dados } });
    destino = `/fornecedores/${fornecedor.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/fornecedores");
  redirect(destino);
}

export async function atualizarFornecedor(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    const dados = dadosDoFormulario(formData);

    // Filtro explícito de tenant, mesmo com RLS ativo — ver src/lib/db.ts.
    const { count } = await db.fornecedor.updateMany({
      where: { id, organizacaoId },
      data: dados,
    });

    if (count === 0) return { erro: "Indústria não encontrada." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${id}`);
  return {};
}

export async function excluirFornecedor(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const emUso = await db.produto.count({ where: { fornecedorId: id, organizacaoId } });
  if (emUso > 0) {
    throw new Error(
      `Esta indústria tem ${emUso} produto(s) cadastrado(s) e não pode ser excluída.`,
    );
  }

  await db.fornecedor.deleteMany({ where: { id, organizacaoId } });

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

/* -------------------------------------------------------------------------- */
/* Logo da indústria                                                          */
/* -------------------------------------------------------------------------- */

const LIMITE_LOGO = 2 * 1024 * 1024;

/**
 * Descobre o tipo da imagem pelos BYTES, e não pelo que o navegador declarou.
 *
 * O arquivo volta a ser servido pela rota `/fornecedores/[id]/logo`, então
 * confiar no `type` enviado pelo cliente seria deixar alguém escolher o
 * Content-Type de uma resposta nossa. Também é o que impede subir um SVG (que
 * pode conter script) travestido de PNG.
 */
function detectarTipoImagem(bytes: Uint8Array): string | null {
  const comeca = (...assinatura: number[]) =>
    assinatura.every((valor, indice) => bytes[indice] === valor);

  if (comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (comeca(0xff, 0xd8, 0xff)) return "image/jpeg";

  // WebP: "RIFF" .... "WEBP"
  if (comeca(0x52, 0x49, 0x46, 0x46)) {
    const marca = String.fromCharCode(...bytes.slice(8, 12));
    if (marca === "WEBP") return "image/webp";
  }

  return null;
}

export async function salvarLogo(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const arquivo = formData.get("logo");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { erro: "Escolha um arquivo de imagem." };
    }

    if (arquivo.size > LIMITE_LOGO) {
      return { erro: "A imagem passa de 2 MB. Reduza antes de enviar." };
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const tipo = detectarTipoImagem(bytes);

    if (!tipo) {
      return { erro: "Formato não reconhecido. Envie PNG, JPEG ou WebP." };
    }

    const { count } = await db.fornecedor.updateMany({
      where: { id: fornecedorId, organizacaoId },
      data: { logo: bytes, logoTipo: tipo },
    });

    if (count === 0) return { erro: "Indústria não encontrada." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível enviar o logo." };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerLogo(fornecedorId: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  await db.fornecedor.updateMany({
    where: { id: fornecedorId, organizacaoId },
    data: { logo: null, logoTipo: null },
  });

  revalidatePath(`/fornecedores/${fornecedorId}`);
}

/* -------------------------------------------------------------------------- */
/* Aditivos                                                                   */
/* -------------------------------------------------------------------------- */

export async function adicionarAditivo(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const nome = lerTexto(formData.get("nome"));
    if (!nome) return { erro: "Informe o nome do aditivo." };

    const sufixoDescricao = lerTexto(formData.get("sufixoDescricao"));
    if (!sufixoDescricao) return { erro: "Informe o sufixo que aparece na descrição." };

    const valor = lerNumeroBr(formData.get("valor"));
    if (valor === null || valor < 0) return { erro: "Informe o valor somado pelo aditivo." };

    const tipo = formData.get("tipo") === "POR_MILHEIRO" ? "POR_MILHEIRO" : "POR_KG";

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) return { erro: "Indústria não encontrada." };

    await db.aditivo.create({
      data: { fornecedorId, nome, sufixoDescricao, tipo, valor: String(valor) },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerAditivo(fornecedorId: string, formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const aditivoId = String(formData.get("aditivoId") ?? "");
  if (!aditivoId) return;

  const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
  if (pertence === 0) throw new Error("Indústria não encontrada.");

  const emUso = await db.produtoAditivo.count({ where: { aditivoId } });
  if (emUso > 0) {
    throw new Error(`Este aditivo está em ${emUso} produto(s) e não pode ser excluído.`);
  }

  await db.aditivo.deleteMany({ where: { id: aditivoId, fornecedorId } });

  revalidatePath(`/fornecedores/${fornecedorId}`);
}
