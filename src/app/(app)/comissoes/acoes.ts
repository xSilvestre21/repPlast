"use server";

import { revalidatePath } from "next/cache";

import {
  ErroDeCampo,
  ErroParaUsuario,
  campoDaLinha,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { ehCompetencia, nomeDaCompetencia, problemaNoAdiamento } from "@/lib/adiamento";
import { exigirNumero, exigirNumeroDe } from "@/lib/numero-br";
import { mesDoRecebimento, problemaNasParcelas } from "@/lib/parcelas";
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
 * Lê o acerto do formulário: valor recebido e percentual.
 *
 * NADA aqui é deduzido. O valor e o percentual são os dois digitados, porque
 * pagar uma base menor e pagar a base cheia com percentual menor são acordos
 * diferentes que chegam ao mesmo dinheiro — e só quem negociou sabe qual foi.
 * Um sistema que escolhesse por conta própria estaria inventando o motivo.
 *
 * O mesmo formulário serve ao pedido inteiro e a cada parcela, então a leitura
 * é uma só — as duas formas de acertar não podem aceitar coisas diferentes.
 *
 * Os dois vêm juntos ou não vem nenhum: meio acerto não é acerto. Os dois em
 * branco deixam o pedido sem acerto — é como se troca só o mês em que a
 * indústria paga (`lerFechamento`), que vai no mesmo formulário.
 *
 * A data de entrega NÃO vem mais aqui: tem o formulário dela (`salvarEntrega`),
 * porque a mercadoria chega antes do dinheiro e ela não salvava sem o valor.
 *
 * O botão "Desfazer acerto" envia o mesmo formulário com `desfazer=sim`: o
 * valor e o % saem, seja o que for que esteja nos campos.
 */
function lerAcerto(formData: FormData): { valor: string | null; percentual: string | null } {
  if (formData.get("desfazer") === "sim") return { valor: null, percentual: null };

  const valor = exigirNumero(formData, "valorRecebido", "o valor da venda", {
    min: 0,
    exemplo: "1.250,00",
  });
  const percentual = exigirNumero(formData, "comissaoPercentualRecebido", "o percentual", {
    min: 0,
    max: 100,
    exemplo: "5",
  });

  // A frase vai para o campo que ficou vazio.
  if ((valor === null) !== (percentual === null)) {
    throw new ErroDeCampo(
      valor === null ? "valorRecebido" : "comissaoPercentualRecebido",
      valor === null
        ? "Informe o valor da venda sobre a qual a indústria pagou, como 1.250,00 — ou toque em " +
          "“Pagou o valor todo”. Se ela ainda não pagou, escolha “Ainda não foi pago”."
        : "Informe também o percentual da comissão, como 5 — o acerto precisa dos dois.",
    );
  }

  return {
    valor: valor === null ? null : String(valor),
    percentual: percentual === null ? null : String(percentual),
  };
}

/**
 * "Em que mês a indústria pagou?" — o campo que o acerto mostra quando a linha
 * estava marcada como não paga ou adiada.
 *
 * `undefined`: o formulário não trouxe o campo, e o mês gravado fica como está.
 * `null`: pagou no próprio mês da comissão, e o adiamento sai.
 */
function lerContaEm(formData: FormData, natural: string): string | null | undefined {
  const bruto = formData.get("contaEm");
  if (bruto === null) return undefined;

  const mes = String(bruto).trim();
  if (mes === "" || mes === natural) return null;

  if (!ehCompetencia(mes) || mes < natural) {
    throw new ErroDeCampo(
      "contaEm",
      `Escolha ${nomeDaCompetencia(natural)}, que é o mês desta comissão, ou um mês depois dele.`,
    );
  }
  return mes;
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

function iso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Registra o dia em que a indústria entregou a mercadoria — e só isso.
 *
 * É controle de entrega: serve para mostrar se a indústria cumpriu o prazo.
 * Não mexe no mês nem no valor da comissão, e por isso não depende de acerto
 * nenhum. Era um campo do formulário do acerto, que recusava salvar a data sem
 * o valor recebido — e a mercadoria quase sempre chega antes do dinheiro.
 *
 * Em branco, apaga a data: a entrega lançada no pedido errado se desfaz assim.
 */
export async function salvarEntrega(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const bruta = String(formData.get("entregueEm") ?? "").trim();
    const entregueEm =
      bruta === ""
        ? null
        : dataDoCampo(
            bruta,
            "entregueEm",
            "Esta data de entrega não é válida. Escolha a data de novo no calendário.",
          );

    const { count } = await db.pedido.updateMany({
      where: { id: pedidoId, organizacaoId },
      data: { entregueEm },
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
 * Lança o acerto da comissão de um pedido: o que a indústria pagou de fato.
 *
 * No pedido parcelado o acerto é de cada parcela (`salvarAcertoParcela`), e
 * este caminho recusa — um acerto no pedido inteiro ficaria por baixo das
 * parcelas sem contar em lugar nenhum.
 *
 * Lançar o acerto tira o "não pago": a indústria pagou. O mês para o qual o
 * pagamento foi adiado FICA (ou vem do formulário, em `contaEm`): é nele que o
 * dinheiro entrou. Só cai quando o fechamento escolhido aqui empurra o mês da
 * comissão para além dele — adiado para antes do próprio mês não existe.
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
      select: {
        amostra: true,
        prazoEntrega: true,
        criadoEm: true,
        diaFechamentoComissao: true,
        comissaoAdiadaPara: true,
      },
    });
    if (!alvo) throw new ErroParaUsuario(PEDIDO_SUMIU);
    if (alvo.amostra) throw new ErroParaUsuario(AMOSTRA_SEM_COMISSAO);

    const natural = mesDoRecebimento(
      iso(alvo.prazoEntrega ?? alvo.criadoEm),
      diaFechamento === undefined ? alvo.diaFechamentoComissao : diaFechamento,
    );
    const contaEm = lerContaEm(formData, natural);
    const adiadaPara = contaEm === undefined ? alvo.comissaoAdiadaPara : contaEm;

    const { count } = await db.pedido.updateMany({
      where: { id: pedidoId, organizacaoId },
      data: {
        valorRecebido: acerto.valor,
        comissaoPercentualRecebido: acerto.percentual,
        diaFechamentoComissao: diaFechamento,
        // Desfazer o acerto não desfaz o atraso: são dois botões.
        ...(acerto.valor === null ? {} : { comissaoNaoPaga: false }),
        comissaoAdiadaPara: adiadaPara && adiadaPara > natural ? adiadaPara : null,
      },
    });

    if (count === 0) throw new ErroParaUsuario(PEDIDO_SUMIU);
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath("/comissoes");
  revalidatePath("/");
  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}

const PARCELA_SUMIU =
  "Esta parcela não foi encontrada — o parcelamento pode ter sido refeito em outra tela. " +
  "Recarregue a página.";

/**
 * O acerto de UMA parcela — o que a indústria pagou quando o cliente pagou
 * aquela parte. Com o atraso dela, como no pedido inteiro (`salvarAcerto`).
 */
export async function salvarAcertoParcela(
  parcelaId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    // Acertar é do escritório: o preposto lê a comissão, não a lança.
    await exigirAdmin();
    const { organizacaoId, db } = await escopoAtual();

    const acerto = lerAcerto(formData);

    const parcela = await db.parcelaRecebimento.findFirst({
      where: { id: parcelaId, pedido: { organizacaoId } },
      select: {
        vencimento: true,
        comissaoAdiadaPara: true,
        pedido: { select: { diaFechamentoComissao: true } },
      },
    });
    if (!parcela) throw new ErroParaUsuario(PARCELA_SUMIU);

    const natural = mesDoRecebimento(iso(parcela.vencimento), parcela.pedido.diaFechamentoComissao);
    const contaEm = lerContaEm(formData, natural);

    await db.parcelaRecebimento.update({
      where: { id: parcelaId },
      data: {
        valorRecebido: acerto.valor,
        comissaoPercentualRecebido: acerto.percentual,
        ...(acerto.valor === null ? {} : { comissaoNaoPaga: false }),
        ...(contaEm === undefined ? {} : { comissaoAdiadaPara: contaEm }),
      },
    });
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath("/comissoes");
  revalidatePath("/");
  return {};
}

/* -------------------------------------------------------------------------- */
/* Pagamento atrasado                                                         */
/* -------------------------------------------------------------------------- */

/** A linha que atrasou: o pedido inteiro, ou uma parcela dele. */
type Alvo = { pedido: string } | { parcela: string };

/**
 * O que a escolha "ainda não foi pago" grava: sem previsão, ou o mês.
 *
 * `quando` é o rádio da tela (`nao-pago.tsx`); `mes`, o seletor, que só vale
 * com "mes". Adiar é para depois do mês da comissão (`problemaNoAdiamento`).
 */
function lerAtraso(formData: FormData, natural: string): { naoPaga: boolean; para: string | null } {
  if (formData.get("quando") !== "mes") return { naoPaga: true, para: null };

  const mes = String(formData.get("mes") ?? "").trim();
  const problema = problemaNoAdiamento(natural, mes);
  if (problema) throw new ErroDeCampo("mes", problema);

  return { naoPaga: false, para: mes };
}

/**
 * Grava (ou tira, com `atraso` nulo) o atraso de um pedido ou de uma parcela.
 *
 * Uma função para os dois alvos e as duas direções: as recusas são as mesmas, e
 * quatro cópias delas divergiriam na primeira frase corrigida.
 *
 * Marcar exige a linha SEM acerto: "não pago" com valor recebido é contradição,
 * e mudar de mês um dinheiro já conferido pede que a pessoa desfaça o acerto de
 * propósito — é o mesmo cuidado de parcelar por cima dele. Tirar o atraso não
 * exige: é como se volta ao mês da comissão um acerto lançado no mês errado.
 */
async function gravarAtraso(alvo: Alvo, formData: FormData | null): Promise<void> {
  // Como o acerto, é do escritório: é ele quem recebe da indústria.
  await exigirAdmin();
  const { organizacaoId, db } = await escopoAtual();

  if ("parcela" in alvo) {
    const parcela = await db.parcelaRecebimento.findFirst({
      where: { id: alvo.parcela, pedido: { organizacaoId } },
      select: {
        numero: true,
        vencimento: true,
        valorRecebido: true,
        pedido: { select: { status: true, diaFechamentoComissao: true } },
      },
    });
    if (!parcela) throw new ErroParaUsuario(PARCELA_SUMIU);

    if (formData === null) {
      await db.parcelaRecebimento.update({
        where: { id: alvo.parcela },
        data: { comissaoNaoPaga: false, comissaoAdiadaPara: null },
      });
      return;
    }

    if (parcela.pedido.status === "CANCELADO") throw new ErroParaUsuario(CANCELADO_SEM_ATRASO);
    if (parcela.valorRecebido !== null) {
      throw new ErroParaUsuario(
        `A parcela ${parcela.numero} já tem acerto lançado. Para marcá-la como não paga, use ` +
          "“Desfazer acerto” antes, em “Recebi esta parcela”.",
      );
    }

    const atraso = lerAtraso(
      formData,
      mesDoRecebimento(iso(parcela.vencimento), parcela.pedido.diaFechamentoComissao),
    );
    await db.parcelaRecebimento.update({
      where: { id: alvo.parcela },
      data: { comissaoNaoPaga: atraso.naoPaga, comissaoAdiadaPara: atraso.para },
    });
    return;
  }

  const pedido = await db.pedido.findFirst({
    where: { id: alvo.pedido, organizacaoId },
    select: {
      status: true,
      amostra: true,
      prazoEntrega: true,
      criadoEm: true,
      diaFechamentoComissao: true,
      valorRecebido: true,
    },
  });
  if (!pedido) throw new ErroParaUsuario(PEDIDO_SUMIU);

  if (formData === null) {
    await db.pedido.updateMany({
      where: { id: alvo.pedido, organizacaoId },
      data: { comissaoNaoPaga: false, comissaoAdiadaPara: null },
    });
    return;
  }

  if (pedido.amostra) throw new ErroParaUsuario(AMOSTRA_SEM_COMISSAO);
  if (pedido.status === "CANCELADO") throw new ErroParaUsuario(CANCELADO_SEM_ATRASO);
  if ((await db.parcelaRecebimento.count({ where: { pedidoId: alvo.pedido } })) > 0) {
    throw new ErroParaUsuario(
      "Este pedido foi parcelado: marque como não paga a parcela que atrasou, nas linhas logo " +
        "abaixo. Recarregue a página se elas não aparecerem.",
    );
  }
  if (pedido.valorRecebido !== null) {
    throw new ErroParaUsuario(
      "Este pedido já tem acerto lançado. Para marcá-lo como não pago, use “Desfazer acerto” " +
        "antes, em “Recebi”.",
    );
  }

  const atraso = lerAtraso(
    formData,
    mesDoRecebimento(iso(pedido.prazoEntrega ?? pedido.criadoEm), pedido.diaFechamentoComissao),
  );
  await db.pedido.updateMany({
    where: { id: alvo.pedido, organizacaoId },
    data: { comissaoNaoPaga: atraso.naoPaga, comissaoAdiadaPara: atraso.para },
  });
}

const CANCELADO_SEM_ATRASO =
  "Pedido cancelado não tem comissão a receber, e por isso não há pagamento a esperar.";

function atrasoGravado() {
  revalidatePath("/comissoes");
  // O painel inicial e os gráficos somam por mês, e o mês acabou de mudar.
  revalidatePath("/");
  revalidatePath("/graficos");
}

/**
 * Marca o pedido como não pago: a indústria atrasou a comissão.
 *
 * Sem previsão, ele continua no mês dele, a acertar, e aparece nos meses
 * seguintes como pendente. Com o mês, a comissão passa a contar nele — e o
 * pedido continua à vista no mês em que foi entregue, com o selo, fora da soma.
 */
export async function marcarNaoPago(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAtraso({ pedido: pedidoId }, formData);
  } catch (erro) {
    return falhou(erro, formData);
  }
  atrasoGravado();
  return {};
}

/** O mesmo, para UMA parcela: as outras continuam onde estão. */
export async function marcarParcelaNaoPaga(
  parcelaId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAtraso({ parcela: parcelaId }, formData);
  } catch (erro) {
    return falhou(erro, formData);
  }
  atrasoGravado();
  return {};
}

