"use server";

/**
 * Orçamento: a proposta que vai ao cliente antes de existir pedido.
 *
 * As ações espelham as do pedido porque o documento é o mesmo em outro momento
 * da conversa — item congelado, IPI por linha, os mesmos totais. O que muda é o
 * ciclo: um orçamento não é enviado à indústria, é ACEITO ou RECUSADO pelo
 * cliente, e quando aceito vira pedido deixando rastro.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { StatusOrcamento } from "@/generated/prisma/enums";
import type { DbOrganizacao } from "@/lib/db";
import { ipiDoFormulario, ipiParaGravar } from "@/lib/ipi-do-formulario";
import { motivoDoFormulario } from "@/lib/motivo";
import { lerNumeroBr } from "@/lib/numero-br";
import { arredondarDinheiro } from "@/lib/precificacao";
import {
  type UnidadeVenda,
  paraPrecificavel,
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

/** Data de coluna `date`: montada em UTC para o dia não escorregar pelo fuso. */
function lerData(valor: FormDataEntryValue | null): Date | null {
  const texto = lerTexto(valor);
  if (!texto) return null;

  const [ano, mes, dia] = texto.split("-").map(Number);
  if (!ano || !mes || !dia) throw new Error("Data inválida.");

  return new Date(Date.UTC(ano, mes - 1, dia));
}

/**
 * Exige que a proposta ainda esteja aberta.
 *
 * Orçamento aceito, recusado ou vencido vira documento histórico: é o que o
 * cliente recebeu, e mexer nele depois apagaria a prova do que foi proposto.
 */
async function exigirAberto(db: DbOrganizacao, orcamentoId: string, organizacaoId: string) {
  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    select: {
      id: true,
      status: true,
      fornecedorId: true,
      clienteId: true,
      emElaboracao: true,
    },
  });

  if (!orcamento) throw new Error("Orçamento não encontrado.");
  if (orcamento.status !== "ABERTO") {
    throw new Error("Este orçamento já foi fechado e não pode mais ser alterado.");
  }

  return orcamento;
}

