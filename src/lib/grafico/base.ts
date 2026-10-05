/**
 * O que a página de gráficos manda ao navegador — uma vez só.
 *
 * Cada cartão tem o próprio seletor de período, e trocar de período não pode
 * custar uma navegação: o servidor manda 24 meses de itens já achatados e o
 * navegador agrega o recorte que cada cartão pede (`agregar.ts`).
 *
 * Todo valor em dinheiro viaja em CENTAVOS inteiros. Somar centenas de
 * `number` em reais acumula erro de ponto flutuante — R$ 0,01 de diferença
 * entre o gráfico e a tela de Comissões já é o tipo de bug que ninguém acha.
 *
 * E viaja já pela visão de quem olha: o administrador recebe o líquido do
 * escritório (e o bruto, para conferir), o preposto recebe só a fatia dele. O
 * corte é feito no servidor ao montar isto; o navegador do preposto não tem o
 * número do escritório nem escondido.
 */

export interface ItemGrafico {
  pedidoId: string;
  numero: number;
  /** "AAAA-MM" — a da parcela, quando o item é uma. */
  competencia: string;
  clienteId: string;
  cliente: string;
  fornecedorId: string;
  fornecedor: string;
  /** Só na visão do administrador do plano Plus. */
  prepostoId: string | null;
  /** Previsto de quem olha, em centavos. */
  previsto: number;
  /** Recebido de quem olha, em centavos; `null` enquanto não há acerto. */
  recebido: number | null;
  /** O que a indústria paga ao escritório — só na visão do administrador. */
  bruto: number | null;
  brutoRecebido: number | null;
}

export interface CanceladoGrafico {
  pedidoId: string;
  numero: number;
  cliente: string;
  fornecedor: string;
  /** Mês do CANCELAMENTO — "o que eu perdi neste mês". */
  competencia: string;
  /** Venda sem IPI, em centavos. */
  valor: number;
  motivo: string | null;
}

export type SituacaoEntregaGrafico = "no_prazo" | "atrasado" | "adiantado";

export interface OrcamentoGrafico {
  id: string;
  numero: number;
  /** O apelido do cliente, ou o nome de quem ainda não é cliente. */
  cliente: string;
  /** Mês em que a proposta foi CRIADA. */
  competencia: string;
  virou: boolean;
  /** O pedido em que ela virou, para o clique levar direto a ele. */
  pedidoId: string | null;
}

export interface EntregaGrafico {
  pedidoId: string;
  numero: number;
  cliente: string;
  /** Mês da entrega prometida. */
  competencia: string;
  situacao: SituacaoEntregaGrafico;
}

export interface BaseDosGraficos {
  /** O mês de referência da página. */
  competencia: string;
  /** Os 24 meses carregados, do mais antigo até `competencia`. */
  competencias: string[];
  /** "set/26" e "Setembro de 2026" de cada competência carregada. */
  rotulos: Record<string, { curto: string; longo: string }>;
  ehAdmin: boolean;
  /** Há gráfico por preposto (admin do plano Plus). */
  comPreposto: boolean;

  itens: ItemGrafico[];
  /** Meta vigente em cada competência, em centavos; ausente = sem meta. */
  metas: Record<string, number>;
  cancelados: CanceladoGrafico[];
  /** Cada proposta, para o cartão poder abrir a que foi clicada. */
  orcamentos: OrcamentoGrafico[];
  /** Uma por pedido com entrega registrada, no mês da entrega prometida. */
  entregas: EntregaGrafico[];
  clientes: {
    id: string;
    apelido: string;
    /** Instante em ms; `null` quando nunca comprou. */
    ultimaCompra: number | null;
    /** Total do último pedido, em centavos. */
    ultimoValor: number | null;
  }[];
  prepostos: { id: string; nome: string; cor: string }[];
  /** Um instante só para a página inteira — "dias sem comprar" depende dele. */
  agora: number;
}
