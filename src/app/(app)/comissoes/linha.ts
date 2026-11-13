/**
 * O que a linha de um pedido (ou de uma parcela) precisa para se desenhar na
 * apuração, e as ações que ela dispara.
 *
 * Arquivo próprio, sem `'use client'`: a página monta estes objetos no
 * servidor, e a linha, o painel do acerto e o "não pago" os leem no navegador.
 */

import type { EstadoFormulario } from "@/lib/erro-formulario";

export type LinhaPedido = {
  id: string;
  numero: number;
  status: string;
  /** Vazio quando o pedido não foi cancelado, ou quando ninguém escreveu. */
  motivoCancelamento: string;
  apelidoCliente: string;
  /** "AAAA-MM-DD", como o input date espera. */
  prazoEntrega: string | null;
  entregueEm: string | null;
  base: string;
  percentual: string;
  previsto: number;
  /** Já no padrão brasileiro; vazio quando ainda não houve acerto. */
  valorRecebido: string;
  percentualRecebido: string;
  recebido: number | null;

  /** Nome do preposto que leva a fatia. Nulo quando o pedido é da casa. */
  preposto: string | null;
  /** A cor dele (`corDoPreposto`). Só na tela do administrador. */
  corPreposto: string | null;
  /** A fatia do preposto, para o editor de parcelas mostrar a de cada uma. */
  percentualPreposto: string | null;
  /**
   * As duas fatias, do previsto e do já acertado.
   *
   * Chegam NULAS na tela do preposto — e isso não é a tela escondendo: a página
   * simplesmente não as coloca aqui, então elas não viajam para o navegador
   * dele. O que o escritório ganha não é assunto dele.
   */
  rateio: { preposto: number; escritorio: number } | null;
  rateioRecebido: { preposto: number; escritorio: number } | null;
  /** O acerto é do administrador: é ele quem recebe da indústria. */
  podeAcertar: boolean;

  /**
   * Preenchido quando a linha é UMA parcela do pedido. Aí base, previsto e
   * acerto acima são os dela. O mês dela é o `recebimento` ("AAAA-MM"): o do
   * vencimento, ou depois dele quando a indústria só paga após o faturamento.
   */
  parcela: { numero: number; total: number; vencimento: string; recebimento: string } | null;
  /** A venda sem IPI do pedido inteiro, "9765.00" — o que as parcelas dividem. */
  venda: string;
  prazoPagamento: string | null;
  /** "AAAA-MM-DD" de onde os dias das parcelas contam: a entrega prevista. */
  dataBaseParcelas: string;
  /**
   * O dia em que a indústria fecha o faturamento deste pedido ("30"); vazio,
   * paga no mês do vencimento. Vale para o pedido inteiro e para as parcelas.
   */
  fechamento: string;
  /** "AAAA-MM-DD" que decide o mês do pedido inteiro: a entrega, ou a criação. */
  dataCompetencia: string;
  /** As parcelas do pedido, para o editor reabrir com elas. */
  parcelasAtuais: { vencimento: string; valor: string }[];
  /**
   * Pode abrir o editor de parcelas: administrador, pedido não cancelado e sem
   * acerto lançado no pedido inteiro (a ação recusaria parcelar por cima dele).
   */
  podeParcelar: boolean;
  /**
   * Parcelaria, não fosse o acerto já lançado no pedido inteiro. A linha diz
   * isso em vez de esconder o caminho sem explicação.
   */
  parcelarExigeDesfazerAcerto: boolean;

  /**
   * O pagamento atrasado desta linha (`lib/adiamento.ts`): "não pago" sem
   * previsão, ou o mês para o qual foi adiado.
   */
  atraso: { naoPaga: boolean; para: string | null };
  /** "AAAA-MM" em que a comissão contaria sem atraso: o mês DELA. */
  mesNatural: string;
  /** "AAAA-MM" da tela em que a linha está, e o de hoje. */
  mesDaTela: string;
  hoje: string;
  /**
   * Onde a linha está:
   *   - `no-mes`: no mês em que conta (o caso de sempre, adiada ou não);
   *   - `adiada-daqui`: no mês dela, mas contando em outro — à vista, com o
   *     selo, e FORA da soma deste mês;
   *   - `pendente`: na lista "pendentes de meses anteriores" — não paga, de um
   *     mês que já passou.
   */
  lugar: "no-mes" | "adiada-daqui" | "pendente";
  /** O nome da indústria, na lista de pendentes — lá as indústrias se misturam. */
  industria: string | null;
};

/**
 * O lugar do mês no endereço que a página passa à linha (`enderecoDoMes`): a
 * linha é componente de cliente, e uma função `(mes) => endereço` não
 * atravessa do servidor para ela. Vai o endereço pronto, com esta marca.
 */
export const MARCADOR_DO_MES = "__MES__";

export type AcaoDaLinha = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/** As ações da linha, já presas ao pedido ou à parcela dela. */
export type AcoesDaLinha = {
  /** O acerto desta linha — do pedido inteiro, ou da parcela. */
  acerto: AcaoDaLinha;
  /** A data em que a indústria entregou: é do pedido, mesmo na linha da parcela. */
  entrega: AcaoDaLinha;
  naoPago: AcaoDaLinha;
  desmarcarNaoPago: AcaoDaLinha;
  parcelas: AcaoDaLinha;
  desfazerParcelas: AcaoDaLinha;
};