/** Recalcula e grava os totais a partir dos itens — igual ao do pedido. */
async function recalcularTotais(db: DbOrganizacao, orcamentoId: string) {
  const orcamento = await db.orcamento.findUnique({
    where: { id: orcamentoId },
    select: { ipiPercentual: true },
  });

  if (!orcamento) return;

  const itens = await db.orcamentoItem.findMany({
    where: { orcamentoId },
    orderBy: { ordem: "asc" },
    select: { id: true, quantidade: true, precoUnitario: true, comIpi: true },
  });

  const totais = calcularTotaisPedido(
    itens.map((i) => ({
      precoUnitario: i.precoUnitario.toString(),
      quantidade: i.quantidade.toString(),
      comIpi: i.comIpi,
    })),
    orcamento.ipiPercentual.toString(),
  );

  for (const [indice, item] of itens.entries()) {
    const calculado = totais.itens[indice];

    await db.orcamentoItem.update({
      where: { id: item.id },
      data: {
        totalSemIpi: calculado.total.toString(),
        valorIpi: calculado.ipi.toString(),
        total: calculado.totalComIpi.toString(),
      },
    });
  }

  await db.orcamento.update({
    where: { id: orcamentoId },
    data: {
      subtotalSemIpi: totais.subtotalSemIpi.toString(),
      valorIpi: totais.ipi.toString(),
      totalGeral: totais.totalGeral.toString(),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Ciclo de vida                                                              */
/* -------------------------------------------------------------------------- */

export async function criarOrcamento(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, usuarioId, db } = await contexto();

    const clienteId = lerTexto(formData.get("clienteId"));
    const avulsoNome = lerTexto(formData.get("clienteAvulsoNome"));
    const fornecedorId = lerTexto(formData.get("fornecedorId"));

    /*
     * Ou um cliente do cadastro, ou só o nome de quem pediu o preço.
     *
     * Cotar para quem ainda não é cliente é o começo da conversa, não uma
     * falha de preenchimento — e obrigar o cadastro antes da primeira cotação
     * faria o representante inventar ficha para quem talvez nunca compre.
     */
    if (!clienteId && !avulsoNome) {
      return { erro: "Escolha o cliente ou escreva para quem é a proposta." };
    }
    if (!fornecedorId) return { erro: "Escolha a indústria." };

    const [cliente, fornecedor, usuario] = await Promise.all([
      clienteId
        ? db.cliente.findFirst({
            where: { id: clienteId, organizacaoId },
            select: { id: true, representanteId: true, observacoes: true },
          })
        : Promise.resolve(null),
      db.fornecedor.findFirst({
        where: { id: fornecedorId, organizacaoId },
        select: { id: true, ipiPercentual: true },
      }),
      db.usuario.findUnique({
        where: { id: usuarioId },
        select: { nome: true, observacoesPadrao: true, municipio: true },
      }),
    ]);

    if (clienteId && !cliente) return { erro: "Cliente não encontrado." };
    if (!fornecedor) return { erro: "Indústria não encontrada." };

    /*
     * Numeração POR ESCRITÓRIO, e não por indústria como a do pedido: o
     * orçamento é documento do representante para o cliente, e a indústria nem
     * fica sabendo dele. O `increment` vira um UPDATE atômico, então duas
     * propostas simultâneas nunca pegam o mesmo número.
     */
    const contador = await db.organizacao.update({
      where: { id: organizacaoId },
      data: { proximoNumeroOrcamento: { increment: 1 } },
      select: { proximoNumeroOrcamento: true },
    });

    const orcamento = await db.orcamento.create({
      data: {
        organizacaoId,
        clienteId: cliente?.id ?? null,
        clienteAvulsoNome: cliente ? null : avulsoNome,
        clienteAvulsoMunicipio: cliente
          ? null
          : lerTexto(formData.get("clienteAvulsoMunicipio")),
        fornecedorId,
        numero: contador.proximoNumeroOrcamento - 1,
        // Congelado na criação, como no pedido.
        ipiPercentual: fornecedor.ipiPercentual,
        // As condições que se repetem em toda proposta entram preenchidas —
        // com o padrão de quem está criando, não do escritório.
        observacoes: usuario?.observacoesPadrao ?? cliente?.observacoes ?? null,
        // Quem assina embaixo é quem está criando — dá para trocar na ficha.
        vendedor: usuario?.nome ?? null,
        // E de onde ele escreve, que abre o cabeçalho. Congelada aqui pelo mesmo
        // motivo que o nome: reimprimir a proposta de março tem de sair igual ao
        // papel que o cliente recebeu.
        cidade: usuario?.municipio ?? null,
        // Mesmo corte do pedido: a proposta é da carteira, não de quem digitou.
        // Sem cliente ainda não há carteira — a proposta nasce do escritório.
        representanteId: cliente?.representanteId ?? null,
      },
      select: { id: true },
    });

    destino = `/orcamentos/${orcamento.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível criar." };
  }

  revalidatePath("/orcamentos");
  redirect(destino);
}

/**
 * Grava a proposta e devolve a pessoa para a lista.
 *
 * Sair da tela é parte do ato: gravar é dizer "terminei com esta", e a proposta
 * passa a abrir só para leitura. Quem precisar mexer de novo clica em editar —
 * e essa segunda gravada vira linha no log, porque é ela que responde ao
 * cliente que liga dizendo que o combinado era outro.
 */
export async function atualizarOrcamento(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, usuarioId, db } = await contexto();
    const orcamento = await exigirAberto(db, orcamentoId, organizacaoId);

    await db.orcamento.updateMany({
      where: { id: orcamentoId, organizacaoId },
      data: {
        attn: lerTexto(formData.get("attn")),
        validoAte: lerData(formData.get("validoAte")),
        prazoPagamento: lerTexto(formData.get("prazoPagamento")),
        observacoes: lerTexto(formData.get("observacoes")),
        vendedor: lerTexto(formData.get("vendedor")),
        cidade: lerTexto(formData.get("cidade")),
        emElaboracao: false,
      },
    });

    // Montar a proposta não é editá-la: o log começa na segunda gravada.
    if (!orcamento.emElaboracao) {
      await db.orcamentoEdicao.create({ data: { orcamentoId, usuarioId } });
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${orcamentoId}`);
  redirect("/orcamentos");
}

/**
 * Fecha a proposta num desfecho.
 *
 * Não há expiração automática: `validoAte` é o que foi prometido ao cliente, e
 * quem sabe se o preço foi renegociado é o representante. Um robô marcando
 * EXPIRADO na virada do dia apagaria propostas que seguem valendo.
 */
export async function definirStatus(
  orcamentoId: string,
  status: StatusOrcamento,
  formData: FormData,
): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    select: { status: true, itens: { select: { id: true }, take: 1 } },
  });

  if (!orcamento) throw new Error("Orçamento não encontrado.");
  if (status === "ACEITO" && orcamento.itens.length === 0) {
    throw new Error("Não dá para aceitar uma proposta sem itens.");
  }

  /*
   * O motivo viaja junto com a recusa porque é ali que ele se sabe.
   *
   * Campo em branco NÃO apaga o que já estava guardado: quem reabre e recusa de
   * novo encontra a caixa vazia — ela não vem preenchida —, e gravar esse vazio
   * por cima jogaria fora o motivo da primeira vez sem ninguém ter pedido.
   *
   * Isto já estava escrito aqui e o código fazia o contrário: a comparação era
   * `escrito !== null`, que passa também com string vazia. Para limpar de
   * propósito existe o "Salvar motivo" da ficha, onde o campo mostra o texto
   * atual e apagá-lo é uma escolha visível — mesma regra do cancelamento do
   * pedido (`../pedidos/acoes.ts`).
   */
  const escrito = motivoDoFormulario(formData, "motivoRecusa");
  const motivoRecusa = status === "RECUSADO" && escrito ? { motivoRecusa: escrito } : {};

  await db.orcamento.updateMany({
    where: { id: orcamentoId, organizacaoId },
    data: { status, ...motivoRecusa },
  });

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

