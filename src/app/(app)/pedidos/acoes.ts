"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { StatusPedido } from "@/generated/prisma/enums";
import { type DbOrganizacao } from "@/lib/db";
import { contaParaEnvio } from "@/lib/conta-email";
import { enviarEmail } from "@/lib/email";
import {
  type EstadoEnvio,
  lerListaEmails,
  montarDestinatarios,
  problemaNoEnvio,
} from "@/lib/envio-pedido";
import { ipiDoFormulario, ipiParaGravar } from "@/lib/ipi-do-formulario";
import { motivoDoFormulario } from "@/lib/motivo";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { exigirNumero } from "@/lib/numero-br";
import { carregarPedidoParaPdf, gerarPdfPedido } from "@/lib/pdf/gerar-pedido";
import { arredondarDinheiro } from "@/lib/precificacao";
import {
  paraPrecificavel,
  type UnidadeVenda,
  pesoDoItem,
  precoUnitario,
} from "@/lib/produto-preco";
import { soIndustriasMarcadas } from "@/lib/industrias-do-ator";
import { prepostoDoNovoPedido } from "@/lib/preposto-do-pedido";
import { escopoAtual } from "@/lib/sessao";
import { calcularTotaisPedido } from "@/lib/totais";
import { nomeCompleto } from "@/lib/nome-usuario";

export type { EstadoFormulario };

const PEDIDO_SUMIU =
  "Este pedido não foi encontrado — ele pode ter sido excluído em outra tela. " +
  "Volte à lista de pedidos e confira.";

