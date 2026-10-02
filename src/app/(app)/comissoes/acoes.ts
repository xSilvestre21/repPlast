"use server";

import { revalidatePath } from "next/cache";

import { lerNumeroBr } from "@/lib/numero-br";
import { problemaNasParcelas } from "@/lib/parcelas";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

/**
 * Define a meta de comissão de quem está logado, do mês da tela em diante.
 *
 * Grava uma linha para ESTE mês e não toca nas outras: os meses anteriores
 * continuam medidos contra a meta que tinham, e os seguintes herdam esta até a
 * próxima troca (ver `metaVigente`). É de cada pessoa — o RLS de
 * `meta_comissao` nem deixa gravar a de outra.
 *
 * Não entra em cálculo nenhum: serve para acompanhar o próprio alvo e
 * comemorar ao bater.
 */
export async function definirMeta(
  competencia: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return { erro: "Mês inválido." };

    const { organizacaoId, usuarioId, db } = await escopoAtual();
    const bruto = formData.get("meta");
    const texto = typeof bruto === "string" ? bruto.trim() : "";

    // Campo vazio significa "não quero meta" — é uma opção legítima, e não
    // erro. Grava a linha vazia mesmo assim: ela interrompe a meta herdada.
    const valor = texto === "" ? 0 : lerNumeroBr(texto);

    if (valor === null) return { erro: "Não entendi esse valor." };
    if (valor < 0) return { erro: "A meta não pode ser negativa." };

    const gravado = valor === 0 ? null : String(valor);

    await db.metaComissao.upsert({
      where: { usuarioId_competencia: { usuarioId, competencia } },
      create: { organizacaoId, usuarioId, competencia, valor: gravado },
      update: { valor: gravado },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar a meta." };
  }

  revalidatePath("/comissoes");
  revalidatePath("/");
  return {};
}

/**
 * Lê o acerto do formulário: valor recebido, percentual e data de entrega.
 *
 * NADA aqui é deduzido. O valor e o percentual são os dois digitados, porque
 * pagar uma base menor e pagar a base cheia com percentual menor são acordos
 * diferentes que chegam ao mesmo dinheiro — e só quem negociou sabe qual foi.
 * Um sistema que escolhesse por conta própria estaria inventando o motivo.
 *
 * O mesmo formulário serve ao pedido inteiro e a cada parcela, então a leitura
 * é uma só — as duas formas de acertar não podem aceitar coisas diferentes.
 */
function lerAcerto(
  formData: FormData,
):
  | { erro: string }
  | { valor: string | null; percentual: string | null; entregueEm: Date | null } {
  const texto = (campo: string) => {
    const bruto = formData.get(campo);
    return typeof bruto === "string" ? bruto.trim() : "";
  };

  const valorBruto = texto("valorRecebido");
  const percentualBruto = texto("comissaoPercentualRecebido");
  const entregaBruta = texto("entregueEm");

  const valor = valorBruto === "" ? null : lerNumeroBr(valorBruto);
  const percentual = percentualBruto === "" ? null : lerNumeroBr(percentualBruto);

  if (valorBruto !== "" && valor === null) return { erro: "Não entendi o valor recebido." };
  if (percentualBruto !== "" && percentual === null) return { erro: "Não entendi o percentual." };

  if (valor !== null && valor < 0) return { erro: "O valor recebido não pode ser negativo." };
  if (percentual !== null && (percentual < 0 || percentual > 100)) {
    return { erro: "O percentual precisa ficar entre 0 e 100." };
  }

  // Meio acerto não é acerto: sem os dois, a comissão recebida não existe.
  if ((valor === null) !== (percentual === null)) {
    return { erro: "Informe o valor recebido e o percentual — ou deixe os dois em branco." };
  }

  let entregueEm: Date | null = null;
  if (entregaBruta !== "") {
    // `date` sem hora: monta em UTC para o dia não escorregar pelo fuso.
    const [ano, mes, dia] = entregaBruta.split("-").map(Number);
    if (!ano || !mes || !dia) return { erro: "Data de entrega inválida." };
    entregueEm = new Date(Date.UTC(ano, mes - 1, dia));
  }

  return {
    valor: valor === null ? null : String(valor),
    percentual: percentual === null ? null : String(percentual),
    entregueEm,
  };
}

/**
 * Lança o acerto da comissão de um pedido: o que a indústria pagou de fato.
 *
 * Os campos se apagam juntos: deixar tudo em branco desfaz o acerto e o pedido
 * volta a contar só como previsto. No pedido parcelado o acerto é de cada
 * parcela (`salvarAcertoParcela`), e este caminho recusa — um acerto no pedido
 * inteiro ficaria por baixo das parcelas sem contar em lugar nenhum.
 */
export async function salvarAcerto(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await escopoAtual();

    const acerto = lerAcerto(formData);
    if ("erro" in acerto) return acerto;

    if ((await db.parcelaRecebimento.count({ where: { pedidoId } })) > 0) {
      return { erro: "Este pedido é parcelado: lance o acerto em cada parcela." };
    }

    const { count } = await db.pedido.updateMany({
      where: { id: pedidoId, organizacaoId },
      data: {
        valorRecebido: acerto.valor,
        comissaoPercentualRecebido: acerto.percentual,
        entregueEm: acerto.entregueEm,
      },
    });

    if (count === 0) return { erro: "Pedido não encontrado." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar o acerto." };
  }

  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

/**
 * O acerto de UMA parcela — o que a indústria pagou quando o cliente pagou
 * aquela parte.
 *
 * A data de entrega continua sendo do pedido (a mercadoria chegou uma vez só),
 * então ela é gravada nele, venha do formulário de qual parcela vier.
 */
export async function salvarAcertoParcela(
  parcelaId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let pedidoId = "";

  try {
    const { organizacaoId, db } = await escopoAtual();

    const acerto = lerAcerto(formData);
    if ("erro" in acerto) return acerto;

    const parcela = await db.parcelaRecebimento.findFirst({
      where: { id: parcelaId, pedido: { organizacaoId } },
      select: { pedidoId: true },
    });
    if (!parcela) return { erro: "Parcela não encontrada." };
    pedidoId = parcela.pedidoId;

    await db.parcelaRecebimento.update({
      where: { id: parcelaId },
      data: {
        valorRecebido: acerto.valor,
        comissaoPercentualRecebido: acerto.percentual,
      },
    });

    await db.pedido.updateMany({
      where: { id: pedidoId, organizacaoId },
      data: { entregueEm: acerto.entregueEm },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar o acerto." };
  }

  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

/**
 * Grava o parcelamento do recebimento de um pedido.
 *
 * Chega como listas paralelas — `vencimento` e `base`, uma entrada por
 * parcela, na ordem. A soma tem de fechar no centavo com a venda
 * (`problemaNasParcelas`, a MESMA conta que o editor faz enquanto se digita).
 *
 * Atualiza pelo NÚMERO da parcela em vez de apagar e recriar: a parcela que já
 * foi paga mantém o acerto quando as seguintes mudam — é o "recebi menos este
 * mês, joga o resto para frente". Só não deixa SUMIR uma parcela acertada, que
 * levaria dinheiro já conferido junto.
 *
 * Recusa o pedido que já tem acerto lançado nele inteiro: parcelar por cima
 * esconderia esse acerto, que deixaria de contar sem ninguém ter desfeito.
 */
export async function salvarParcelas(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await escopoAtual();

    const vencimentos = formData.getAll("vencimento").map((v) => String(v).trim());
    const bases = formData.getAll("base").map((v) => lerNumeroBr(String(v)));

    if (bases.some((b) => b === null)) return { erro: "Não entendi o valor de uma das parcelas." };

    const parcelas = vencimentos.map((vencimento, i) => ({
      numero: i + 1,
      vencimento,
      base: (bases[i] as number).toFixed(2),
    }));

    const pedido = await db.pedido.findFirst({
      where: { id: pedidoId, organizacaoId },
      select: {
        status: true,
        subtotalSemIpi: true,
        valorRecebido: true,
        comissaoPercentualRecebido: true,
      },
    });
    if (!pedido) return { erro: "Pedido não encontrado." };
    if (pedido.status === "CANCELADO") return { erro: "Pedido cancelado não se parcela." };

    if (pedido.valorRecebido !== null || pedido.comissaoPercentualRecebido !== null) {
      return { erro: "Este pedido já tem acerto lançado. Desfaça o acerto antes de parcelar." };
    }

    const problema = problemaNasParcelas(pedido.subtotalSemIpi.toString(), parcelas);
    if (problema) return { erro: problema };

    const acertadas = await db.parcelaRecebimento.findMany({
      where: { pedidoId, numero: { gt: parcelas.length }, valorRecebido: { not: null } },
      select: { numero: true },
    });
    if (acertadas.length > 0) {
      return {
        erro: `A parcela ${acertadas[0].numero} já tem acerto e não pode sair. Desfaça o acerto dela antes.`,
      };
    }

    const data = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

    // Uma escrita só, com as parcelas aninhadas: o Prisma a executa inteira ou
    // nada — nunca um pedido com metade das parcelas novas.
    await db.pedido.update({
      where: { id: pedidoId, organizacaoId },
      data: {
        parcelas: {
          deleteMany: { numero: { gt: parcelas.length } },
          upsert: parcelas.map((p) => ({
            where: { pedidoId_numero: { pedidoId, numero: p.numero } },
            create: { numero: p.numero, vencimento: data(p.vencimento), base: p.base },
            update: { vencimento: data(p.vencimento), base: p.base },
          })),
        },
      },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar as parcelas." };
  }

  revalidatePath("/comissoes");
  return {};
}

/**
 * Desfaz o parcelamento: o pedido volta a contar inteiro no mês da entrega.
 *
 * Só sem acerto em nenhuma parcela — apagar uma parcela paga apagaria o
 * registro do que a indústria pagou.
 */
export async function desfazerParcelas(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await escopoAtual();

    const acertada = await db.parcelaRecebimento.findFirst({
      where: { pedidoId, pedido: { organizacaoId }, valorRecebido: { not: null } },
      select: { numero: true },
    });
    if (acertada) {
      return {
        erro: `A parcela ${acertada.numero} já tem acerto. Desfaça os acertos antes de desfazer o parcelamento.`,
      };
    }

    await db.parcelaRecebimento.deleteMany({ where: { pedidoId, pedido: { organizacaoId } } });
  } catch (erro) {
    return {
      erro: erro instanceof Error ? erro.message : "Não foi possível desfazer o parcelamento.",
    };
  }

  revalidatePath("/comissoes");
  return {};
}

/**
 * Registra um pagamento do escritório ao preposto, pela comissão de um mês.
 *
 * Só o administrador lança — quem paga é o escritório. O RLS de
 * `repasse_preposto` recusaria a escrita do preposto de qualquer forma; o
 * `exigirAdmin` existe para a mensagem ser legível em vez de um erro do banco.
 *
 * Pagar mais do que o devido é permitido de propósito: adiantamento existe, e
 * o saldo negativo passa para o mês seguinte como crédito do escritório.
 */
export async function registrarRepasse(
  prepostoId: string,
  competencia: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return { erro: "Mês inválido." };

    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const texto = (campo: string) => {
      const bruto = formData.get(campo);
      return typeof bruto === "string" ? bruto.trim() : "";
    };

    const valor = lerNumeroBr(texto("valor"));
    if (valor === null) return { erro: "Não entendi o valor pago." };
    if (valor <= 0) return { erro: "O valor pago precisa ser maior que zero." };

    // `date` sem hora: monta em UTC para o dia não escorregar pelo fuso.
    const [ano, mes, dia] = texto("pagoEm").split("-").map(Number);
    if (!ano || !mes || !dia) return { erro: "Informe a data do pagamento." };

    const preposto = await db.usuario.findFirst({
      where: { id: prepostoId, organizacaoId, papel: "REPRESENTANTE" },
      select: { id: true },
    });
    if (!preposto) return { erro: "Preposto não encontrado." };

    await db.repassePreposto.create({
      data: {
        organizacaoId,
        prepostoId,
        competencia,
        valor: valor.toFixed(2),
        pagoEm: new Date(Date.UTC(ano, mes - 1, dia)),
        observacao: texto("observacao") || null,
      },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível registrar o pagamento." };
  }

  revalidatePath("/comissoes");
  return {};
}

/** Desfaz um pagamento lançado errado. Excluir, e não lançar outro ao contrário. */
export async function excluirRepasse(
  repasseId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const { count } = await db.repassePreposto.deleteMany({
      where: { id: repasseId, organizacaoId },
    });
    if (count === 0) return { erro: "Pagamento não encontrado." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível excluir o pagamento." };
  }

  revalidatePath("/comissoes");
  return {};
}