/** Escrever o motivo depois, ou corrigir o que foi escrito na hora. */
export async function salvarMotivoRecusa(
  orcamentoId: string,
  formData: FormData,
): Promise<void> {
  const { organizacaoId, db } = await contexto();

  await db.orcamento.updateMany({
    where: { id: orcamentoId, organizacaoId, status: "RECUSADO" },
    data: { motivoRecusa: motivoDoFormulario(formData, "motivoRecusa") ?? "" },
  });

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${orcamentoId}`);
}

/**
 * Apaga a proposta e devolve o número, quando ela ainda não teve desfecho.
 *
 * ABERTO e EXPIRADO são descartáveis: da primeira ninguém respondeu, e a segunda
 * venceu sem o cliente decidir nada. ACEITO e RECUSADO são o contrário — o
 * aceito virou ou ainda vira pedido, e o recusado guarda o motivo da perda, que
 * é a única pergunta que a proposta perdida ainda responde. Para descartar um
 * desses dois, reabra antes: aí jogar a história fora é uma escolha, não um
 * clique a mais na mesma tela.
 */
export async function excluirOrcamento(orcamentoId: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    select: { numero: true, status: true },
  });

  if (!orcamento) throw new Error("Orçamento não encontrado.");

  if (orcamento.status === "ACEITO" || orcamento.status === "RECUSADO") {
    throw new Error("Proposta já aceita ou recusada não se apaga — reabra antes, se for para descartar.");
  }

  const nascidos = await db.pedido.count({ where: { orcamentoId, organizacaoId } });
  if (nascidos > 0) {
    throw new Error(`Este orçamento já virou ${nascidos} pedido(s) e não pode ser excluído.`);
  }

  await db.orcamento.deleteMany({ where: { id: orcamentoId, organizacaoId } });

  /*
   * O número volta para o contador quando era o ÚLTIMO emitido — mesma
   * devolução do pedido (`../pedidos/acoes.ts`), por motivo próprio: o número
   * do orçamento existe para o documento ser citável ao telefone, e uma
   * proposta lançada por engano não pode queimar um.
   *
   * A condição `proximoNumeroOrcamento: numero + 1` é o que torna isto seguro
   * sem transação: ela só acerta se o contador ainda estiver exatamente uma
   * casa à frente desta proposta. Se alguém criou outra nesse meio-tempo, o
   * contador já andou, a condição não casa e nada é decrementado — porque
   * decrementar ali entregaria um número repetido à próxima proposta.
   *
   * Apagar uma do MEIO não fecha o buraco de propósito: reaproveitar um número
   * vago faria a proposta de hoje sair com número menor que a de ontem, e a
   * numeração deixaria de dizer o que veio antes.
   *
   * A ordem também é deliberada: apaga primeiro, devolve depois. Ao contrário,
   * uma falha no apagar deixaria o contador atrás de uma proposta que continua
   * existindo — e a próxima colidiria com ela.
   */
  await db.organizacao.updateMany({
    where: { id: organizacaoId, proximoNumeroOrcamento: orcamento.numero + 1 },
    data: { proximoNumeroOrcamento: { decrement: 1 } },
  });

  revalidatePath("/orcamentos");
  redirect("/orcamentos");
}

/* -------------------------------------------------------------------------- */
/* Itens                                                                      */
/* -------------------------------------------------------------------------- */

export async function adicionarItem(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    const orcamento = await exigirAberto(db, orcamentoId, organizacaoId);

    const produtoId = lerTexto(formData.get("produtoId"));
    if (!produtoId) return { erro: "Escolha o produto." };

    const quantidade = lerNumeroBr(formData.get("quantidade"));
    if (quantidade === null || quantidade <= 0) return { erro: "Informe a quantidade." };

    const produto = await db.produto.findFirst({
      where: { id: produtoId, organizacaoId },
      include: { aditivos: { include: { aditivo: true } } },
    });

    if (!produto) return { erro: "Produto não encontrado." };

    // Uma proposta é de uma indústria só, pelo mesmo motivo do pedido: é ela
    // que faturaria, e o IPI congelado aqui é o dela.
    if (produto.fornecedorId !== orcamento.fornecedorId) {
      return { erro: "Este produto é de outra indústria. Abra uma proposta separada para ela." };
    }

    /*
     * E de outro cliente também não.
     *
     * O preço do produto é o que foi negociado com o dono dele; lançá-lo aqui
     * levaria esse preço para dentro da proposta de quem não o negociou. A tela
     * já não oferece, e isto fecha o caminho de quem chegar por fora dela.
     *
     * A proposta avulsa escapa: sem cliente não há dono a comparar, e é dela que
     * sai a cotação de quem ainda nem tem ficha.
     */
    if (orcamento.clienteId && produto.clienteId !== orcamento.clienteId) {
      return { erro: "Este produto é de outro cliente. O preço dele foi negociado com outra empresa." };
    }

    const unidade = String(formData.get("unidade") ?? "") as UnidadeVenda;
    const precificavel = paraPrecificavel(produto);

    const precoInformado = lerNumeroBr(formData.get("precoUnitario"));
    const precoCalculado = precoUnitario(precificavel, unidade);

    if (precoInformado === null && precoCalculado === null) {
      return { erro: "Este produto não tem preço para a unidade escolhida." };
    }
    if (precoInformado !== null && precoInformado < 0) {
      return { erro: "O preço não pode ser negativo." };
    }

    const preco = precoInformado !== null ? String(precoInformado) : precoCalculado!.toString();

    // A linha nova acompanha as que já estão lá — proposta inteira isenta não
    // obriga a desmarcar a cada item.
    const tributados = await db.orcamentoItem.count({ where: { orcamentoId, comIpi: true } });
    const existentes = await db.orcamentoItem.count({ where: { orcamentoId } });
    const comIpiItem = ipiDoFormulario(formData) ?? (existentes === 0 || tributados > 0);

    const ultimo = await db.orcamentoItem.findFirst({
      where: { orcamentoId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });

    await db.orcamentoItem.create({
      data: {
        orcamentoId,
        produtoId,
        ordem: (ultimo?.ordem ?? 0) + 1,
        familia: produto.familia,
        descricao: produto.descricao,
        codigoFornecedor: produto.codigoFornecedor,
        /*
         * A coluna COD.CLI só existe quando há cliente: é o número que ELE usa.
         *
         * Na proposta avulsa o produto ainda é de outra empresa — é dela que a
         * lista veio —, e o número dela não tem o que fazer no papel de quem só
         * pediu preço. Com cliente, a guarda lá em cima já garantiu que o produto
         * é dele, então o código do produto é o código dele.
         */
        codigoCliente: orcamento.clienteId ? produto.codigoCliente : null,
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

    await recalcularTotais(db, orcamentoId);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível adicionar." };
  }

  revalidatePath(`/orcamentos/${orcamentoId}`);
  return {};
}

export async function atualizarItem(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    await exigirAberto(db, orcamentoId, organizacaoId);

    const itemId = lerTexto(formData.get("itemId"));
    if (!itemId) return { erro: "Item não informado." };

    const quantidade = lerNumeroBr(formData.get("quantidade"));
    if (quantidade === null || quantidade <= 0) return { erro: "Informe a quantidade." };

    const preco = lerNumeroBr(formData.get("precoUnitario"));
    if (preco === null || preco < 0) return { erro: "Informe o preço." };

    const item = await db.orcamentoItem.findFirst({
      where: { id: itemId, orcamentoId },
      include: { produto: { include: { aditivos: { include: { aditivo: true } } } } },
    });

    if (!item) return { erro: "Item não encontrado." };

    // O peso acompanha a quantidade; sem produto ligado não há como recalculá-lo.
    const peso = item.produto
      ? pesoDoItem(paraPrecificavel(item.produto), item.unidade as UnidadeVenda, quantidade)
          .toDecimalPlaces(3)
          .toString()
      : item.pesoKg.toString();

    await db.orcamentoItem.update({
      where: { id: itemId },
      data: {
        quantidade: String(quantidade),
        precoUnitario: String(preco),
        // Aqui lia-se `comIpi`, campo que formulário nenhum envia — ver
        // `ipi-do-formulario.ts`. Sem opinião no formulário, nada muda.
        ...ipiParaGravar(formData),
        pesoKg: peso,
      },
    });

    await recalcularTotais(db, orcamentoId);
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/orcamentos/${orcamentoId}`);
  return {};
}