/** A data como o campo de data a envia: "2026-10-09". Recusa "2026-02-31". */
function lerData(formData: FormData, campo: string, mensagem: string): Date | null {
  const texto = lerTexto(formData.get(campo));
  if (!texto) return null;

  const data = new Date(`${texto}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || data.toISOString().slice(0, 10) !== texto) {
    throw new ErroDeCampo(campo, mensagem);
  }
  return data;
}


async function contexto() {
  return escopoAtual();
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/**
 * A quantidade do item: obrigatória e maior que zero. Na linha que já está no
 * pedido, o zero quase sempre é alguém tentando tirar o item — e a frase diz
 * como.
 */
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
        ? "A quantidade precisa ser maior que zero. Para tirar o item do pedido, use “remover”."
        : "A quantidade precisa ser maior que zero — como 1.000.",
    );
  }
  return quantidade;
}

/** O preço digitado no item; vazio é `null` (vale o calculado). */
function lerPreco(formData: FormData): number | null {
  return exigirNumero(formData, "precoUnitario", "o preço", { min: 0, exemplo: "1.774,87" });
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
    select: {
      id: true,
      status: true,
      fornecedorId: true,
      clienteId: true,
      emElaboracao: true,
      representanteId: true,
    },
  });

  if (!pedido) throw new ErroParaUsuario(PEDIDO_SUMIU);

  if (pedido.status !== "ABERTO") {
    throw new ErroParaUsuario(
      pedido.status === "ENVIADO"
        ? "Este pedido já foi enviado à indústria e está travado. Para mudar algo, clique antes " +
            "em “Desmarcar envio”, no alto da página."
        : "Este pedido está cancelado e não pode ser alterado. Para mexer nele, clique antes em " +
            "“Reabrir”, no alto da página.",
    );
  }

  return pedido;
}

/**
 * Com quem a comissão do pedido se divide, como escolhido no cabeçalho.
 *
 * Só o administrador escolhe, e só entre os prepostos que atendem o cliente
 * (ou o que o pedido já tinha — senão salvar o desligaria sem ninguém ter
 * mexido). Devolve `undefined` quando o campo não veio ou não mudou: aí a
 * fatia congelada fica como está. Trocar de preposto congela a fatia do novo.
 */
async function prepostoEscolhido(
  db: DbOrganizacao,
  organizacaoId: string,
  pedido: { clienteId: string; representanteId: string | null },
  formData: FormData,
) {
  if (!formData.has("representanteId")) return undefined;

  const escolhido = lerTexto(formData.get("representanteId"));
  if (escolhido === pedido.representanteId) return undefined;
  if (escolhido === null) return { representanteId: null, comissaoPercentualPreposto: null };

  const preposto = await db.usuario.findFirst({
    where: {
      id: escolhido,
      organizacaoId,
      papel: "REPRESENTANTE",
      clientes: { some: { clienteId: pedido.clienteId } },
    },
    select: { id: true, comissaoPercentualPadrao: true },
  });
  if (!preposto) {
    throw new ErroDeCampo(
      "representanteId",
      "Este preposto não atende o cliente do pedido. Escolha outro, ou ligue o cliente a ele " +
        "na ficha do preposto.",
    );
  }

  return {
    representanteId: preposto.id,
    comissaoPercentualPreposto: preposto.comissaoPercentualPadrao,
  };
}

/* -------------------------------------------------------------------------- */
/* Edições                                                                    */
/* -------------------------------------------------------------------------- */

/** Gravações seguidas da mesma pessoa dentro desta janela contam como uma edição. */
const JANELA_DA_EDICAO_MS = 30 * 60 * 1000;

/**
 * Anota que alguém mexeu num pedido que já estava pronto.
 *
 * Montar o pedido não é editá-lo: enquanto ele está em elaboração, nada é
 * anotado — é a mesma regra do orçamento. Depois, cada ação que muda o pedido
 * passa por aqui, e não só o "Salvar": quem troca a quantidade de um item e
 * sai da tela sem salvar também mudou o que vai para a indústria.
 *
 * Um item alterado, outro removido e as condições salvas, em seguida, são UMA
 * edição, não três: a linha existente só tem a hora puxada para agora. Puxar a
 * hora é o que faz a conferência do administrador pegar a mudança mais nova.
 */
async function registrarEdicao(
  db: DbOrganizacao,
  pedido: { id: string; emElaboracao: boolean },
  usuarioId: string,
) {
  if (pedido.emElaboracao) return;

  const ultima = await db.pedidoEdicao.findFirst({
    where: { pedidoId: pedido.id },
    orderBy: { editadoEm: "desc" },
    select: { id: true, usuarioId: true, editadoEm: true },
  });

  if (
    ultima?.usuarioId === usuarioId &&
    Date.now() - ultima.editadoEm.getTime() < JANELA_DA_EDICAO_MS
  ) {
    await db.pedidoEdicao.update({ where: { id: ultima.id }, data: { editadoEm: new Date() } });
    return;
  }

  await db.pedidoEdicao.create({ data: { pedidoId: pedido.id, usuarioId } });
}

/**
 * As edições de preposto que o administrador ainda não conferiu.
 *
 * "Ainda não": as que vieram depois da última conferência, gravada quando o
 * administrador envia. Preposto é quem não é administrador.
 */
async function edicoesDePrepostoPendentes(db: DbOrganizacao, pedidoId: string) {
  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    select: { edicoesConferidasEm: true },
  });

  return db.pedidoEdicao.findMany({
    where: {
      pedidoId,
      usuario: { papel: { not: "ADMIN" } },
      ...(pedido?.edicoesConferidasEm ? { editadoEm: { gt: pedido.edicoesConferidasEm } } : {}),
    },
    orderBy: { editadoEm: "asc" },
    select: { id: true },
  });
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
    const { organizacaoId, usuarioId, ehAdmin, db } = await contexto();

    const clienteId = lerTexto(formData.get("clienteId"));
    const fornecedorId = lerTexto(formData.get("fornecedorId"));

    if (!clienteId) throw new ErroDeCampo("clienteId", "Escolha para qual cliente é o pedido.");
    if (!fornecedorId) throw new ErroDeCampo("fornecedorId", "Escolha de qual indústria é o pedido.");

    const [cliente, fornecedor, usuario] = await Promise.all([
      db.cliente.findFirst({
        where: { id: clienteId, organizacaoId },
        select: {
          id: true,
          observacoes: true,
          prazoPagamento: true,
        },
      }),
      db.fornecedor.findFirst({
        where: { id: fornecedorId, organizacaoId, ...soIndustriasMarcadas({ ehAdmin, usuarioId }) },
        select: { id: true, ipiPercentual: true, comissaoPercentual: true, diaFechamentoComissao: true },
      }),
      db.usuario.findUnique({
        where: { id: usuarioId },
        select: { nome: true, sobrenome: true },
      }),
    ]);

    if (!cliente) {
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

    const preposto = await prepostoDoNovoPedido(db, { organizacaoId, clienteId, usuarioId, ehAdmin });

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
        // Quando a indústria só paga depois de faturar, o pedido já nasce com
        // o dia dela — a exceção se troca no acerto, na tela de Comissões.
        diaFechamentoComissao: fornecedor.diaFechamentoComissao,
        // As observações do cliente já entram preenchidas — são recados que se
        // repetem em todo pedido dele.
        observacoes: cliente.observacoes,
        // O prazo de costume do cliente, que dá para trocar neste pedido.
        prazoPagamento: cliente.prazoPagamento,
        // Quem assina embaixo é quem está lançando, como no orçamento.
        vendedor: usuario ? nomeCompleto(usuario) : null,
        // Com quem a comissão DESTE pedido se divide, com a fatia congelada
        // aqui como o percentual da indústria. Dá para trocar no cabeçalho
        // enquanto o pedido estiver aberto.
        ...preposto,
        // Quem digitou: junto com a carteira, é o que decide quem vê o pedido.
        criadoPorId: usuarioId,
      },
      select: { id: true },
    });

    destino = `/pedidos/${pedido.id}`;
  } catch (erro) {
    return falhou(erro, formData);
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
    const { organizacaoId, usuarioId, ehAdmin, db } = await contexto();
    const pedido = await exigirAberto(db, pedidoId, organizacaoId);

    const preposto = ehAdmin ? await prepostoEscolhido(db, organizacaoId, pedido, formData) : undefined;

    // Texto que não é número era lido como vazio: "abc" na comissão a
    // apagava, e no IPI era ignorado — os dois sem aviso.
    const comissao = exigirNumero(formData, "comissaoPercentual", "a comissão", {
      min: 0,
      max: 100,
      exemplo: "5",
    });
    const ipi = exigirNumero(formData, "ipiPercentual", "o IPI", { min: 0, max: 100, exemplo: "9,75" });

    // A data inválida chegava ao banco e voltava como erro em inglês do Prisma.
    const prazoEntrega = lerData(
      formData,
      "prazoEntrega",
      "Esta data de entrega não é válida. Escolha a data de novo no calendário.",
    );
    const frete = formData.get("tipoFrete");

    await db.pedido.update({
      where: { id: pedidoId },
      data: {
        pedidoDoCliente: lerTexto(formData.get("pedidoDoCliente")),
        prazoPagamento: lerTexto(formData.get("prazoPagamento")),
        prazoEntrega,
        tipoFrete: frete === "CIF" || frete === "FOB" ? frete : null,
        transportadora: lerTexto(formData.get("transportadora")),
        observacoes: lerTexto(formData.get("observacoes")),
        vendedor: lerTexto(formData.get("vendedor")),
        ipiPercentual: ipi === null ? undefined : String(ipi),
        comissaoPercentual: comissao === null ? null : String(comissao),
        ...preposto,
        emElaboracao: false,
      },
    });

    // O IPI mudou de valor ou foi desligado: os totais precisam refletir isso.
    await recalcularTotais(db, pedidoId);
    await registrarEdicao(db, pedido, usuarioId);
  } catch (erro) {
    return falhou(erro, formData);
  }

  /*
   * Como no orçamento, salvar é dizer "terminei com este": o pedido passa a
   * abrir só para leitura, e a pessoa volta para a lista. Mexer de novo é
   * clicar em Editar — e isso fica anotado.
   */
  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect("/pedidos");
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
    const { organizacaoId, usuarioId, db } = await contexto();
    const pedido = await exigirAberto(db, pedidoId, organizacaoId);

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

    // Um pedido pertence a uma única indústria: é ela que fatura e é dela a
    // comissão. Misturar produtos de outra quebraria as duas coisas.
    if (produto.fornecedorId !== pedido.fornecedorId) {
      throw new ErroDeCampo(
        "produtoId",
        "Este produto é de outra indústria. Cada pedido é de uma indústria só — abra um pedido " +
          "separado para ela.",
      );
    }

    // E de outro cliente também não: o preço do produto é o que foi negociado
    // com o dono dele. Mesma guarda da proposta, sem a exceção do avulso — o
    // pedido sempre tem cliente.
    if (produto.clienteId !== pedido.clienteId) {
      throw new ErroDeCampo(
        "produtoId",
        "Este produto é de outro cliente — o preço dele foi negociado com outra empresa. " +
          "Escolha um produto deste cliente, ou cadastre-o para ele em Produtos.",
      );
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

    const comIpiItem = ipiDoFormulario(formData) ?? heranca;

    // Texto que não é número no preço era trocado pelo preço calculado, sem
    // aviso — o item entrava com um valor que a pessoa não digitou.
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
        // O COD.CLI do PDF: o código que ESTE cliente usa para ESTE produto.
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

    await recalcularTotais(db, pedidoId);
    await registrarEdicao(db, pedido, usuarioId);
  } catch (erro) {
    return falhou(erro, formData);
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
    const { organizacaoId, usuarioId, db } = await contexto();
    const pedido = await exigirAberto(db, pedidoId, organizacaoId);

    const itemId = String(formData.get("itemId") ?? "");
    if (!itemId) {
      throw new ErroParaUsuario("Não deu para saber qual linha salvar. Recarregue a página e tente de novo.");
    }

    const quantidade = lerQuantidade(formData, { naLinha: true });
    const preco = lerPreco(formData);
    if (preco === null) throw new ErroDeCampo("precoUnitario", "Informe o preço.");

    const item = await db.pedidoItem.findFirst({
      where: { id: itemId, pedidoId },
      include: { produto: { include: { aditivos: { include: { aditivo: true } } } } },
    });

    if (!item) {
      throw new ErroParaUsuario(
        "Esta linha não foi encontrada — ela pode ter sido removida em outra tela. Recarregue a página.",
      );
    }

    const peso = item.produto
      ? pesoDoItem(paraPrecificavel(item.produto), item.unidade as UnidadeVenda, quantidade)
      : null;

    await db.pedidoItem.update({
      where: { id: itemId },
      data: {
        quantidade: String(quantidade),
        precoUnitario: String(preco),
        // Sem opinião no formulário, o valor do item fica como está — é o que
        // mantém a isenção quando a linha é salva por uma tela sem a caixa.
        ...ipiParaGravar(formData),
        ...(peso ? { pesoKg: peso.toDecimalPlaces(3).toString() } : {}),
      },
    });

    await recalcularTotais(db, pedidoId);
    await registrarEdicao(db, pedido, usuarioId);
  } catch (erro) {
    return falhou(erro, formData);
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
async function gravarDefinirIpiDeTodosOsItens(
  pedidoId: string,
  formData: FormData,
): Promise<void> {
  const { organizacaoId, usuarioId, db } = await contexto();
  const pedido = await exigirAberto(db, pedidoId, organizacaoId);

  const ligado = formData.get("ligado") === "1";

  await db.pedidoItem.updateMany({ where: { pedidoId }, data: { comIpi: ligado } });
  await recalcularTotais(db, pedidoId);
  await registrarEdicao(db, pedido, usuarioId);

  revalidatePath(`/pedidos/${pedidoId}`);
}

async function gravarRemoverItem(pedidoId: string, formData: FormData): Promise<void> {
  const { organizacaoId, usuarioId, db } = await contexto();
  const pedido = await exigirAberto(db, pedidoId, organizacaoId);

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await db.pedidoItem.deleteMany({ where: { id: itemId, pedidoId } });
  await recalcularTotais(db, pedidoId);
  await registrarEdicao(db, pedido, usuarioId);

  revalidatePath(`/pedidos/${pedidoId}`);
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Troca o status e devolve a recusa, se houver — a barra de ações mostra o
 * motivo embaixo do botão clicado. Antes ele era lançado, e virava a página
 * de erro genérica.
 */
async function mudarStatus(
  pedidoId: string,
  status: StatusPedido,
  exigido: StatusPedido[],
  /** O que a transição grava junto. Hoje só o motivo, que viaja com o cancelar. */
  extra: { motivoCancelamento?: string } = {},
): Promise<EstadoFormulario> {
  try {
    await gravarStatus(pedidoId, status, exigido, extra);
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/pedidos");
  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

async function gravarStatus(
  pedidoId: string,
  status: StatusPedido,
  exigido: StatusPedido[],
  extra: { motivoCancelamento?: string },
) {
  const { organizacaoId, ehAdmin, db } = await contexto();

  const pedido = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    select: {
      status: true,
      fornecedorId: true,
      enviadoEm: true,
      _count: { select: { itens: true } },
    },
  });

  if (!pedido) throw new ErroParaUsuario(PEDIDO_SUMIU);
  if (!exigido.includes(pedido.status)) {
    throw new ErroParaUsuario(
      "O pedido mudou de situação enquanto esta tela estava aberta — alguém pode ter enviado, " +
        "cancelado ou reaberto em outra aba. Recarregue a página para ver como ele está agora.",
    );
  }

  if (status === "ENVIADO" && pedido._count.itens === 0) {
    throw new ErroParaUsuario("O pedido ainda não tem itens. Adicione pelo menos um antes de enviar.");
  }

  const enviadoEm =
    status === "ENVIADO" ? new Date() : status === "ABERTO" ? null : pedido.enviadoEm;

  await db.pedido.update({
    where: { id: pedidoId },
    data: {
      status,
      enviadoEm: status === "CANCELADO" ? undefined : enviadoEm,
      canceladoEm: status === "CANCELADO" ? new Date() : null,
      // O administrador que marca como enviado passou pela confirmação que
      // lista as edições dos prepostos: isso conta como conferir.
      ...(status === "ENVIADO" && ehAdmin ? { edicoesConferidasEm: new Date() } : {}),
      ...extra,
    },
  });
}

/** Marcar como enviado é o gatilho da comissão — e trava o pedido. */
export async function marcarEnviado(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  return mudarStatus(pedidoId, "ENVIADO", ["ABERTO"]);
}

export async function desmarcarEnvio(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  return mudarStatus(pedidoId, "ABERTO", ["ENVIADO"]);
}

/**
 * Cancelar estorna a comissão; o pedido continua existindo, com rastro.
 *
 * O motivo viaja JUNTO com o cancelamento porque é ali que ele se sabe — quem
 * acabou de ouvir "o cliente desistiu" é quem consegue escrever isso, e
 * perguntar depois é perguntar quando já esqueceu. Vem vazio quando ninguém
 * quis escrever, e um campo em branco não apaga o que já estava guardado: quem
 * reabre e cancela de novo tem o texto anterior como ponto de partida.
 */
export async function cancelarPedido(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const escrito = motivoDoFormulario(formData, "motivoCancelamento");

  /*
   * Campo em branco NÃO apaga o que já estava guardado.
   *
   * Quem reabre e cancela de novo encontra a caixa vazia — ela não vem
   * preenchida —, e gravar esse vazio por cima jogaria fora o motivo da
   * primeira vez sem ninguém ter pedido. Para limpar de propósito existe o
   * "Salvar motivo" na ficha, onde o campo mostra o texto atual e apagá-lo é
   * uma escolha visível.
   */
  return mudarStatus(
    pedidoId,
    "CANCELADO",
    ["ABERTO", "ENVIADO"],
    escrito ? { motivoCancelamento: escrito } : {},
  );
}

/**
 * Reabrir NÃO apaga o motivo, de propósito.
 *
 * Mesma escolha da proposta recusada: se o pedido cair de novo, o que foi
 * escrito da primeira vez é o ponto de partida. Enquanto ele estiver aberto o
 * motivo não aparece em lugar nenhum — só volta a ser lido se voltar a valer.
 */
export async function reabrirPedido(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  return mudarStatus(pedidoId, "ABERTO", ["CANCELADO"]);
}

/** Escrever o motivo depois, ou corrigir o que foi escrito na hora. */
export async function salvarMotivoCancelamento(
  pedidoId: string,
  formData: FormData,
): Promise<void> {
  const { organizacaoId, db } = await contexto();

  await db.pedido.updateMany({
    where: { id: pedidoId, organizacaoId, status: "CANCELADO" },
    data: { motivoCancelamento: motivoDoFormulario(formData, "motivoCancelamento") ?? "" },
  });

  revalidatePath("/pedidos");
  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
}

/* -------------------------------------------------------------------------- */
/* Envio por e-mail                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Manda o pedido por e-mail, da caixa de quem envia, e marca como enviado.
 *
 * As duas coisas andam juntas de propósito: o envio é o gatilho da comissão, e
 * um pedido que chegou à indústria mas ficou "aberto" no sistema seria uma
 * mentira no controle do mês.
 *
 * O e-mail vai primeiro. Se falhar, nada é marcado nem registrado — melhor o
 * usuário tentar de novo do que acreditar que enviou.
 *
 * Tudo o que o diálogo mandou é conferido de novo aqui: a conta tem de ser de
 * quem está logado, os contatos têm de ser DESTA indústria, e os anexos passam
 * pelas mesmas regras que o diálogo mostrou (`lib/envio-pedido.ts`).
 */
export async function enviarPedidoPorEmail(
  pedidoId: string,
  _estado: EstadoEnvio,
  formData: FormData,
): Promise<EstadoEnvio> {
  let aviso: string | undefined;

  try {
    const { organizacaoId, usuarioId, papel, ehAdmin, db } = await contexto();
    const pedido = await carregarPedidoParaPdf(pedidoId, organizacaoId, { usuarioId, papel });

    if (!pedido) throw new ErroParaUsuario(PEDIDO_SUMIU);
    if (pedido.status === "CANCELADO") {
      throw new ErroParaUsuario(
        "Este pedido está cancelado e não pode ser enviado. Para mandá-lo, clique antes em “Reabrir”.",
      );
    }
    if (pedido.dados.itens.length === 0) {
      throw new ErroParaUsuario("O pedido ainda não tem itens. Adicione pelo menos um antes de enviar.");
    }

    // Pedido mexido por preposto só sai depois de o administrador dizer que
    // conferiu. A caixa desabilitando o botão é conveniência; a regra é esta.
    if (
      ehAdmin &&
      formData.get("conferido") !== "on" &&
      (await edicoesDePrepostoPendentes(db, pedidoId)).length > 0
    ) {
      throw new ErroDeCampo(
        "conferido",
        "Um preposto mexeu neste pedido. Confira as alterações listadas acima e marque " +
          "“Conferi as alterações” para enviar.",
      );
    }

    const conta = await contaParaEnvio(db, usuarioId, String(formData.get("contaId") ?? ""));
    if (!conta) {
      throw new ErroDeCampo(
        "contaId",
        "Escolha de qual e-mail o pedido sai. Se a lista estiver vazia, cadastre seu e-mail em Configurações.",
      );
    }

    const contatoIds = formData.getAll("contatoId").map(String);
    const contatos = contatoIds.length
      ? await db.contatoFornecedor.findMany({
          where: { id: { in: contatoIds }, fornecedorId: pedido.fornecedorId },
          orderBy: { ordem: "asc" },
          select: { email: true },
        })
      : [];

    const avulsos = lerListaEmails(String(formData.get("emailsAvulsos") ?? ""));

    // O endereço do cliente vem do banco, não do formulário: a caixa marcada
    // diz "mande para ele", e quem ele é o cadastro sabe.
    const cliente = await db.cliente.findFirst({
      where: { pedidos: { some: { id: pedidoId } }, organizacaoId },
      select: { email: true, emailNfe: true },
    });

    const { para, cc } = montarDestinatarios({
      contatos: contatos.map((c) => c.email),
      avulsos,
      copiaCliente:
        formData.get("copiaCliente") === "on" ? (cliente?.email ?? cliente?.emailNfe) : null,
      copiaParaMim: formData.get("copiaParaMim") === "on" ? conta.email : null,
    });

    const assunto = String(formData.get("assunto") ?? "").trim();
    const corpo = String(formData.get("corpo") ?? "");

    const extras = formData
      .getAll("anexo")
      .filter((a): a is File => a instanceof File && a.size > 0);

    const arquivo = await gerarPdfPedido(pedido.dados);

    const problema = problemaNoEnvio({
      para,
      cc,
      assunto,
      anexos: [
        { nome: pedido.nomeArquivo, tamanho: arquivo.length },
        ...extras.map((a) => ({ nome: a.name, tamanho: a.size })),
      ],
      avulsos,
    });
    if (problema) {
      throw problema.campo
        ? new ErroDeCampo(problema.campo, problema.erro)
        : new ErroParaUsuario(problema.erro);
    }

    const anexos = [
      { nome: pedido.nomeArquivo, conteudo: arquivo, tipo: "application/pdf" },
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
        `Enviado, mas o servidor de e-mail recusou ${resultado.recusados.join(", ")}. ` +
        "Confira se esses endereços estão certos — quem foi recusado não recebeu.";
    }

    await db.envioPedido.create({
      data: {
        pedidoId,
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

    // Quem foi digitado à mão entra na lista, mas fora do grupo padrão: o
    // próximo pedido o oferece, sem passar a mandar para ele sem ninguém pedir.
    // Só o administrador: a lista é cadastro da indústria.
    if (ehAdmin && formData.get("salvarAvulsos") === "on" && avulsos.length > 0) {
      const ordem = await db.contatoFornecedor.count({ where: { fornecedorId: pedido.fornecedorId } });
      await db.contatoFornecedor.createMany({
        data: avulsos
          .filter((email) => para.includes(email))
          .map((email, i) => ({
            fornecedorId: pedido.fornecedorId,
            email: email.toLowerCase(),
            padrao: false,
            ordem: ordem + i,
          })),
        skipDuplicates: true,
      });
    }

    if (pedido.status === "ABERTO") {
      // Enviar é o gatilho da comissão. Não há nada a recalcular além disto:
      // o percentual já está congelado no pedido, e a apuração do mês é
      // derivada dos pedidos enviados na hora de exibir.
      await db.pedido.update({
        where: { id: pedidoId },
        data: { status: "ENVIADO", enviadoEm: new Date(), canceladoEm: null },
      });
    }

    // Enviado pelo administrador, o que havia de edição de preposto foi conferido.
    if (ehAdmin) {
      await db.pedido.update({ where: { id: pedidoId }, data: { edicoesConferidasEm: new Date() } });
    }
  } catch (erro) {
    // Os anexos e a senha não voltam; o resto do diálogo é estado da tela.
    return falhou(erro);
  }

  revalidatePath("/pedidos");
  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
  return { enviado: true, aviso };
}

/* -------------------------------------------------------------------------- */
/* Duplicar e excluir                                                         */
/* -------------------------------------------------------------------------- */

/** Atalho de recompra: copia o pedido inteiro como um novo, aberto. */
export async function duplicarPedido(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;
  try {
    destino = `/pedidos/${await copiarPedido(pedidoId)}`;
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/pedidos");
  redirect(destino);
}

async function copiarPedido(pedidoId: string): Promise<string> {
  const { organizacaoId, usuarioId, ehAdmin, db } = await contexto();

  const origem = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    include: { itens: { orderBy: { ordem: "asc" } } },
  });

  if (!origem) throw new ErroParaUsuario(PEDIDO_SUMIU);

  // A recompra é dividida com o mesmo preposto, na mesma fatia. A de um pedido
  // sem preposto (o importado do SICOV) segue a regra do pedido novo.
  const preposto = origem.representanteId
    ? {
        representanteId: origem.representanteId,
        comissaoPercentualPreposto: origem.comissaoPercentualPreposto,
      }
    : await prepostoDoNovoPedido(db, {
        organizacaoId,
        clienteId: origem.clienteId,
        usuarioId,
        ehAdmin,
      });

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
      criadoPorId: usuarioId,
      ...preposto,
      ipiPercentual: origem.ipiPercentual,
      comissaoPercentual: origem.comissaoPercentual,
      diaFechamentoComissao: origem.diaFechamentoComissao,
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
  return novo.id;
}

/**
 * Excluir é diferente de cancelar: apaga o registro.
 *
 * Só vale para pedido nunca enviado — o que já foi para a indústria deve ser
 * cancelado, para o histórico e o estorno da comissão ficarem rastreáveis.
 */
export async function excluirPedido(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await apagarPedido(pedidoId);
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/pedidos");
  redirect("/pedidos");
}

async function apagarPedido(pedidoId: string) {
  const { organizacaoId, db } = await contexto();

  const pedido = await db.pedido.findFirst({
    where: { id: pedidoId, organizacaoId },
    select: { enviadoEm: true, numero: true, fornecedorId: true },
  });

  if (!pedido) throw new ErroParaUsuario(PEDIDO_SUMIU);

  if (pedido.enviadoEm) {
    throw new ErroParaUsuario(
      "Este pedido já foi enviado à indústria e não pode ser apagado. Use “Cancelar”: ele fica " +
        "registrado como cancelado, e a comissão sai do mês.",
    );
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
}

/** `gravarRemoverItem`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function removerItem(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarRemoverItem(pedidoId, formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}

/** `gravarDefinirIpiDeTodosOsItens`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function definirIpiDeTodosOsItens(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarDefinirIpiDeTodosOsItens(pedidoId, formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}
