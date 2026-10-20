"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { normalizarCep, normalizarDocumento, normalizarTelefone } from "@/lib/mascara";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";

import { recusaExcluirCliente } from "@/lib/recusa-exclusao";

import { contaDoProduto } from "../produtos/leitura";

export type { EstadoFormulario };

/** O cliente sumiu entre abrir a ficha e salvar — excluído em outra tela. */
const CLIENTE_SUMIU =
  "Este cliente não foi encontrado — ele pode ter sido excluído em outra tela. " +
  "Volte à lista de clientes e confira.";

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

function validarEmail(valor: string | null, campo: string): string | null {
  if (valor === null) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    throw new ErroDeCampo(
      campo,
      "Este e-mail parece incompleto. Confira se tem o @ e o final, como compras@cliente.com.br.",
    );
  }
  return valor;
}

function dadosDoFormulario(formData: FormData) {
  const apelido = lerTexto(formData.get("apelido"));
  if (!apelido) {
    throw new ErroDeCampo(
      "apelido",
      "Informe o nome curto — é como o cliente aparece nas listas, como ORION.",
    );
  }

  const razaoSocial = lerTexto(formData.get("razaoSocial"));
  if (!razaoSocial) {
    throw new ErroDeCampo(
      "razaoSocial",
      "Informe a razão social — ela sai impressa no pedido que vai para a indústria.",
    );
  }

  const uf = lerTexto(formData.get("uf"));
  if (uf && uf.length !== 2) throw new ErroDeCampo("uf", "A UF tem duas letras, como SP ou MG.");

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
    email: validarEmail(lerTexto(formData.get("email")), "email"),
    emailNfe: validarEmail(lerTexto(formData.get("emailNfe")), "emailNfe"),
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
    return falhou(erro, formData);
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

    if (!orcamento) {
      throw new ErroParaUsuario(
        "A proposta deste cadastro não foi encontrada — ela pode ter sido excluída em outra tela.",
      );
    }
    if (orcamento.clienteId) {
      throw new ErroParaUsuario(
        "Esta proposta já tem cliente cadastrado. Volte à proposta para ver qual é.",
      );
    }

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
    return falhou(erro, formData);
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

    if (count === 0) throw new ErroParaUsuario(CLIENTE_SUMIU);

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
    return falhou(erro, formData);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  // "Salvar e voltar", como no pedido: gravou, a ficha volta a ser leitura.
  redirect("/clientes");
}

export async function excluirCliente(
  id: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const recusa = recusaExcluirCliente(
      await db.pedido.count({ where: { clienteId: id, organizacaoId } }),
    );
    if (recusa) throw new ErroParaUsuario(recusa);

    const cliente = await db.cliente.findFirst({
      where: { id, organizacaoId },
      select: { apelido: true, municipio: true },
    });
    if (!cliente) throw new ErroParaUsuario(CLIENTE_SUMIU);

    /*
     * A proposta não impede: ela volta a ser de quem ainda não é cliente.
     *
     * Era a FK da proposta que barrava a exclusão, com um erro que ninguém
     * entendia — e o cliente cadastrado a partir dela, por engano ou cedo
     * demais, ficava preso. A proposta que virou pedido nem chega aqui: o
     * pedido é deste cliente e a trava acima já recusou.
     *
     * Vai em passos, sem transação (o banco com RLS não abre uma interativa),
     * e cada um pode ser repetido: o que já foi desfeito sai do filtro.
     *
     * 1. A linha que é produto deste cliente volta a ser conta, com as medidas
     *    dele — é o que deixa recadastrar o cliente e refazer os produtos com
     *    "Cadastrar todos os produtos", sem redigitar.
     */
    const itens = await db.orcamentoItem.findMany({
      where: { produto: { clienteId: id, organizacaoId } },
      select: {
        id: true,
        produto: {
          include: { aditivos: { select: { aditivoId: true } } },
        },
      },
    });
    for (const item of itens) {
      if (!item.produto) continue;
      const { aditivos, ...produto } = item.produto;
      await db.orcamentoItem.update({
        where: { id: item.id },
        data: {
          produtoId: null,
          conta: contaDoProduto({ ...produto, aditivos: aditivos.map((a) => a.aditivoId) }),
        },
      });
    }

    // 2. A proposta fica com o nome e a cidade, como quando nasceu avulsa.
    await db.orcamento.updateMany({
      where: { clienteId: id, organizacaoId },
      data: {
        clienteId: null,
        clienteAvulsoNome: cliente.apelido,
        clienteAvulsoMunicipio: cliente.municipio,
      },
    });

    // 3. Os produtos dele vão junto: o preço que eles guardam era o negociado
    //    com este cliente, e sem dono não servem a ninguém. O que por acaso
    //    estiver em pedido de outro cliente fica, sem dono (`SetNull`).
    await db.produto.deleteMany({
      where: { clienteId: id, organizacaoId, itensPedido: { none: {} } },
    });

    await db.cliente.deleteMany({ where: { id, organizacaoId } });
  } catch (erro) {
    return falhou(erro);
  }

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
async function gravarAlternarAtivoCliente(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const cliente = await db.cliente.findFirst({
    where: { id, organizacaoId },
    select: { ativo: true },
  });
  if (!cliente) throw new ErroParaUsuario(CLIENTE_SUMIU);

  await db.cliente.updateMany({
    where: { id, organizacaoId },
    data: { ativo: !cliente.ativo },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
}

/** `gravarAlternarAtivoCliente`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function alternarAtivoCliente(
  id: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAlternarAtivoCliente(id, _formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}