/** Liga ou desliga o IPI de todas as linhas de uma vez. */
export async function definirIpiDeTodosOsItens(
  orcamentoId: string,
  formData: FormData,
): Promise<void> {
  const { organizacaoId, db } = await contexto();
  await exigirAberto(db, orcamentoId, organizacaoId);

  await db.orcamentoItem.updateMany({
    where: { orcamentoId },
    data: { comIpi: formData.get("ligado") === "1" },
  });
  await recalcularTotais(db, orcamentoId);

  revalidatePath(`/orcamentos/${orcamentoId}`);
}

export async function removerItem(orcamentoId: string, formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();
  await exigirAberto(db, orcamentoId, organizacaoId);

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await db.orcamentoItem.deleteMany({ where: { id: itemId, orcamentoId } });
  await recalcularTotais(db, orcamentoId);

  revalidatePath(`/orcamentos/${orcamentoId}`);
}

/* -------------------------------------------------------------------------- */
/* Virar pedido                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Cria um pedido a partir da proposta aceita.
 *
 * Os preços vão COMO ESTÃO na proposta, sem recalcular. É o oposto do que o
 * sistema antigo fazia: lá a conversão relia o cadastro e o pedido podia sair
 * por um valor diferente do que o cliente aprovou. Aqui o que foi proposto é o
 * que é cobrado — e se algum preço mudou desde então, quem decide renegociar é
 * o representante, editando o pedido.
 *
 * O rastro fica nos dois lados: `Pedido.orcamentoId` aponta de volta, e a
 * proposta lista os pedidos que nasceram dela.
 */
