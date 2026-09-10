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

  const unidadeMeta = formData.get("unidadeMeta") === "KG" ? "KG" : "REAIS";
  const modoFaixa = formData.get("modoFaixa") === "RETROATIVA" ? "RETROATIVA" : "PROGRESSIVA";
  const fatorKgPadrao = lerNumeroBr(formData.get("fatorKgPadrao"));

  return {
    nome,
    razaoSocial: lerTexto(formData.get("razaoSocial")),
    cnpj: lerTexto(formData.get("cnpj")),
    emailsPedido: emails,
    ipiPercentual: lerPercentual(formData.get("ipiPercentual"), "O IPI"),
    comissaoPercentual: lerPercentual(formData.get("comissaoPercentual"), "A comissão"),
    unidadeMeta,
    modoFaixa,
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
/* Faixas de comissão                                                         */
/* -------------------------------------------------------------------------- */

export async function adicionarFaixa(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const minimo = lerNumeroBr(formData.get("minimo"));
    if (minimo === null || minimo < 0) {
      return { erro: "Informe o volume mínimo da faixa." };
    }

    const percentual = lerPercentual(formData.get("percentual"), "O percentual");

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) return { erro: "Indústria não encontrada." };

    await db.faixaComissao.create({
      data: { fornecedorId, minimo: String(minimo), percentual },
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar.";
    return {
      erro: mensagem.includes("Unique constraint")
        ? "Já existe uma faixa com esse volume mínimo."
        : mensagem,
    };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerFaixa(fornecedorId: string, formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const faixaId = String(formData.get("faixaId") ?? "");
  if (!faixaId) return;

  const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
  if (pertence === 0) throw new Error("Indústria não encontrada.");

  await db.faixaComissao.deleteMany({ where: { id: faixaId, fornecedorId } });

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
