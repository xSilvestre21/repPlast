/**
 * A agenda da aba Calendário: compromissos, avisos e os eventos que o sistema
 * já conhece (entregas, parcelas, clientes sumidos).
 *
 * As contas de data são as de `calendario.ts` — o mesmo módulo do campo de
 * data do pedido, com feriados e dias úteis. Aqui fica só o que é da agenda.
 *
 * O dia é sempre texto "aaaa-mm-dd" (`DataIso`). As colunas de data do banco
 * (`prazoEntrega`, `vencimento`, a data do compromisso) são `date` sem hora,
 * gravadas na meia-noite UTC; lidas como `Date` local, metade do país veria o
 * dia 1º cair no dia 31. Instantes de verdade (a última compra) viram dia pelo
 * relógio de quem olha, com `hojeIso`.
 */

import { hojeIso, somarDias, type DataIso } from "./calendario";

export type Importancia = "NORMAL" | "IMPORTANTE" | "URGENTE";

/** Coluna `date` (meia-noite UTC) para "aaaa-mm-dd". */
export function diaDaColuna(data: Date): DataIso {
  return data.toISOString().slice(0, 10);
}

/** "aaaa-mm-dd" para o valor que a coluna `date` espera. */
export function colunaDoDia(dia: DataIso): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

/* -------------------------------------------------------------------------- */
/* O aviso no Painel                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Se um compromisso abre a janela de aviso no Painel.
 *
 * Só o URGENTE, a partir da véspera — é o que dá tempo de agir. O usuário
 * decidiu assim: a janela que interrompe a tela é para o que não pode esperar.
 * O importante fica em destaque na faixa "Hoje" do Painel e no calendário, sem
 * janela; o normal, só no calendário.
 *
 * "A partir" de propósito: o urgente que passou sem ser marcado como feito
 * continua avisando. Sumir no dia seguinte seria esquecer justamente o que não
 * foi resolvido.
 *
 * "Lembrar depois" cala o aviso até `adiadoAte` (um instante, em ms).
 */
export function deveAvisar(
  compromisso: { importancia: Importancia; dia: DataIso; concluido: boolean },
  hoje: DataIso,
  agora: number,
  adiadoAte: number | null,
): boolean {
  if (compromisso.concluido) return false;
  if (adiadoAte !== null && adiadoAte > agora) return false;

  return compromisso.importancia === "URGENTE" && compromisso.dia <= somarDias(hoje, 1);
}

/** Quantos dias a visão em lista do calendário mostra, a partir de hoje. */
export const DIAS_DA_LISTA = 30;

/** Quanto tempo o "lembrar depois" cala o aviso. */
export const ADIAMENTO_MS = 2 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Eventos: o que o calendário desenha                                        */
/* -------------------------------------------------------------------------- */

export type TipoEvento = "compromisso" | "entrega" | "parcela" | "sumido";

export interface EventoAgenda {
  /** Único entre todos os tipos: "tipo:id". */
  chave: string;
  tipo: TipoEvento;
  dia: DataIso;
  titulo: string;
  detalhe?: string;
  href?: string;
  /** "14:30"; ausente quando é o dia inteiro ou não tem hora. */
  hora?: string;
  importancia?: Importancia;
  /** O que pede destaque: entrega atrasada, parcela já paga, compromisso feito. */
  situacao?: "atrasada" | "paga" | "concluido";
}

/** Quantos dias sem comprar fazem o cliente "sumir" — o corte padrão do Painel. */
export const DIAS_PARA_SUMIR = 60;

/**
 * A entrega prometida de um pedido.
 *
 * Atrasada é a que já passou do prazo sem entrega registrada — a régua de
 * `pontualidadeEntrega`, que só sabe comparar quando há as duas datas.
 */
export function eventoDeEntrega(
  pedido: {
    id: string;
    numero: number;
    cliente: string;
    prazoEntrega: Date;
    entregueEm: Date | null;
  },
  hoje: DataIso,
): EventoAgenda {
  const dia = diaDaColuna(pedido.prazoEntrega);
  return {
    chave: `entrega:${pedido.id}`,
    tipo: "entrega",
    dia,
    titulo: `Entrega #${pedido.numero}`,
    detalhe: pedido.entregueEm ? `${pedido.cliente} · entregue` : pedido.cliente,
    href: `/pedidos/${pedido.id}`,
    situacao: !pedido.entregueEm && dia < hoje ? "atrasada" : undefined,
  };
}

/** O vencimento de uma parcela de recebimento — quando a indústria deve pagar. */
export function eventoDeParcela(parcela: {
  id: string;
  numero: number;
  total: number;
  vencimento: Date;
  pago: boolean;
  pedidoNumero: number;
  cliente: string;
}): EventoAgenda {
  const dia = diaDaColuna(parcela.vencimento);
  return {
    chave: `parcela:${parcela.id}`,
    tipo: "parcela",
    dia,
    titulo: `Parcela ${parcela.numero}/${parcela.total} · #${parcela.pedidoNumero}`,
    detalhe: parcela.cliente,
    // A parcela se acerta na apuração do mês em que vence.
    href: `/comissoes?mes=${dia.slice(0, 7)}`,
    situacao: parcela.pago ? "paga" : undefined,
  };
}

/**
 * O dia em que o cliente completa `DIAS_PARA_SUMIR` sem comprar — o lembrete
 * de ligar. A última compra é um instante: vira dia no relógio de quem olha.
 */
export function eventoDeSumido(cliente: {
  id: string;
  apelido: string;
  ultimaCompra: Date;
}): EventoAgenda {
  return {
    chave: `sumido:${cliente.id}`,
    tipo: "sumido",
    dia: somarDias(hojeIso(cliente.ultimaCompra), DIAS_PARA_SUMIR),
    titulo: `Ligar para ${cliente.apelido}`,
    detalhe: `${DIAS_PARA_SUMIR} dias sem comprar`,
    href: `/clientes/${cliente.id}`,
  };
}

const PESO_IMPORTANCIA: Record<Importancia, number> = { URGENTE: 0, IMPORTANTE: 1, NORMAL: 2 };
const PESO_TIPO: Record<TipoEvento, number> = { compromisso: 0, entrega: 1, parcela: 2, sumido: 3 };

/**
 * A ordem dentro de um dia: o que pede atenção primeiro.
 *
 * Atrasado e urgente no topo, depois por hora (o "dia inteiro" vem antes),
 * depois o tipo. Feito e pago descem para o fim — já foram resolvidos.
 */
export function ordenarDoDia(eventos: EventoAgenda[]): EventoAgenda[] {
  const resolvido = (e: EventoAgenda) => e.situacao === "concluido" || e.situacao === "paga";

  return [...eventos].sort(
    (a, b) =>
      Number(resolvido(a)) - Number(resolvido(b)) ||
      Number(b.situacao === "atrasada") - Number(a.situacao === "atrasada") ||
      PESO_IMPORTANCIA[a.importancia ?? "NORMAL"] - PESO_IMPORTANCIA[b.importancia ?? "NORMAL"] ||
      (a.hora ?? "").localeCompare(b.hora ?? "") ||
      PESO_TIPO[a.tipo] - PESO_TIPO[b.tipo] ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}

/** Agrupa por dia, cada dia já ordenado. */
export function porDia(eventos: EventoAgenda[]): Map<DataIso, EventoAgenda[]> {
  const grupos = Map.groupBy(eventos, (e) => e.dia);
  return new Map([...grupos].map(([dia, lista]) => [dia, ordenarDoDia(lista)]));
}