/** Tira o "não pago" e o adiamento: a comissão volta ao mês dela. */
export async function desmarcarNaoPago(
  pedidoId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAtraso({ pedido: pedidoId }, null);
  } catch (erro) {
    return falhou(erro);
  }
  atrasoGravado();
  return {};
}

export async function desmarcarParcelaNaoPaga(
  parcelaId: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAtraso({ parcela: parcelaId }, null);
  } catch (erro) {
    return falhou(erro);
  }
  atrasoGravado();
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
 *
 * Parcelar tira o atraso marcado no pedido inteiro ("não pago", ou adiado): daqui
 * em diante quem diz o mês é cada parcela. O atraso de uma parcela fica, a não
 * ser que a data nova dela já passe do mês para o qual tinha sido adiada.
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
        diaFechamentoComissao: true,
      },
    });
    if (!pedido) throw new ErroParaUsuario(PEDIDO_SUMIU);
    if (pedido.amostra) throw new ErroParaUsuario(AMOSTRA_SEM_COMISSAO);
    if (pedido.status === "CANCELADO") {
      throw new ErroParaUsuario("Pedido cancelado não tem comissão a receber, e por isso não se parcela.");
    }

    if (pedido.valorRecebido !== null || pedido.comissaoPercentualRecebido !== null) {
      throw new ErroParaUsuario(
        "Este pedido já tem acerto lançado no valor inteiro. Para parcelar, use “Desfazer acerto” " +
          "antes, em “Recebi”.",
      );
    }

    const problema = problemaNasParcelas(pedido.subtotalSemIpi.toString(), parcelas);
    if (problema) throw new ErroParaUsuario(problema);

    const acertadas = await db.parcelaRecebimento.findMany({
      where: { pedidoId, numero: { gt: parcelas.length }, valorRecebido: { not: null } },
      select: { numero: true },
    });
    if (acertadas.length > 0) {
      const n = acertadas[0].numero;
      throw new ErroParaUsuario(
        `A parcela ${n} já tem acerto e não pode sair do parcelamento. Mantenha a quantidade de ` +
          `parcelas, ou apague antes o acerto dela: abra a parcela ${n} pelo botão “Ver acerto”, ` +
          "toque em “Recebi esta parcela” e clique em “Desfazer acerto”.",
      );
    }

    // A parcela adiada cuja data nova já alcança o mês do adiamento volta ao
    // normal: "adiada" para o próprio mês, ou para antes dele, não existe.
    const fechamento = diaFechamento === undefined ? pedido.diaFechamentoComissao : diaFechamento;
    const adiadas = await db.parcelaRecebimento.findMany({
      where: { pedidoId, comissaoAdiadaPara: { not: null } },
      select: { numero: true, comissaoAdiadaPara: true },
    });
    const voltamAoNormal = new Set(
      adiadas
        .filter((a) => {
          const nova = parcelas[a.numero - 1];
          return nova && mesDoRecebimento(nova.vencimento, fechamento) >= a.comissaoAdiadaPara!;
        })
        .map((a) => a.numero),
    );

    const data = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

    // Uma escrita só, com as parcelas aninhadas: o Prisma a executa inteira ou
    // nada — nunca um pedido com metade das parcelas novas.
    await db.pedido.update({
      where: { id: pedidoId, organizacaoId },
      data: {
        diaFechamentoComissao: diaFechamento,
        comissaoNaoPaga: false,
        comissaoAdiadaPara: null,
        parcelas: {
          deleteMany: { numero: { gt: parcelas.length } },
          upsert: parcelas.map((p) => ({
            where: { pedidoId_numero: { pedidoId, numero: p.numero } },
            create: { numero: p.numero, vencimento: data(p.vencimento), base: p.base },
            update: {
              vencimento: data(p.vencimento),
              base: p.base,
              ...(voltamAoNormal.has(p.numero) ? { comissaoAdiadaPara: null } : {}),
            },
          })),
        },
      },
    });
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath("/comissoes");
  revalidatePath("/");
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

    /*
     * A tela já avisa antes (`impedimentoDoDesfazer`); isto é para quando ela
     * estava desatualizada. A frase diz onde fica o “Desfazer acerto” — dentro
     * de “Recebi esta parcela” —, que era o que ninguém achava.
     */
    const acertadas = await db.parcelaRecebimento.findMany({
      where: { pedidoId, pedido: { organizacaoId }, valorRecebido: { not: null } },
      select: { numero: true },
      orderBy: { numero: "asc" },
    });
    if (acertadas.length > 0) {
      const uma = acertadas.length === 1;
      const numeros = acertadas.map((a) => a.numero);
      const lista =
        numeros.length === 1 ? `${numeros[0]}` : `${numeros.slice(0, -1).join(", ")} e ${numeros.at(-1)}`;
      throw new ErroParaUsuario(
        `${uma ? `A parcela ${lista} já tem` : `As parcelas ${lista} já têm`} acerto lançado, e ` +
          "desfazer o parcelamento apagaria o registro do que a indústria pagou. Apague antes " +
          `${uma ? "esse acerto" : "esses acertos"}: abra ${uma ? "a parcela" : "cada uma"} pelo ` +
          "botão “Ver acerto”, toque em “Recebi esta parcela” e clique em “Desfazer acerto”.",
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
