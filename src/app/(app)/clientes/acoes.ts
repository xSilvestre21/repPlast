"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizarCep, normalizarDocumento, normalizarTelefone } from "@/lib/mascara";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

/**
 * Cadastro de cliente é do administrador: o preposto consulta os clientes que
 * atende, mas não cria, altera nem exclui. O banco recusa de todo jeito
 * (migration `cadastros_so_do_admin`); a checagem aqui é para a mensagem ser
 * legível em vez de um erro do RLS.
 */
async function contexto() {
  await exigirAdmin();
  return escopoAtual();
}

/**
 * Os prepostos marcados no formulário — só o administrador marca.
 *
 * Devolve `undefined` quando a lista não veio (preposto, ou escritório sem
 * plano Plus): aí a edição não mexe em quem atende. Id que não é de preposto
 * deste escritório é descartado; o RLS recusaria o vínculo de todo jeito.
 */
async function prepostosMarcados(
  formData: FormData,
  { ehAdmin, organizacaoId, db }: Awaited<ReturnType<typeof contexto>>,
): Promise<string[] | undefined> {
  if (!ehAdmin || !formData.has("prepostosNoFormulario")) return undefined;

  const marcados = formData.getAll("prepostoId").map(String);
  if (marcados.length === 0) return [];

  const validos = await db.usuario.findMany({
    where: { id: { in: marcados }, organizacaoId, papel: "REPRESENTANTE" },
    select: { id: true },
  });
  return validos.map((u) => u.id);
}

/** Cadastra o cliente e grava quem o atende — os marcados, ou o padrão. */
async function cadastrar(
  escopo: Awaited<ReturnType<typeof contexto>>,
  formData: FormData,
  padrao: string[] = [],
): Promise<string> {
  const { organizacaoId, usuarioId, db } = escopo;
  const id = randomUUID();

  await db.cliente.createMany({
    data: [{ id, organizacaoId, criadoPorId: usuarioId, ...dadosDoFormulario(formData) }],
  });

  const prepostos = (await prepostosMarcados(formData, escopo)) ?? padrao;
  if (prepostos.length > 0) {
    await db.clientePreposto.createMany({
      data: prepostos.map((usuarioId) => ({ clienteId: id, usuarioId })),
    });
  }

  return id;
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
    prazoPagamento: lerTexto(formData.get("prazoPagamento")),
    observacoes: lerTexto(formData.get("observacoes")),
  };
}

export async function criarCliente(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    destino = `/clientes/${await cadastrar(await contexto(), formData)}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/clientes");
  redirect(destino);
}

/**
 * Cadastra o destinatário de uma proposta avulsa e liga a proposta a ele.
 *
 * É o cadastro COMPLETO, o mesmo de Clientes — razão social, CNPJ, endereço —,
 * porque é daqui que a proposta caminha para virar pedido, e o pedido leva
 * esses dados à indústria. A tela chega preenchida com o que a proposta sabia
 * e, ao salvar, volta para ela.
 */
export async function criarClienteDaProposta(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const escopo = await contexto();
    const { organizacaoId, db } = escopo;

    const orcamento = await db.orcamento.findFirst({
      where: { id: orcamentoId, organizacaoId },
      select: { clienteId: true, representanteId: true },
    });

    if (!orcamento) return { erro: "Orçamento não encontrado." };
    if (orcamento.clienteId) return { erro: "Esta proposta já tem cliente cadastrado." };

    // Sem lista no formulário, o cliente fica com o preposto da proposta —
    // senão ele perderia de vista o cliente que ele mesmo cotou.
    const clienteId = await cadastrar(
      escopo,
      formData,
      orcamento.representanteId ? [orcamento.representanteId] : [],
    );

    // A proposta continua de quem já era: é dele a comissão se virar pedido.
    await db.orcamento.updateMany({
      where: { id: orcamentoId, organizacaoId },
      data: { clienteId, clienteAvulsoNome: null, clienteAvulsoMunicipio: null },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/clientes");
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${orcamentoId}`);
}

export async function atualizarCliente(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const escopo = await contexto();
    const { organizacaoId, db } = escopo;

    const { count } = await db.cliente.updateMany({
      where: { id, organizacaoId },
      data: dadosDoFormulario(formData),
    });

    if (count === 0) return { erro: "Cliente não encontrado." };

    // Trocar quem atende não reescreve o passado: cada pedido guardou o
    // preposto com quem foi dividido (`Pedido.representanteId`).
    const prepostos = await prepostosMarcados(formData, escopo);
    if (prepostos !== undefined) {
      await db.clientePreposto.deleteMany({ where: { clienteId: id } });
      if (prepostos.length > 0) {
        await db.clientePreposto.createMany({
          data: prepostos.map((usuarioId) => ({ clienteId: id, usuarioId })),
        });
      }
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  // "Salvar e voltar", como no pedido: gravou, a ficha volta a ser leitura.
  redirect("/clientes");
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

/**
 * Liga e desliga o cliente.
 *
 * Inativar, e não apagar: cliente que parou de comprar continua em pedidos,
 * propostas e comissões de meses fechados. Inativo, ele sai das escolhas de
 * novo pedido e de nova proposta (que já filtram `ativo`) e da lista padrão —
 * e volta com um clique, quando voltar a comprar.
 */
export async function alternarAtivoCliente(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const cliente = await db.cliente.findFirst({
    where: { id, organizacaoId },
    select: { ativo: true },
  });
  if (!cliente) throw new Error("Cliente não encontrado.");

  await db.cliente.updateMany({
    where: { id, organizacaoId },
    data: { ativo: !cliente.ativo },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}