export async function converterEmPedido(
  orcamentoId: string,
  _formData: FormData,
): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    include: {
      itens: { orderBy: { ordem: "asc" } },
      cliente: { select: { observacoes: true } },
      fornecedor: { select: { comissaoPercentual: true } },
    },
  });

  if (!orcamento) throw new Error("Orçamento não encontrado.");
  if (orcamento.itens.length === 0) throw new Error("Esta proposta não tem itens.");
  if (orcamento.status === "RECUSADO") {
    throw new Error("Esta proposta foi recusada. Marque como aceita antes de virar pedido.");
  }

  /*
   * Aqui o cadastro passa a ser obrigatório, e só aqui.
   *
   * O pedido carrega razão social, CNPJ, endereço e inscrição estadual para o
   * papel que a indústria recebe — um nome solto não fatura. A proposta podia
   * viver sem isso porque ela é conversa; o pedido é documento fiscal.
   *
   * Quem estiver nessa situação não fica sem saída: `cadastrarClienteDoOrcamento`
   * abre a ficha com o que a proposta já sabe.
   */
  if (!orcamento.clienteId) {
    throw new Error(
      "Esta proposta é para um cliente que ainda não está cadastrado. " +
        "Cadastre-o a partir dela antes de virar pedido.",
    );
  }

  const contador = await db.fornecedor.update({
    where: { id: orcamento.fornecedorId },
    data: { proximoNumeroPedido: { increment: 1 } },
    select: { proximoNumeroPedido: true },
  });

  const pedido = await db.pedido.create({
    data: {
      organizacaoId,
      clienteId: orcamento.clienteId,
      fornecedorId: orcamento.fornecedorId,
      numero: contador.proximoNumeroPedido - 1,
      orcamentoId,
      // O IPI vem da proposta, não do cadastro: é a alíquota que o cliente viu.
      ipiPercentual: orcamento.ipiPercentual,
      comissaoPercentual: orcamento.fornecedor.comissaoPercentual,
      prazoPagamento: orcamento.prazoPagamento,
      /*
       * As observações são as do CLIENTE, e não as da proposta.
       *
       * As duas se chamam igual e são coisas diferentes, para públicos
       * diferentes. Na proposta, "Condições" é o que o CLIENTE lê — ICMS,
       * PIS/COFINS, frete, validade. No pedido, "OBSERVAÇÃO" é o que a
       * INDÚSTRIA lê no papel que ela imprime: horário de recebimento,
       * exigências de entrega.
       *
       * Vinha `orcamento.observacoes ?? cliente`, e como a proposta nasce com as
       * condições preenchidas do padrão do usuário, o segundo termo nunca
       * disparava: a fábrica recebia "I.C.M.S.: 18% (incluso no preço acima)"
       * onde deveria ler quando pode entregar. `criarPedido` sempre usou o
       * cliente (`../pedidos/acoes.ts`); eram dois caminhos para o mesmo
       * documento discordando.
       */
      observacoes: orcamento.cliente?.observacoes ?? null,
      vendedor: orcamento.vendedor,
      representanteId: orcamento.representanteId,
      subtotalSemIpi: orcamento.subtotalSemIpi,
      valorIpi: orcamento.valorIpi,
      totalGeral: orcamento.totalGeral,
      itens: {
        create: orcamento.itens.map((i) => ({
          produtoId: i.produtoId,
          ordem: i.ordem,
          familia: i.familia,
          codigoFornecedor: i.codigoFornecedor,
          codigoCliente: i.codigoCliente,
          descricao: i.descricao,
          unidade: i.unidade,
          quantidade: i.quantidade,
          comIpi: i.comIpi,
          precoUnitario: i.precoUnitario,
          totalSemIpi: i.totalSemIpi,
          valorIpi: i.valorIpi,
          total: i.total,
          pesoKg: i.pesoKg,
        })),
      },
    },
    select: { id: true },
  });

  const pesoTotal = orcamento.itens.reduce((acc, i) => acc + Number(i.pesoKg), 0);
  await db.pedido.update({
    where: { id: pedido.id },
    data: { pesoTotalKg: arredondarDinheiro(pesoTotal).toString() },
  });

  // A proposta que virou pedido está aceita, por definição do ato.
  if (orcamento.status !== "ACEITO") {
    await db.orcamento.updateMany({
      where: { id: orcamentoId, organizacaoId },
      data: { status: "ACEITO" },
    });
  }

  revalidatePath("/orcamentos");
  revalidatePath("/pedidos");
  redirect(`/pedidos/${pedido.id}`);
}


