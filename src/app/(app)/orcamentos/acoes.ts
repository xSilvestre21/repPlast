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
import { exigirNumero } from "@/lib/numero-br";
import { arredondarDinheiro } from "@/lib/precificacao";
import { prepostoDoNovoPedido } from "@/lib/preposto-do-pedido";
import {
  type ProdutoPrecificavel,
  type UnidadeVenda,
  paraPrecificavel,
  pesoDoItem,
  precoUnitario,
  unidadesDaFamilia,
} from "@/lib/produto-preco";
import { contaParaEnvio } from "@/lib/conta-email";
import { enviarEmail } from "@/lib/email";
import { CONTATO_EMAIL, CONTATO_NFE } from "@/lib/envio-orcamento";
import {
  type EstadoEnvio,
  lerListaEmails,
  montarDestinatarios,
  problemaNoEnvio,
} from "@/lib/envio-pedido";
import { carregarOrcamentoParaPdf, gerarPdfOrcamento } from "@/lib/pdf/gerar-orcamento";
import { soIndustriasMarcadas } from "@/lib/industrias-do-ator";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";
import { calcularTotaisPedido } from "@/lib/totais";
import { nomeCompleto } from "@/lib/nome-usuario";

import {
  contaDoFormulario,
  dadosDoFormulario,
  formularioDaConta,
  lerConta,
} from "../produtos/leitura";

export type { EstadoFormulario };

const PROPOSTA_SUMIU =
  "Esta proposta não foi encontrada — ela pode ter sido excluída em outra tela. " +
  "Volte à lista de orçamentos e confira.";

/** A quantidade do item: obrigatória e maior que zero. */
function lerQuantidade(formData: FormData, { naLinha = false } = {}): number {
  const quantidade = exigirNumero(formData, "quantidade", "a quantidade", {
    obrigatorio: true,
    min: 0,
    exemplo: "1.000",
  });
  if (quantidade === 0) {
    throw new ErroDeCampo(
      "quantidade",
      naLinha
        ? "A quantidade precisa ser maior que zero. Para tirar o item da proposta, use “remover”."
        : "A quantidade precisa ser maior que zero — como 1.000.",
    );
  }
  return quantidade;
}

/**
 * O preço digitado no item; vazio é `null` (vale o calculado). Texto que não
 * é número era trocado pelo preço calculado sem aviso — o item entrava com um
 * valor que a pessoa não digitou.
 */
function lerPreco(formData: FormData): number | null {
  return exigirNumero(formData, "precoUnitario", "o preço", { min: 0, exemplo: "1.774,87" });
}

