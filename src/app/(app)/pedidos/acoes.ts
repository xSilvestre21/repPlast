"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { StatusPedido } from "@/generated/prisma/enums";
import { type DbOrganizacao } from "@/lib/db";
import { enviarEmail } from "@/lib/email";
import { lerNumeroBr } from "@/lib/numero-br";
import { carregarPedidoParaPdf, gerarPdfPedido } from "@/lib/pdf/gerar-pedido";
import { arredondarDinheiro } from "@/lib/precificacao";
import {
  paraPrecificavel,
  type UnidadeVenda,
  pesoDoItem,
  precoUnitario,
} from "@/lib/produto-preco";
import { escopoAtual } from "@/lib/sessao";
import { calcularTotaisPedido } from "@/lib/totais";

export type EstadoFormulario = { erro?: string };

async function contexto() {
  return escopoAtual();
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/**
 * A trava do pedido enviado vive AQUI, no servidor.
 *
 * Esconder o botão na tela não é proteção: o pedido enviado já foi para a
 * indústria, e alterá-lo depois faria o sistema divergir do papel que ela
 * recebeu — e da comissão já apurada em cima dele.
 */
async function exigirAberto(db: DbOrganizacao, pedidoId: string, organizacaoId: string) {
  const pedido = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    select: { id: true, status: true, fornecedorId: true, clienteId: true },
  });

  if (!pedido) throw new Error("Pedido não encontrado.");

  if (pedido.status !== "ABERTO") {
    throw new Error(
      pedido.status === "ENVIADO"
        ? "Este pedido já foi enviado. Desmarque o envio para poder editar."
        : "Este pedido está cancelado e não pode ser alterado.",
    );
  }

  return pedido;
}

/* -------------------------------------------------------------------------- */
/* Totais                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Recalcula e grava os totais do pedido a partir dos itens.
 *
 * Roda depois de toda alteração de item. O arredondamento segue a regra
 * extraída dos pedidos reais: o total do item multiplica o preço unitário sem
 * arredondar (ver `lib/totais.ts`).
 */
