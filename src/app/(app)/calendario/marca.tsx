/**
 * Como cada evento aparece: a cor e o ícone do tipo, e o destaque da importância.
 *
 * As cores são tokens. Urgente e atrasado usam o `--perigo`, porque são de
 * fato alerta — e levam ícone junto, nunca só a cor. Os tipos automáticos usam
 * a paleta categórica dos gráficos (`--grafico-*`), validada nos dois temas.
 */

import {
  AlertTriangle,
  CalendarClock,
  Coins,
  Flag,
  PhoneCall,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { EventoAgenda, TipoEvento } from "@/lib/agenda";

export interface Aparencia {
  cor: string;
  icone: LucideIcon;
  /** Para leitor de tela e para a legenda: "Urgente", "Entrega atrasada". */
  rotulo: string;
}

export function aparencia(evento: EventoAgenda): Aparencia {
  if (evento.tipo === "compromisso") {
    if (evento.importancia === "URGENTE") {
      return { cor: "var(--perigo)", icone: AlertTriangle, rotulo: "Urgente" };
    }
    if (evento.importancia === "IMPORTANTE") {
      return { cor: "var(--grafico-4)", icone: Flag, rotulo: "Importante" };
    }
    return { cor: "var(--tinta-3)", icone: CalendarClock, rotulo: "Compromisso" };
  }

  if (evento.tipo === "entrega") {
    return evento.situacao === "atrasada"
      ? { cor: "var(--perigo)", icone: Truck, rotulo: "Entrega atrasada" }
      : { cor: "var(--grafico-3)", icone: Truck, rotulo: "Entrega" };
  }

  if (evento.tipo === "parcela") {
    return { cor: "var(--grafico-1)", icone: Coins, rotulo: "Parcela" };
  }

  return { cor: "var(--grafico-2)", icone: PhoneCall, rotulo: "Cliente sumido" };
}

/**
 * Os tipos que se ligam e desligam no calendário.
 *
 * Cada filtro leva o ícone e a cor do tipo — e por isso ele É a legenda desses
 * tipos: não há uma segunda lista repetindo "Entrega", "Parcela" embaixo da
 * grade.
 */
export const TIPOS_FILTRAVEIS: {
  tipo: TipoEvento;
  rotulo: string;
  cor: string;
  icone: LucideIcon;
}[] = [
  { tipo: "compromisso", rotulo: "Compromissos", cor: "var(--tinta-2)", icone: CalendarClock },
  { tipo: "entrega", rotulo: "Entregas", cor: "var(--grafico-3)", icone: Truck },
  { tipo: "parcela", rotulo: "Parcelas", cor: "var(--grafico-1)", icone: Coins },
  { tipo: "sumido", rotulo: "Clientes sumidos", cor: "var(--grafico-2)", icone: PhoneCall },
];

/**
 * O que os filtros não explicam: os destaques de atenção. Esses não se
 * desligam — são estados de um compromisso ou de uma entrega, não tipos.
 */
export const LEGENDA_DE_DESTAQUES: { chave: string; rotulo: string; cor: string; icone: LucideIcon }[] = [
  { chave: "urgente", rotulo: "Urgente", cor: "var(--perigo)", icone: AlertTriangle },
  { chave: "importante", rotulo: "Importante", cor: "var(--grafico-4)", icone: Flag },
  { chave: "atrasada", rotulo: "Entrega atrasada", cor: "var(--perigo)", icone: Truck },
];

const resolvido = (e: EventoAgenda) => e.situacao === "concluido" || e.situacao === "paga";

/**
 * A marca compacta de um evento — a pílula dentro do dia da grade.
 *
 * O fundo é a cor do tipo bem diluída e a borda esquerda é a cor cheia: dá para
 * ler a grade de longe pela cor e de perto pelo texto. O que já foi resolvido
 * (feito, pago) fica riscado e apagado — continua lá, mas não pede atenção.
 */
export function Marca({
  evento,
  compartilhado = false,
}: {
  evento: EventoAgenda;
  compartilhado?: boolean;
}) {
  const { cor, icone: Icone, rotulo } = aparencia(evento);
  const feito = resolvido(evento);

  return (
    <span
      className={`flex items-center gap-1 min-w-0 rounded-[6px] pl-1.5 pr-1 py-0.5 text-[11px] leading-tight
        border-l-[3px] ${feito ? "opacity-55 line-through" : ""}`}
      style={{
        borderLeftColor: cor,
        background: `color-mix(in oklab, ${cor} 13%, transparent)`,
      }}
      title={`${rotulo}: ${evento.titulo}`}
    >
      <Icone size={10} strokeWidth={2.5} style={{ color: cor }} className="shrink-0" aria-hidden="true" />
      {evento.hora && <span className="numerico text-tinta-3 shrink-0">{evento.hora}</span>}
      <span className="truncate text-tinta">{evento.titulo}</span>
      {compartilhado && <Users size={9} className="shrink-0 text-tinta-3" aria-label="compartilhado" />}
    </span>
  );
}