async function contexto() {
  return escopoAtual();
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/**
 * Data de coluna `date`: montada em UTC para o dia não escorregar pelo fuso.
 * Recusa a data que não existe — "2026-02-31" virava 3 de março sem aviso.
 */
function lerData(formData: FormData, campo: string, mensagem: string): Date | null {
  const texto = lerTexto(formData.get(campo));
  if (!texto) return null;

  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (!ano || !mes || !dia || data.toISOString().slice(0, 10) !== texto) {
    throw new ErroDeCampo(campo, mensagem);
  }
  return data;
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

  if (!orcamento) throw new ErroParaUsuario(PROPOSTA_SUMIU);
  if (orcamento.status !== "ABERTO") {
    throw new ErroParaUsuario(
      "Esta proposta já foi fechada (aceita, recusada ou vencida) e não pode mais ser alterada. " +
        "Para mexer nela, clique antes em “reabrir a proposta”.",
    );
  }

  return orcamento;
}

/**
 * Onde a linha nova entra e se ela cobra IPI.
 *
 * A linha nova acompanha as que já estão lá — proposta inteira isenta não
 * obriga a desmarcar a cada item.
 */
async function proximaLinha(db: DbOrganizacao, orcamentoId: string, formData: FormData) {
  const tributados = await db.orcamentoItem.count({ where: { orcamentoId, comIpi: true } });
  const existentes = await db.orcamentoItem.count({ where: { orcamentoId } });

  const ultimo = await db.orcamentoItem.findFirst({
    where: { orcamentoId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  return {
    ordem: (ultimo?.ordem ?? 0) + 1,
    comIpi: ipiDoFormulario(formData) ?? (existentes === 0 || tributados > 0),
  };
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
    const { organizacaoId, usuarioId, ehAdmin, db } = await contexto();

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
      throw new ErroDeCampo(
        "clienteId",
        "Escolha o cliente na lista — ou, se ainda não é cliente, escreva o nome de quem pediu o preço.",
      );
    }
    if (!fornecedorId) throw new ErroDeCampo("fornecedorId", "Escolha de qual indústria é a proposta.");

    const [cliente, fornecedor, usuario] = await Promise.all([
      clienteId
        ? db.cliente.findFirst({
            where: { id: clienteId, organizacaoId },
            select: { id: true, observacoes: true },
          })
        : Promise.resolve(null),
      db.fornecedor.findFirst({
        where: { id: fornecedorId, organizacaoId, ...soIndustriasMarcadas({ ehAdmin, usuarioId }) },
        select: { id: true, ipiPercentual: true },
      }),
      db.usuario.findUnique({
        where: { id: usuarioId },
        select: { nome: true, sobrenome: true, observacoesPadrao: true, municipio: true },
      }),
    ]);

    if (clienteId && !cliente) {
      throw new ErroDeCampo(
        "clienteId",
        "Este cliente não foi encontrado — ele pode ter sido excluído. Escolha outro na lista.",
      );
    }
    if (!fornecedor) {
      throw new ErroDeCampo(
        "fornecedorId",
        "Esta indústria não foi encontrada, ou você não trabalha com ela. Escolha outra na lista.",
      );
    }

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
        vendedor: usuario ? nomeCompleto(usuario) : null,
        // E de onde ele escreve, que abre o cabeçalho. Congelada aqui pelo mesmo
        // motivo que o nome: reimprimir a proposta de março tem de sair igual ao
        // papel que o cliente recebeu.
        cidade: usuario?.municipio ?? null,
        // Com quem a comissão se divide se virar pedido. O preposto que cota é
        // o dono da proposta; a do administrador nasce do escritório, e o
        // preposto se escolhe no pedido — nem todo pedido é dividido.
        representanteId: ehAdmin ? null : usuarioId,
        // Quem digitou — é o que decide quem vê a proposta.
        criadoPorId: usuarioId,
      },
      select: { id: true },
    });

    destino = `/orcamentos/${orcamento.id}`;
  } catch (erro) {
    return falhou(erro, formData);
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
        validoAte: lerData(
          formData,
          "validoAte",
          "Esta data de validade não é válida. Escolha a data de novo no calendário.",
        ),
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
    return falhou(erro, formData);
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
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarStatus(orcamentoId, status, formData);
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${orcamentoId}`);
  return {};
}

async function gravarStatus(orcamentoId: string, status: StatusOrcamento, formData: FormData) {
  const { organizacaoId, db } = await contexto();

  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    select: { status: true, itens: { select: { id: true }, take: 1 } },
  });

  if (!orcamento) throw new ErroParaUsuario(PROPOSTA_SUMIU);
  if (status === "ACEITO" && orcamento.itens.length === 0) {
    throw new ErroParaUsuario(
      "A proposta ainda não tem itens. Adicione pelo menos um antes de marcar como aceita.",
    );
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
export async function excluirOrcamento(
  orcamentoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await excluirOrcamentoDoBanco(orcamentoId);
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/orcamentos");
  redirect("/orcamentos");
}

async function excluirOrcamentoDoBanco(orcamentoId: string) {
  const { organizacaoId, db } = await contexto();

  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    select: { numero: true, status: true },
  });

  if (!orcamento) {
    throw new ErroParaUsuario(
      "Esta proposta não foi encontrada — ela pode já ter sido excluída em outra tela.",
    );
  }

  if (orcamento.status === "ACEITO" || orcamento.status === "RECUSADO") {
    throw new ErroParaUsuario(
      "Proposta aceita ou recusada não pode ser excluída. Para descartá-la, clique antes em " +
        "“reabrir a proposta” e depois exclua.",
    );
  }

  const nascidos = await db.pedido.count({ where: { orcamentoId, organizacaoId } });
  if (nascidos > 0) {
    const quantos = nascidos === 1 ? "1 pedido" : `${nascidos} pedidos`;
    throw new ErroParaUsuario(
      `Esta proposta já virou ${quantos} e não pode ser excluída — o pedido guarda de onde veio.`,
    );
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

    /*
     * Proposta sem cliente não lança do catálogo: não há produto DELE, e o de
     * outro cliente traria o preço negociado com outra empresa. Ali a linha
     * nasce da conta (`adicionarItemPorConta`). A tela já não oferece; isto
     * fecha o caminho de quem chegar por fora dela.
     */
    if (!orcamento.clienteId) {
      throw new ErroParaUsuario(
        "Esta proposta é para quem ainda não é cliente, e por isso o item entra pela conta. " +
          "Recarregue a página para ver o formulário certo.",
      );
    }

    const produtoId = lerTexto(formData.get("produtoId"));
    if (!produtoId) throw new ErroDeCampo("produtoId", "Escolha o produto na lista.");

    const quantidade = lerQuantidade(formData);

    const produto = await db.produto.findFirst({
      where: { id: produtoId, organizacaoId },
      include: { aditivos: { include: { aditivo: true } } },
    });

    if (!produto) {
      throw new ErroDeCampo(
        "produtoId",
        "Este produto não foi encontrado — ele pode ter sido excluído. Escolha outro na lista.",
      );
    }

    // Uma proposta é de uma indústria só, pelo mesmo motivo do pedido: é ela
    // que faturaria, e o IPI congelado aqui é o dela.
    if (produto.fornecedorId !== orcamento.fornecedorId) {
      throw new ErroDeCampo(
        "produtoId",
        "Este produto é de outra indústria. Cada proposta é de uma indústria só — abra uma " +
          "proposta separada para ela.",
      );
    }

    /*
     * E de outro cliente também não.
     *
     * O preço do produto é o que foi negociado com o dono dele; lançá-lo aqui
     * levaria esse preço para dentro da proposta de quem não o negociou. A tela
     * já não oferece, e isto fecha o caminho de quem chegar por fora dela.
     */
    if (produto.clienteId !== orcamento.clienteId) {
      throw new ErroDeCampo(
        "produtoId",
        "Este produto é de outro cliente — o preço dele foi negociado com outra empresa. " +
          "Escolha um produto deste cliente, ou cadastre-o para ele em Produtos.",
      );
    }

    const unidade = String(formData.get("unidade") ?? "") as UnidadeVenda;
    const precificavel = paraPrecificavel(produto);

    const precoInformado = lerPreco(formData);
    const precoCalculado = precoUnitario(precificavel, unidade);

    if (precoInformado === null && precoCalculado === null) {
      throw new ErroDeCampo(
        "precoUnitario",
        "Este produto não tem preço cadastrado para a unidade escolhida. Digite o preço aqui, " +
          "ou escolha outra unidade.",
      );
    }

    const preco = precoInformado !== null ? String(precoInformado) : precoCalculado!.toString();

    const { ordem, comIpi: comIpiItem } = await proximaLinha(db, orcamentoId, formData);

    await db.orcamentoItem.create({
      data: {
        orcamentoId,
        produtoId,
        ordem,
        familia: produto.familia,
        descricao: produto.descricao,
        codigoFornecedor: produto.codigoFornecedor,
        // A guarda lá em cima garantiu que o produto é do cliente, então o
        // código do produto é o número que ELE usa.
        codigoCliente: produto.codigoCliente,
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
    return falhou(erro, formData);
  }

  revalidatePath(`/orcamentos/${orcamentoId}`);
  return {};
}

/**
 * Lança uma linha feita de CONTA, sem produto — o item da proposta avulsa.
 *
 * Para quem ainda não é cliente não há produto a oferecer: o representante
 * preenche a família e os campos dela, e a linha entra com a conta guardada.
 * A leitura é a do cadastro de produto (`dadosDoFormulario`), para que a mesma
 * conta, depois de o cliente existir, vire produto dele sem ser recusada.
 */
export async function adicionarItemPorConta(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    const orcamento = await exigirAberto(db, orcamentoId, organizacaoId);

    if (orcamento.clienteId) {
      throw new ErroParaUsuario(
        "Esta proposta já tem cliente cadastrado, e por isso o item entra pelos produtos dele. " +
          "Recarregue a página para ver o formulário certo.",
      );
    }

    const descricao = lerTexto(formData.get("descricao"));
    if (!descricao) {
      throw new ErroDeCampo(
        "descricao",
        "A descrição ainda está vazia. Preencha as medidas da conta — a descrição se monta com " +
          "elas — ou escreva a descrição à mão.",
      );
    }

    const quantidade = lerQuantidade(formData);

    const conta = contaDoFormulario(formData);
    const dados = dadosDoFormulario(
      formularioDaConta(conta, { fornecedorId: orcamento.fornecedorId, descricao }),
    );

    // Os aditivos entram no preço, então só valem os da indústria da proposta.
    const aditivos = await db.aditivo.findMany({
      where: { id: { in: conta.aditivos }, fornecedorId: orcamento.fornecedorId },
      select: { nome: true, sufixoDescricao: true, tipo: true, valor: true },
    });
    if (aditivos.length !== conta.aditivos.length) {
      throw new ErroDeCampo(
        "aditivos",
        "Um dos aditivos marcados não é desta indústria — ele pode ter sido removido. " +
          "Recarregue a página e marque de novo.",
      );
    }

    const precificavel: ProdutoPrecificavel = {
      ...dados,
      aditivos: aditivos.map((a) => ({ ...a, valor: a.valor.toString() })),
    };

    const unidade = String(formData.get("unidade") ?? "") as UnidadeVenda;
    if (!unidadesDaFamilia(dados.familia).includes(unidade)) {
      throw new ErroDeCampo("unidade", "Escolha em que unidade este item é vendido.");
    }
    if (dados.familia === "AVULSO" && unidade !== dados.unidadeAvulsa) {
      throw new ErroDeCampo(
        "unidade",
        "No item avulso, a unidade do item precisa ser a mesma do preço digitado na conta. " +
          "Escolha a mesma nos dois lugares.",
      );
    }

    const precoInformado = lerPreco(formData);
    const precoCalculado = precoUnitario(precificavel, unidade);

    if (precoInformado === null && precoCalculado === null) {
      throw new ErroDeCampo(
        "precoUnitario",
        "Com as medidas informadas não dá para calcular o preço nesta unidade. Digite o preço " +
          "aqui, ou escolha outra unidade.",
      );
    }

    const preco = precoInformado !== null ? String(precoInformado) : precoCalculado!.toString();
    const { ordem, comIpi } = await proximaLinha(db, orcamentoId, formData);

    await db.orcamentoItem.create({
      data: {
        orcamentoId,
        produtoId: null,
        ordem,
        familia: dados.familia,
        descricao,
        codigoFornecedor: null,
        codigoCliente: null,
        unidade,
        quantidade: String(quantidade),
        comIpi,
        precoUnitario: preco,
        pesoKg: pesoDoItem(precificavel, unidade, quantidade).toDecimalPlaces(3).toString(),
        conta,
        totalSemIpi: "0",
        valorIpi: "0",
        total: "0",
      },
    });

    await recalcularTotais(db, orcamentoId);
  } catch (erro) {
    return falhou(erro, formData);
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
    if (!itemId) {
      throw new ErroParaUsuario("Não deu para saber qual linha salvar. Recarregue a página e tente de novo.");
    }

    const quantidade = lerQuantidade(formData, { naLinha: true });
    const preco = lerPreco(formData);
    if (preco === null) throw new ErroDeCampo("precoUnitario", "Informe o preço.");

    const item = await db.orcamentoItem.findFirst({
      where: { id: itemId, orcamentoId },
      include: { produto: { include: { aditivos: { include: { aditivo: true } } } } },
    });

    if (!item) {
      throw new ErroParaUsuario(
        "Esta linha não foi encontrada — ela pode ter sido removida em outra tela. Recarregue a página.",
      );
    }

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
    return falhou(erro, formData);
  }

  revalidatePath(`/orcamentos/${orcamentoId}`);
  return {};
}

/** Liga ou desliga o IPI de todas as linhas de uma vez. */
async function gravarDefinirIpiDeTodosOsItens(
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

async function gravarRemoverItem(orcamentoId: string, formData: FormData): Promise<void> {
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
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  let pedidoId: string;
  try {
    pedidoId = await gerarPedido(orcamentoId);
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/orcamentos");
  revalidatePath("/pedidos");
  redirect(`/pedidos/${pedidoId}`);
}

async function gerarPedido(orcamentoId: string): Promise<string> {
  const { organizacaoId, usuarioId, ehAdmin, db } = await contexto();

  const orcamento = await db.orcamento.findFirst({
    where: { id: orcamentoId, organizacaoId },
    include: {
      itens: { orderBy: { ordem: "asc" } },
      cliente: { select: { apelido: true, observacoes: true } },
      fornecedor: { select: { comissaoPercentual: true, diaFechamentoComissao: true } },
    },
  });

  if (!orcamento) throw new ErroParaUsuario(PROPOSTA_SUMIU);
  if (orcamento.itens.length === 0) {
    throw new ErroParaUsuario("A proposta ainda não tem itens — não há o que levar para o pedido.");
  }
  if (orcamento.status === "RECUSADO") {
    throw new ErroParaUsuario(
      "Esta proposta está marcada como recusada. Clique em “reabrir a proposta” e depois em " +
        "“Cliente aceitou” para ela poder virar pedido.",
    );
  }

  /*
   * Aqui o cadastro passa a ser obrigatório, e só aqui.
   *
   * O pedido carrega razão social, CNPJ, endereço e inscrição estadual para o
   * papel que a indústria recebe — um nome solto não fatura. A proposta podia
   * viver sem isso porque ela é conversa; o pedido é documento fiscal.
   *
   * Quem estiver nessa situação não fica sem saída: a proposta leva ao
   * cadastro completo do cliente, que volta vinculado.
   */
  if (!orcamento.clienteId) {
    throw new ErroParaUsuario(
      "Proposta para quem ainda não é cliente não vira pedido. Cadastre o cliente e os produtos " +
        "dela antes — o cartão “Esta proposta não vira pedido”, acima, mostra o caminho.",
    );
  }

  /*
   * E todo item precisa ser um produto do cliente.
   *
   * A linha feita de conta não tem produto: é cotação. O pedido leva o código
   * e o produto para a indústria e para o histórico de compras do cliente, e
   * uma linha solta ali seria compra que ninguém consegue repetir.
   */
  const semProduto = orcamento.itens.filter((i) => i.produtoId === null).length;
  if (semProduto > 0) {
    const quantos = semProduto === 1 ? "1 item" : `${semProduto} itens`;
    throw new ErroParaUsuario(
      `Falta cadastrar ${quantos} como produto de ${orcamento.cliente?.apelido}. Use ` +
        "“cadastrar como produto” em cada linha, ou “Cadastrar todos os produtos”, acima.",
    );
  }

  // A proposta do preposto credita ele; a do escritório vai para o preposto
  // do cliente, como no pedido lançado direto.
  const preposto = await prepostoDoNovoPedido(db, {
    organizacaoId,
    clienteId: orcamento.clienteId,
    usuarioId,
    ehAdmin,
    representanteId: orcamento.representanteId,
  });

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
      // Nasce com o fechamento da indústria, como no pedido lançado direto.
      diaFechamentoComissao: orcamento.fornecedor.diaFechamentoComissao,
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
      ...preposto,
      criadoPorId: usuarioId,
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

  return pedido.id;
}


/**
 * Cadastra como produto DO CLIENTE cada linha da proposta que nasceu de conta.
 *
 * É o "todos de uma vez" do que o Novo produto faz um a um: com o cliente já
 * cadastrado, a conta guardada no item vira produto dele — mesma indústria,
 * mesma leitura do cadastro — e o item passa a apontar para o produto. Preço e
 * descrição do item não mudam: a proposta é o que o cliente recebeu.
 *
 * Vai item a item, sem transação única (o cliente do banco com RLS não abre
 * uma interativa). Não faz mal: o que já foi ligado sai do filtro, e repetir
 * o clique retoma de onde parou.
 */
export async function cadastrarProdutosDaProposta(
  orcamentoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    // Produto é cadastro, e cadastro é do administrador.
    await exigirAdmin();
    const { organizacaoId, db } = await contexto();

    const orcamento = await db.orcamento.findFirst({
      where: { id: orcamentoId, organizacaoId },
      select: {
        clienteId: true,
        fornecedorId: true,
        itens: {
          where: { produtoId: null },
          orderBy: { ordem: "asc" },
          select: { id: true, descricao: true, conta: true },
        },
      },
    });

    if (!orcamento) throw new ErroParaUsuario(PROPOSTA_SUMIU);
    if (!orcamento.clienteId) {
      throw new ErroParaUsuario("Cadastre primeiro o cliente (passo 1), e depois os produtos.");
    }

    for (const item of orcamento.itens) {
      const conta = lerConta(item.conta);
      if (!conta) {
        throw new ErroParaUsuario(
          `A linha “${item.descricao}” não tem as medidas guardadas, então não dá para cadastrá-la ` +
            "sozinha. Use “cadastrar como produto” nessa linha e preencha o que falta.",
        );
      }

      /*
       * A conta é relida como no cadastro de produto, e o erro dela aponta um
       * campo daquele formulário — que esta tela não tem. A frase ganha o nome
       * da linha e o caminho para corrigi-la.
       */
      let dados: ReturnType<typeof dadosDoFormulario>;
      try {
        dados = dadosDoFormulario(
          formularioDaConta(conta, {
            fornecedorId: orcamento.fornecedorId,
            clienteId: orcamento.clienteId,
            descricao: item.descricao,
          }),
        );
      } catch (erro) {
        if (!(erro instanceof ErroDeCampo)) throw erro;
        throw new ErroParaUsuario(
          `Na linha “${item.descricao}”: ${erro.message} Use “cadastrar como produto” nessa linha ` +
            "para corrigir.",
        );
      }

      const aditivos = await db.aditivo.count({
        where: { id: { in: conta.aditivos }, fornecedorId: orcamento.fornecedorId },
      });
      if (aditivos !== conta.aditivos.length) {
        throw new ErroParaUsuario(
          `A linha “${item.descricao}” usa um aditivo que não existe mais nesta indústria. Use ` +
            "“cadastrar como produto” nessa linha e escolha os aditivos de novo.",
        );
      }

      const produto = await db.produto.create({
        data: {
          organizacaoId,
          ...dados,
          aditivos: { create: conta.aditivos.map((aditivoId) => ({ aditivoId })) },
        },
        select: { id: true },
      });

      await db.orcamentoItem.update({
        where: { id: item.id },
        data: { produtoId: produto.id },
      });
    }
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/produtos");
  revalidatePath(`/orcamentos/${orcamentoId}`);
  return {};
}

/* -------------------------------------------------------------------------- */
/* Envio por e-mail                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Manda a proposta para o cliente, da caixa de quem está enviando.
 *
 * O mesmo caminho do pedido (`enviarPedidoPorEmail`), com duas diferenças. Vai
 * para o CLIENTE: as caixas marcadas no diálogo são o e-mail e o e-mail da
 * NF-e do cadastro, e os endereços vêm daqui, do banco — a caixa marcada diz
 * "mande para ele", e quem ele é o cadastro sabe. E enviar não mexe no status:
 * aceite e recusa continuam sendo decisão de quem negocia. O que muda é que a
 * proposta deixa de estar em elaboração — a que foi para o cliente está pronta.
 */
export async function enviarOrcamentoPorEmail(
  orcamentoId: string,
  _estado: EstadoEnvio,
  formData: FormData,
): Promise<EstadoEnvio> {
  let aviso: string | undefined;

  try {
    const { organizacaoId, usuarioId, papel, db } = await contexto();

    const orcamento = await db.orcamento.findFirst({
      where: { id: orcamentoId, organizacaoId },
      select: {
        _count: { select: { itens: true } },
        cliente: { select: { email: true, emailNfe: true } },
      },
    });
    if (!orcamento) throw new ErroParaUsuario(PROPOSTA_SUMIU);
    if (orcamento._count.itens === 0) {
      throw new ErroParaUsuario("A proposta ainda não tem itens. Adicione pelo menos um antes de enviar.");
    }

    const pdf = await carregarOrcamentoParaPdf(orcamentoId, organizacaoId, { usuarioId, papel });
    if (!pdf) throw new ErroParaUsuario(PROPOSTA_SUMIU);

    const conta = await contaParaEnvio(db, usuarioId, String(formData.get("contaId") ?? ""));
    if (!conta) {
      throw new ErroDeCampo(
        "contaId",
        "Escolha de qual e-mail a proposta sai. Se a lista estiver vazia, cadastre seu e-mail em Configurações.",
      );
    }

    const doCadastro: Record<string, string | null | undefined> = {
      [CONTATO_EMAIL]: orcamento.cliente?.email,
      [CONTATO_NFE]: orcamento.cliente?.emailNfe,
    };
    const contatos = formData
      .getAll("contatoId")
      .map((id) => doCadastro[String(id)])
      .filter((email): email is string => Boolean(email));

    const avulsos = lerListaEmails(String(formData.get("emailsAvulsos") ?? ""));
    const { para, cc } = montarDestinatarios({
      contatos,
      avulsos,
      copiaParaMim: formData.get("copiaParaMim") === "on" ? conta.email : null,
    });

    const assunto = String(formData.get("assunto") ?? "").trim();
    const corpo = String(formData.get("corpo") ?? "");

    const extras = formData
      .getAll("anexo")
      .filter((a): a is File => a instanceof File && a.size > 0);

    const arquivo = await gerarPdfOrcamento(pdf.dados);

    const problema = problemaNoEnvio({
      para,
      cc,
      assunto,
      anexos: [
        { nome: pdf.nomeArquivo, tamanho: arquivo.length },
        ...extras.map((a) => ({ nome: a.name, tamanho: a.size })),
      ],
      avulsos,
      faltaDestinatario:
        "Escolha pelo menos um e-mail do cliente: marque um da lista ou digite um em “Outros e-mails”.",
    });
    if (problema) {
      throw problema.campo
        ? new ErroDeCampo(problema.campo, problema.erro)
        : new ErroParaUsuario(problema.erro);
    }

    const anexos = [
      { nome: pdf.nomeArquivo, conteudo: arquivo, tipo: "application/pdf" },
      ...(await Promise.all(
        extras.map(async (a) => ({
          nome: a.name,
          conteudo: Buffer.from(await a.arrayBuffer()),
          tipo: a.type || undefined,
        })),
      )),
    ];

    const resultado = await enviarEmail({ conta, para, cc, assunto, texto: corpo, anexos });
    // `motivo` já vem em português e com o próximo passo (`explicarErro`).
    if (!resultado.enviado) throw new ErroParaUsuario(resultado.motivo);

    if (resultado.recusados.length > 0) {
      aviso =
        `Enviada, mas o servidor de e-mail recusou ${resultado.recusados.join(", ")}. ` +
        "Confira se esses endereços estão certos — quem foi recusado não recebeu.";
    }

    await db.envioOrcamento.create({
      data: {
        orcamentoId,
        usuarioId,
        de: conta.email,
        para,
        cc,
        assunto,
        corpo,
        anexos: anexos.map((a) => a.nome),
        idMensagem: resultado.id,
      },
    });

    // A conta acabou de provar que funciona — vale como teste.
    await db.contaEmail.updateMany({
      where: { id: conta.id, usuarioId },
      data: { testadaEm: new Date() },
    });

    await db.orcamento.updateMany({
      where: { id: orcamentoId, organizacaoId },
      data: { emElaboracao: false },
    });
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${orcamentoId}`);
  return { enviado: true, aviso };
}

/** `gravarRemoverItem`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function removerItem(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarRemoverItem(orcamentoId, formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}

/** `gravarDefinirIpiDeTodosOsItens`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function definirIpiDeTodosOsItens(
  orcamentoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarDefinirIpiDeTodosOsItens(orcamentoId, formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}