async function recalcularTotais(db: DbOrganizacao, pedidoId: string) {
  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    select: { ipiPercentual: true },
  });

  if (!pedido) return;

  const itens = await db.pedidoItem.findMany({
    where: { pedidoId },
    orderBy: { ordem: "asc" },
    select: { id: true, quantidade: true, precoUnitario: true, pesoKg: true, comIpi: true },
  });

  const totais = calcularTotaisPedido(
    itens.map((i) => ({
      precoUnitario: i.precoUnitario.toString(),
      quantidade: i.quantidade.toString(),
      comIpi: i.comIpi,
    })),
    pedido.ipiPercentual.toString(),
  );

  // Grava os totais por item para que o PDF não precise recalcular nada.
  for (const [indice, item] of itens.entries()) {
    const calculado = totais.itens[indice];

    await db.pedidoItem.update({
      where: { id: item.id },
      data: {
        totalSemIpi: calculado.total.toString(),
        valorIpi: calculado.ipi.toString(),
        total: calculado.totalComIpi.toString(),
      },
    });
  }

  const pesoTotal = itens.reduce((acc, i) => acc + Number(i.pesoKg), 0);

  await db.pedido.update({
    where: { id: pedidoId },
    data: {
      subtotalSemIpi: totais.subtotalSemIpi.toString(),
      valorIpi: totais.ipi.toString(),
      totalGeral: totais.totalGeral.toString(),
      pesoTotalKg: arredondarDinheiro(pesoTotal).toString(),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Ciclo de vida                                                              */
/* -------------------------------------------------------------------------- */

export async function criarPedido(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, db } = await contexto();

    const clienteId = lerTexto(formData.get("clienteId"));
    const fornecedorId = lerTexto(formData.get("fornecedorId"));

    if (!clienteId) return { erro: "Escolha o cliente." };
    if (!fornecedorId) return { erro: "Escolha a indústria." };

    const [cliente, fornecedor] = await Promise.all([
      db.cliente.findFirst({
        where: { id: clienteId, organizacaoId },
        select: {
          id: true,
          observacoes: true,
          representanteId: true,
          representante: { select: { comissaoPercentualPadrao: true } },
        },
      }),
      db.fornecedor.findFirst({
        where: { id: fornecedorId, organizacaoId },
        select: { id: true, ipiPercentual: true, comissaoPercentual: true },
      }),
    ]);

    if (!cliente || !fornecedor) return { erro: "Cliente ou indústria não encontrado." };

    // Numeração sequencial POR FORNECEDOR. O `increment` do Prisma vira um
    // UPDATE ... RETURNING atômico, então dois pedidos simultâneos nunca pegam
    // o mesmo número.
    //
    // Se a criação abaixo falhar, o número é queimado — e continua assim de
    // propósito: uma lacuna é preferível a um número repetido, que chegaria à
    // indústria identificando dois pedidos diferentes. O caso que importava,
    // o do pedido lançado por engano, se resolve ao apagar: `excluirPedido`
    // devolve o número ao contador quando era o último emitido.
    const contador = await db.fornecedor.update({
      where: { id: fornecedorId },
      data: { proximoNumeroPedido: { increment: 1 } },
      select: { proximoNumeroPedido: true },
    });

    const pedido = await db.pedido.create({
      data: {
        organizacaoId,
        clienteId,
        fornecedorId,
        numero: contador.proximoNumeroPedido - 1,
        // O IPI é congelado aqui: um reajuste no cadastro do fornecedor não
        // pode mudar o valor de um pedido já lançado.
        ipiPercentual: fornecedor.ipiPercentual,
        // A comissão também é congelada: o pedido nasce com o percentual da
        // indústria, pode ser ajustado enquanto estiver aberto, e a partir do
        // envio vira o número definitivo daquele pedido. É isso que mantém a
        // comissão de um mês fechado estável quando a indústria reajusta.
        comissaoPercentual: fornecedor.comissaoPercentual,
        // As observações do cliente já entram preenchidas — são recados que se
        // repetem em todo pedido dele.
        observacoes: cliente.observacoes,
        // O pedido credita o dono da CARTEIRA, não quem digitou: a
        // administradora lança pedido para o cliente do preposto o tempo todo,
        // e a comissão continua sendo dele. Congelado aqui — reatribuir a
        // carteira depois não reescreve o que já foi vendido.
        representanteId: cliente.representanteId,
        // A fatia dele também é congelada. Cliente sem dono é do escritório, e
        // aí não há fatia nenhuma: a comissão inteira fica na casa.
        comissaoPercentualPreposto: cliente.representante?.comissaoPercentualPadrao ?? null,
      },
      select: { id: true },
    });

    destino = `/pedidos/${pedido.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível criar o pedido." };
  }

  revalidatePath("/pedidos");
  redirect(destino);
}

export async function atualizarCabecalho(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    await exigirAberto(db, pedidoId, organizacaoId);

    const comissao = lerNumeroBr(formData.get("comissaoPercentual"));
    if (comissao !== null && (comissao < 0 || comissao > 100)) {
      return { erro: "A comissão precisa ficar entre 0 e 100." };
    }

    const ipi = lerNumeroBr(formData.get("ipiPercentual"));
    if (ipi !== null && (ipi < 0 || ipi > 100)) {
      return { erro: "O IPI precisa ficar entre 0 e 100." };
    }

    const prazoEntrega = lerTexto(formData.get("prazoEntrega"));
    const frete = formData.get("tipoFrete");

    await db.pedido.update({
      where: { id: pedidoId },
      data: {
        pedidoDoCliente: lerTexto(formData.get("pedidoDoCliente")),
        prazoPagamento: lerTexto(formData.get("prazoPagamento")),
        prazoEntrega: prazoEntrega ? new Date(`${prazoEntrega}T12:00:00`) : null,
        tipoFrete: frete === "CIF" || frete === "FOB" ? frete : null,
        transportadora: lerTexto(formData.get("transportadora")),
        observacoes: lerTexto(formData.get("observacoes")),
        vendedor: lerTexto(formData.get("vendedor")),
        ipiPercentual: ipi === null ? undefined : String(ipi),
        comissaoPercentual: comissao === null ? null : String(comissao),
      },
    });

    // O IPI mudou de valor ou foi desligado: os totais precisam refletir isso.
    await recalcularTotais(db, pedidoId);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

/* -------------------------------------------------------------------------- */
/* Itens                                                                      */
/* -------------------------------------------------------------------------- */

export async function adicionarItem(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    const pedido = await exigirAberto(db, pedidoId, organizacaoId);

    const produtoId = lerTexto(formData.get("produtoId"));
    if (!produtoId) return { erro: "Escolha o produto." };

    const quantidade = lerNumeroBr(formData.get("quantidade"));
    if (quantidade === null || quantidade <= 0) return { erro: "Informe a quantidade." };

    const produto = await db.produto.findFirst({
      where: { id: produtoId, organizacaoId },
      include: { aditivos: { include: { aditivo: true } } },
    });

    if (!produto) return { erro: "Produto não encontrado." };

    // Um pedido pertence a uma única indústria: é ela que fatura e é dela a
    // comissão. Misturar produtos de outra quebraria as duas coisas.
    if (produto.fornecedorId !== pedido.fornecedorId) {
      return { erro: "Este produto é de outra indústria. Abra um pedido separado para ela." };
    }

    const unidade = String(formData.get("unidade") ?? "") as UnidadeVenda;
    const precificavel = paraPrecificavel(produto);

    /*
     * Sem o formulário opinar, o item novo acompanha as linhas que já estão lá.
     *
     * Num pedido inteiramente isento — que agora é o jeito de dizer "pedido sem
     * IPI" — a linha nova nascer tributada obrigaria a desmarcar toda vez. Com
     * o pedido vazio ou misto, o padrão é tributado, que é o caso comum.
     *
     * Quem decide se o formulário opinou é `comIpiItemDefinido`, um campo
     * escondido, e NÃO a presença do checkbox: caixa desmarcada simplesmente
     * não é enviada, então "ausente" seria indistinguível de "desmarcada" — e
     * desmarcar nunca funcionaria.
     */
    const tributados = await db.pedidoItem.count({ where: { pedidoId, comIpi: true } });
    const existentes = await db.pedidoItem.count({ where: { pedidoId } });
    const heranca = existentes === 0 || tributados > 0;

    const comIpiItem = formData.has("comIpiItemDefinido")
      ? formData.get("comIpiItem") === "on"
      : heranca;

    const precoInformado = lerNumeroBr(formData.get("precoUnitario"));
    const precoCalculado = precoUnitario(precificavel, unidade);

    if (precoInformado === null && precoCalculado === null) {
      return { erro: "Este produto não tem preço para a unidade escolhida." };
    }
    if (precoInformado !== null && precoInformado < 0) {
      return { erro: "O preço não pode ser negativo." };
    }

    const preco = precoInformado !== null ? String(precoInformado) : precoCalculado!.toString();

    // O COD.CLI do PDF: o código que ESTE cliente usa para ESTE produto.
    // Copiado para o item porque é o que sai impresso — se o cadastro mudar
    // depois, o pedido enviado continua dizendo o que dizia.
    const codigoCliente = await db.produtoCodigoCliente.findUnique({
      where: { produtoId_clienteId: { produtoId, clienteId: pedido.clienteId } },
      select: { codigo: true },
    });

    const ultimo = await db.pedidoItem.findFirst({
      where: { pedidoId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });

    await db.pedidoItem.create({
      data: {
        pedidoId,
        produtoId,
        ordem: (ultimo?.ordem ?? 0) + 1,
        familia: produto.familia,
        // Congelados: o pedido tem que continuar dizendo o que dizia no dia em
        // que foi enviado, mesmo que o cadastro mude depois.
        descricao: produto.descricao,
        codigoFornecedor: produto.codigoFornecedor,
        codigoCliente: codigoCliente?.codigo ?? null,
        unidade,
        quantidade: String(quantidade),
        comIpi: comIpiItem,
        precoUnitario: preco,
        pesoKg: pesoDoItem(precificavel, unidade, quantidade).toDecimalPlaces(3).toString(),
        totalSemIpi: "0",
        valorIpi: "0",
        total: "0",
      },
    });

    await recalcularTotais(db, pedidoId);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível adicionar." };
  }

  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

export async function atualizarItem(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    await exigirAberto(db, pedidoId, organizacaoId);

    const itemId = String(formData.get("itemId") ?? "");
    const quantidade = lerNumeroBr(formData.get("quantidade"));
    const preco = lerNumeroBr(formData.get("precoUnitario"));

    if (!itemId) return { erro: "Item não informado." };
    if (quantidade === null || quantidade <= 0) return { erro: "Informe a quantidade." };
    if (preco === null || preco < 0) return { erro: "Informe o preço." };

    const item = await db.pedidoItem.findFirst({
      where: { id: itemId, pedidoId },
      include: { produto: { include: { aditivos: { include: { aditivo: true } } } } },
    });

    if (!item) return { erro: "Item não encontrado." };

    const peso = item.produto
      ? pesoDoItem(paraPrecificavel(item.produto), item.unidade as UnidadeVenda, quantidade)
      : null;

    await db.pedidoItem.update({
      where: { id: itemId },
      data: {
        quantidade: String(quantidade),
        precoUnitario: String(preco),
        // Mesma leitura da adição: sem o campo marcador, o formulário não
        // opinou sobre IPI e o valor do item fica como está. É o que mantém a
        // isenção quando a linha é salva por uma tela que não mostra a caixa.
        ...(formData.has("comIpiItemDefinido")
          ? { comIpi: formData.get("comIpiItem") === "on" }
          : {}),
        ...(peso ? { pesoKg: peso.toDecimalPlaces(3).toString() } : {}),
      },
    });

    await recalcularTotais(db, pedidoId);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

/**
 * Liga ou desliga o IPI de TODAS as linhas de uma vez.
 *
 * Existe porque um pedido inteiramente isento deixou de ter interruptor
 * próprio: ele agora é um pedido com todas as linhas desmarcadas. Sem este
 * atalho, isentar um pedido de doze itens seriam doze cliques.
 */
export async function definirIpiDeTodosOsItens(
  pedidoId: string,
  formData: FormData,
): Promise<void> {
  const { organizacaoId, db } = await contexto();
  await exigirAberto(db, pedidoId, organizacaoId);

  const ligado = formData.get("ligado") === "1";

  await db.pedidoItem.updateMany({ where: { pedidoId }, data: { comIpi: ligado } });
  await recalcularTotais(db, pedidoId);

  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function removerItem(pedidoId: string, formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();
  await exigirAberto(db, pedidoId, organizacaoId);

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await db.pedidoItem.deleteMany({ where: { id: itemId, pedidoId } });
  await recalcularTotais(db, pedidoId);

  revalidatePath(`/pedidos/${pedidoId}`);
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

async function mudarStatus(pedidoId: string, status: StatusPedido, exigido: StatusPedido[]) {
  const { organizacaoId, db } = await contexto();

  const pedido = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    select: {
      status: true,
      fornecedorId: true,
      enviadoEm: true,
      _count: { select: { itens: true } },
    },
  });

  if (!pedido) throw new Error("Pedido não encontrado.");
  if (!exigido.includes(pedido.status)) {
    throw new Error("O pedido não está no estado necessário para esta ação.");
  }

  if (status === "ENVIADO" && pedido._count.itens === 0) {
    throw new Error("Não dá para enviar um pedido sem itens.");
  }

  const enviadoEm =
    status === "ENVIADO" ? new Date() : status === "ABERTO" ? null : pedido.enviadoEm;

  await db.pedido.update({
    where: { id: pedidoId },
    data: {
      status,
      enviadoEm: status === "CANCELADO" ? undefined : enviadoEm,
      canceladoEm: status === "CANCELADO" ? new Date() : null,
    },
  });


  revalidatePath("/pedidos");
  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
}

/** Marcar como enviado é o gatilho da comissão — e trava o pedido. */
export async function marcarEnviado(pedidoId: string, _formData: FormData): Promise<void> {
  await mudarStatus(pedidoId, "ENVIADO", ["ABERTO"]);
}

export async function desmarcarEnvio(pedidoId: string, _formData: FormData): Promise<void> {
  await mudarStatus(pedidoId, "ABERTO", ["ENVIADO"]);
}

/** Cancelar estorna a comissão; o pedido continua existindo, com rastro. */
export async function cancelarPedido(pedidoId: string, _formData: FormData): Promise<void> {
  await mudarStatus(pedidoId, "CANCELADO", ["ABERTO", "ENVIADO"]);
}

export async function reabrirPedido(pedidoId: string, _formData: FormData): Promise<void> {
  await mudarStatus(pedidoId, "ABERTO", ["CANCELADO"]);
}

/* -------------------------------------------------------------------------- */
/* Envio por e-mail                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Manda o PDF para a indústria e marca o pedido como enviado.
 *
 * As duas coisas andam juntas de propósito: o envio é o gatilho da comissão, e
 * um pedido que chegou à indústria mas ficou "aberto" no sistema seria uma
 * mentira no controle do mês.
 *
 * O e-mail vai primeiro. Se falhar, nada é marcado — melhor o usuário tentar de
 * novo do que acreditar que enviou.
 */
export async function enviarPedidoPorEmail(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, usuarioId, papel, db } = await contexto();
    const pedido = await carregarPedidoParaPdf(pedidoId, organizacaoId, { usuarioId, papel });

    if (!pedido) return { erro: "Pedido não encontrado." };
    if (pedido.status === "CANCELADO") return { erro: "Este pedido está cancelado." };
    if (pedido.dados.itens.length === 0) return { erro: "Não dá para enviar um pedido sem itens." };

    if (pedido.emailsFornecedor.length === 0) {
      return {
        erro: "Esta indústria não tem e-mail cadastrado. Preencha no cadastro dela.",
      };
    }

    const arquivo = await gerarPdfPedido(pedido.dados);

    const resultado = await enviarEmail({
      para: pedido.emailsFornecedor,
      assunto: `Pedido nº ${pedido.dados.numero} — ${pedido.dados.cliente.razaoSocial}`,
      texto: [
        `Segue em anexo o pedido nº ${pedido.dados.numero}.`,
        "",
        `Cliente: ${pedido.dados.cliente.razaoSocial}`,
        pedido.dados.cliente.cnpj ? `CNPJ: ${pedido.dados.cliente.cnpj}` : null,
        pedido.dados.pedidoDoCliente ? `Pedido do cliente: ${pedido.dados.pedidoDoCliente}` : null,
        "",
        pedido.dados.vendedor ?? "",
      ]
        .filter((linha) => linha !== null)
        .join("\n"),
      anexos: [{ nome: pedido.nomeArquivo, conteudo: arquivo }],
    });

    if (!resultado.enviado) return { erro: resultado.motivo };

    if (pedido.status === "ABERTO") {
      const enviadoEm = new Date();

      // Enviar é o gatilho da comissão. Não há nada a recalcular além disto:
      // o percentual já está congelado no pedido, e a apuração do mês é
      // derivada dos pedidos enviados na hora de exibir.
      await db.pedido.update({
        where: { id: pedidoId },
        data: { status: "ENVIADO", enviadoEm, canceladoEm: null },
      });
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível enviar." };
  }

  revalidatePath("/pedidos");
  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

/* -------------------------------------------------------------------------- */
/* Duplicar e excluir                                                         */
/* -------------------------------------------------------------------------- */

/** Atalho de recompra: copia o pedido inteiro como um novo, aberto. */
export async function duplicarPedido(pedidoId: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const origem = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    include: { itens: { orderBy: { ordem: "asc" } } },
  });

  if (!origem) throw new Error("Pedido não encontrado.");

  const contador = await db.fornecedor.update({
    where: { id: origem.fornecedorId },
    data: { proximoNumeroPedido: { increment: 1 } },
    select: { proximoNumeroPedido: true },
  });

  const novo = await db.pedido.create({
    data: {
      organizacaoId,
      clienteId: origem.clienteId,
      fornecedorId: origem.fornecedorId,
      numero: contador.proximoNumeroPedido - 1,
      prazoPagamento: origem.prazoPagamento,
      tipoFrete: origem.tipoFrete,
      transportadora: origem.transportadora,
      observacoes: origem.observacoes,
      vendedor: origem.vendedor,
      ipiPercentual: origem.ipiPercentual,
      comissaoPercentual: origem.comissaoPercentual,
      // Não copiamos: número da ordem de compra do cliente e prazo de entrega,
      // que são desta compra e não da próxima.
      itens: {
        create: origem.itens.map((item) => ({
          produtoId: item.produtoId,
          ordem: item.ordem,
          familia: item.familia,
          descricao: item.descricao,
          codigoFornecedor: item.codigoFornecedor,
          codigoCliente: item.codigoCliente,
          unidade: item.unidade,
          quantidade: item.quantidade,
          // A isenção é do ITEM, então acompanha a cópia. Sem esta linha o
          // pedido duplicado voltaria a tributar a linha que era isenta, e o
          // erro só apareceria no total.
          comIpi: item.comIpi,
          precoUnitario: item.precoUnitario,
          pesoKg: item.pesoKg,
          totalSemIpi: item.totalSemIpi,
          valorIpi: item.valorIpi,
          total: item.total,
        })),
      },
    },
    select: { id: true },
  });

  await recalcularTotais(db, novo.id);

  revalidatePath("/pedidos");
  redirect(`/pedidos/${novo.id}`);
}

/**
 * Excluir é diferente de cancelar: apaga o registro.
 *
 * Só vale para pedido nunca enviado — o que já foi para a indústria deve ser
 * cancelado, para o histórico e o estorno da comissão ficarem rastreáveis.
 */
export async function excluirPedido(pedidoId: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const pedido = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    select: { enviadoEm: true, numero: true, fornecedorId: true },
  });

  if (!pedido) throw new Error("Pedido não encontrado.");

  if (pedido.enviadoEm) {
    throw new Error("Este pedido já foi enviado à indústria. Cancele em vez de excluir.");
  }

  await db.pedido.deleteMany({ where: { id: pedidoId, organizacaoId } });

  /*
   * O número volta para o contador quando era o ÚLTIMO emitido.
   *
   * A indústria confere a numeração dela, e um pedido lançado por engano não
   * pode queimar um número. Como só se apaga pedido nunca enviado (a guarda
   * acima), o número devolvido jamais chegou a sair daqui.
   *
   * A condição `proximoNumeroPedido: numero + 1` é o que torna isto seguro sem
   * transação: ela só acerta se o contador ainda estiver exatamente uma casa à
   * frente deste pedido. Se alguém criou outro pedido nesse meio-tempo, o
   * contador já andou, a condição não casa e nada é decrementado — porque
   * decrementar ali entregaria um número repetido ao próximo pedido.
   *
   * Apagar um pedido do MEIO não fecha o buraco de propósito: reaproveitar um
   * número vago faria o pedido de hoje sair com número menor que o de ontem, e
   * a numeração deixaria de dizer o que veio antes.
   *
   * A ordem também é deliberada: apaga primeiro, devolve depois. Ao contrário,
   * uma falha no apagar deixaria o contador atrás de um pedido que continua
   * existindo — e o próximo colidiria com ele.
   */
  await db.fornecedor.updateMany({
    where: {
      id: pedido.fornecedorId,
      organizacaoId,
      proximoNumeroPedido: pedido.numero + 1,
    },
    data: { proximoNumeroPedido: { decrement: 1 } },
  });

  revalidatePath("/pedidos");
  redirect("/pedidos");
}
