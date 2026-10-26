"use server";

import { revalidatePath } from "next/cache";

import {
  ErroDeCampo,
  ErroParaUsuario,
  campoDaLinha,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { exigirNumero, exigirNumeroDe } from "@/lib/numero-br";
import { problemaNasParcelas } from "@/lib/parcelas";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";

export type { EstadoFormulario };

/** O mês chega pela URL da tela; fora do formato, alguém mexeu no endereço. */
const MES_INVALIDO =
  "Não deu para saber de qual mês é isto. Volte a Comissões pelo menu e tente de novo.";

const PEDIDO_SUMIU =
  "Este pedido não foi encontrado — ele pode ter sido excluído em outra tela. Recarregue a página.";

/**
 * Amostra não aparece em Comissões, mas o acerto e o parcelamento chegam por
 * id: recusar aqui é a defesa para quem montar a chamada à mão.
 */
const AMOSTRA_SEM_COMISSAO =
  "Pedido de amostra não tem comissão. Para lançar o acerto, desligue “Pedido de amostra” na ficha do pedido.";

/**
 * Data de coluna `date`, montada em UTC para o dia não escorregar pelo fuso.
 * Recusa a data que não existe ("2026-02-31"), que antes ia ao banco e voltava
 * como erro em inglês.
 */
function dataDoCampo(texto: string, campo: string, mensagem: string): Date {
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || data.toISOString().slice(0, 10) !== texto) {
    throw new ErroDeCampo(campo, mensagem);
  }
  return data;
}

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
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new ErroParaUsuario(MES_INVALIDO);

    const { organizacaoId, usuarioId, db } = await escopoAtual();

    // Campo vazio significa "não quero meta" — é uma opção legítima, e não
    // erro. Grava a linha vazia mesmo assim: ela interrompe a meta herdada.
    const valor =
      exigirNumero(formData, "meta", "a meta", { min: 0, exemplo: "4.000,00" }) ?? 0;

    const gravado = valor === 0 ? null : String(valor);

    await db.metaComissao.upsert({
      where: { usuarioId_competencia: { usuarioId, competencia } },
      create: { organizacaoId, usuarioId, competencia, valor: gravado },
      update: { valor: gravado },
    });
  } catch (erro) {
    return falhou(erro, formData);
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
 *
 * O botão "desfazer acerto" envia o mesmo formulário com `desfazer=sim`: o
 * valor e o % saem, seja o que for que esteja nos campos, e a data de entrega
 * fica como está nela.
 */
function lerAcerto(formData: FormData): {
  valor: string | null;
  percentual: string | null;
  entregueEm: Date | null;
} {
  const desfazer = formData.get("desfazer") === "sim";
  const valor = desfazer
    ? null
    : exigirNumero(formData, "valorRecebido", "o valor recebido", {
        min: 0,
        exemplo: "1.250,00",
      });
  const percentual = desfazer
    ? null
    : exigirNumero(formData, "comissaoPercentualRecebido", "o percentual", {
        min: 0,
        max: 100,
        exemplo: "5",
      });

  // Meio acerto não é acerto: sem os dois, a comissão recebida não existe. A
  // frase vai para o campo que ficou vazio.
  if ((valor === null) !== (percentual === null)) {
    throw new ErroDeCampo(
      valor === null ? "valorRecebido" : "comissaoPercentualRecebido",
      valor === null
        ? "Informe também o valor recebido — o acerto precisa dos dois. Para desfazer um acerto, use “desfazer acerto”."
        : "Informe também o percentual — o acerto precisa dos dois. Para desfazer um acerto, use “desfazer acerto”.",
    );
  }

  const entregaBruta = String(formData.get("entregueEm") ?? "").trim();
  const entregueEm =
    entregaBruta === ""
      ? null
      : dataDoCampo(
          entregaBruta,
          "entregueEm",
          "Esta data de entrega não é válida. Escolha a data de novo no calendário.",
        );

  return {
    valor: valor === null ? null : String(valor),
    percentual: percentual === null ? null : String(percentual),
    entregueEm,
  };
}

/**
 * Quando a indústria paga a comissão, como veio da escolha da tela
 * (`pagamento-comissao.tsx`): o dia do fechamento, `null` para o mês do
 * vencimento, ou `undefined` quando o formulário não traz a escolha — aí o
 * Prisma não mexe no que está gravado.
 */
function lerFechamento(formData: FormData): number | null | undefined {
  const pagamento = formData.get("pagamento");
  if (pagamento === null) return undefined;
  if (pagamento !== "seguinte") return null;
  return exigirNumero(formData, "diaFechamentoComissao", "o dia em que a indústria fecha o faturamento", {
    obrigatorio: true,
    inteiro: true,
    min: 1,
    max: 31,
    exemplo: "30",
  });
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
    // Acertar é do escritório: o preposto lê a comissão, não a lança.
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const acerto = lerAcerto(formData);
    const diaFechamento = lerFechamento(formData);

    if ((await db.parcelaRecebimento.count({ where: { pedidoId } })) > 0) {
      throw new ErroParaUsuario(
        "Este pedido foi parcelado: o acerto se lança em cada parcela, nas linhas logo abaixo. " +
          "Recarregue a página se elas não aparecerem.",
      );
    }

    const alvo = await db.pedido.findFirst({
      where: { id: pedidoId, organizacaoId },
      select: { amostra: true },
    });
    if (alvo?.amostra) throw new ErroParaUsuario(AMOSTRA_SEM_COMISSAO);

    const { count } = await db.pedido.updateMany({
      where: { id: pedidoId, organizacaoId },
      data: {
        valorRecebido: acerto.valor,
        comissaoPercentualRecebido: acerto.percentual,
        entregueEm: acerto.entregueEm,
        diaFechamentoComissao: diaFechamento,
      },
    });

    if (count === 0) throw new ErroParaUsuario(PEDIDO_SUMIU);
  } catch (erro) {
    return falhou(erro, formData);
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
    // Acertar é do escritório: o preposto lê a comissão, não a lança.
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const acerto = lerAcerto(formData);

    const parcela = await db.parcelaRecebimento.findFirst({
      where: { id: parcelaId, pedido: { organizacaoId } },
      select: { pedidoId: true },
    });
    if (!parcela) {
      throw new ErroParaUsuario(
        "Esta parcela não foi encontrada — o parcelamento pode ter sido refeito em outra tela. " +
          "Recarregue a página.",
      );
    }
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
    return falhou(erro, formData);
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
 *
 * Grava junto quando a indústria paga estas parcelas (`lerFechamento`). É do
 * pedido, que nasce com o da indústria e pode trocar.
 */
export async function salvarParcelas(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    // Acertar é do escritório: o preposto lê a comissão, não a lança.
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const vencimentos = formData.getAll("vencimento").map((v) => String(v).trim());
    const brutas = formData.getAll("base").map(String);

    /*
     * Linha por linha antes da soma: o erro de UMA parcela vai para a linha
     * dela. Antes, "não entendi o valor de uma das parcelas" não dizia qual —
     * e aparecia também para o campo em branco, que não é "não entendi".
     */
    const parcelas = vencimentos.map((vencimento, i) => {
      if (!vencimento) {
        throw new ErroDeCampo(campoDaLinha("vencimento", i), `Escolha a data da parcela ${i + 1}.`);
      }
      dataDoCampo(
        vencimento,
        campoDaLinha("vencimento", i),
        `A data da parcela ${i + 1} não é válida. Escolha de novo no calendário.`,
      );
      const base = exigirNumeroDe(brutas[i], campoDaLinha("base", i), `o valor da parcela ${i + 1}`, {
        obrigatorio: true,
        min: 0,
        exemplo: "1.250,00",
      });
      return { numero: i + 1, vencimento, base: base.toFixed(2) };
    });

    const diaFechamento = lerFechamento(formData);

    const pedido = await db.pedido.findFirst({
      where: { id: pedidoId, organizacaoId },
      select: {
        status: true,
        amostra: true,
        subtotalSemIpi: true,
        valorRecebido: true,
        comissaoPercentualRecebido: true,
      },
    });
    if (!pedido) throw new ErroParaUsuario(PEDIDO_SUMIU);
    if (pedido.amostra) throw new ErroParaUsuario(AMOSTRA_SEM_COMISSAO);
    if (pedido.status === "CANCELADO") {
      throw new ErroParaUsuario("Pedido cancelado não tem comissão a receber, e por isso não se parcela.");
    }

    if (pedido.valorRecebido !== null || pedido.comissaoPercentualRecebido !== null) {
      throw new ErroParaUsuario(
        "Este pedido já tem acerto lançado no valor inteiro. Para parcelar, apague antes o valor " +
          "recebido e o percentual do acerto e salve.",
      );
    }

    const problema = problemaNasParcelas(pedido.subtotalSemIpi.toString(), parcelas);
    if (problema) throw new ErroParaUsuario(problema);

    const acertadas = await db.parcelaRecebimento.findMany({
      where: { pedidoId, numero: { gt: parcelas.length }, valorRecebido: { not: null } },
      select: { numero: true },
    });
    if (acertadas.length > 0) {
      throw new ErroParaUsuario(
        `A parcela ${acertadas[0].numero} já tem acerto e não pode sair do parcelamento. ` +
          "Apague antes o acerto dela, ou mantenha a quantidade de parcelas.",
      );
    }

    const data = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

    // Uma escrita só, com as parcelas aninhadas: o Prisma a executa inteira ou
    // nada — nunca um pedido com metade das parcelas novas.
    await db.pedido.update({
      where: { id: pedidoId, organizacaoId },
      data: {
        diaFechamentoComissao: diaFechamento,
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
    return falhou(erro, formData);
  }

  revalidatePath("/comissoes");
  return {};
}

/**
 * Desfaz o parcelamento: o pedido volta a contar inteiro no mês da entrega —
 * ou no seguinte, se a indústria só paga depois de faturar: o fechamento é do
 * pedido, não das parcelas, e fica.
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
    // Acertar é do escritório: o preposto lê a comissão, não a lança.
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const acertada = await db.parcelaRecebimento.findFirst({
      where: { pedidoId, pedido: { organizacaoId }, valorRecebido: { not: null } },
      select: { numero: true },
    });
    if (acertada) {
      throw new ErroParaUsuario(
        `A parcela ${acertada.numero} já tem acerto lançado. Apague os acertos das parcelas ` +
          "antes de desfazer o parcelamento — senão o que a indústria pagou se perderia.",
      );
    }

    await db.parcelaRecebimento.deleteMany({ where: { pedidoId, pedido: { organizacaoId } } });
  } catch (erro) {
    return falhou(erro);
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
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) throw new ErroParaUsuario(MES_INVALIDO);

    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const texto = (campo: string) => {
      const bruto = formData.get(campo);
      return typeof bruto === "string" ? bruto.trim() : "";
    };

    const valor = exigirNumero(formData, "valor", "o valor pago", {
      obrigatorio: true,
      min: 0,
      exemplo: "1.250,00",
    });
    if (valor === 0) throw new ErroDeCampo("valor", "O valor pago precisa ser maior que zero.");

    if (!texto("pagoEm")) throw new ErroDeCampo("pagoEm", "Escolha a data em que o pagamento foi feito.");
    const pagoEm = dataDoCampo(
      texto("pagoEm"),
      "pagoEm",
      "Esta data de pagamento não é válida. Escolha a data de novo no calendário.",
    );

    const preposto = await db.usuario.findFirst({
      where: { id: prepostoId, organizacaoId, papel: "REPRESENTANTE" },
      select: { id: true },
    });
    if (!preposto) {
      throw new ErroParaUsuario(
        "Este preposto não foi encontrado — ele pode ter sido removido. Recarregue a página.",
      );
    }

    await db.repassePreposto.create({
      data: {
        organizacaoId,
        prepostoId,
        competencia,
        valor: valor.toFixed(2),
        pagoEm,
        observacao: texto("observacao") || null,
      },
    });
  } catch (erro) {
    return falhou(erro, formData);
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
    if (count === 0) {
      throw new ErroParaUsuario(
        "Este pagamento não foi encontrado — ele pode já ter sido excluído. Recarregue a página.",
      );
    }
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/comissoes");
  return {};
}