/**
 * Transforma o destinatário avulso em cliente de verdade, e liga a proposta a ele.
 *
 * Existe para que "cadastre o cliente antes" não seja um beco: o sistema
 * antigo recusava a conversão e deixava a pessoa recomeçar em outra tela,
 * copiando o nome na mão. Aqui a ficha nasce com o que a proposta já sabe, e
 * o resto se preenche depois no cadastro.
 */
export async function cadastrarClienteDoOrcamento(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, usuarioId, ehAdmin, db } = await contexto();

    const orcamento = await db.orcamento.findFirst({
      where: { id: orcamentoId, organizacaoId },
      select: { clienteId: true, clienteAvulsoNome: true, clienteAvulsoMunicipio: true },
    });

    if (!orcamento) return { erro: "Orçamento não encontrado." };
    if (orcamento.clienteId) return { erro: "Esta proposta já tem cliente cadastrado." };

    const apelido = lerTexto(formData.get("apelido")) ?? orcamento.clienteAvulsoNome;
    const razaoSocial = lerTexto(formData.get("razaoSocial")) ?? apelido;

    if (!apelido || !razaoSocial) return { erro: "Informe o nome do cliente." };

    const cliente = await db.cliente.create({
      data: {
        organizacaoId,
        apelido,
        razaoSocial,
        municipio: lerTexto(formData.get("municipio")) ?? orcamento.clienteAvulsoMunicipio,
        // Preposto cadastra na própria carteira; administrador, para a casa.
        representanteId: ehAdmin ? null : usuarioId,
      },
      select: { id: true, representanteId: true },
    });

    await db.orcamento.updateMany({
      where: { id: orcamentoId, organizacaoId },
      data: {
        clienteId: cliente.id,
        clienteAvulsoNome: null,
        clienteAvulsoMunicipio: null,
        // A proposta passa a seguir a carteira de quem ficou com o cliente.
        representanteId: cliente.representanteId,
      },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível cadastrar." };
  }

  revalidatePath("/clientes");
  revalidatePath(`/orcamentos/${orcamentoId}`);
  return {};
}
