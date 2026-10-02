"use client";

/**
 * A janela de aviso que abre no Painel quando há compromisso URGENTE pendente
 * (`deveAvisar`). O importante não chega aqui: fica na faixa "Hoje".
 *
 * Abre sozinha ao carregar — é o "logo de cara" que o usuário pediu. Fechar no
 * X só a esconde até a próxima vez que o Painel abrir; para ela parar de
 * voltar, cada compromisso precisa de uma resposta: "feito" (resolvido) ou
 * "lembrar depois" (cala por duas horas, só para quem clicou).
 */

import { AlertTriangle, BellOff, CalendarDays, Check, Flag, Users } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Dialogo } from "@/components/dialogo";
import { MensagemErro } from "@/components/ui";
import type { Importancia } from "@/lib/agenda";
import { distanciaDeHoje, type DataIso } from "@/lib/calendario";

import { adiarAviso, concluirCompromisso, type EstadoFormulario } from "./calendario/acoes";

export interface CompromissoAvisado {
  id: string;
  titulo: string;
  dia: DataIso;
  hora: string | null;
  importancia: Importancia;
  meu: boolean;
  autor: string;
  cliente: string | null;
}

export function AvisoCompromissos({
  compromissos,
  hoje,
}: {
  compromissos: CompromissoAvisado[];
  hoje: DataIso;
}) {
  const [aberto, setAberto] = useState(true);

  // Respondido o último, a janela fecha sozinha — não fica aberta e vazia.
  const visivel = aberto && compromissos.length > 0;

  return (
    <Dialogo
      aberto={visivel}
      aoFechar={() => setAberto(false)}
      titulo={compromissos.length === 1 ? "Um compromisso pede atenção" : `${compromissos.length} compromissos pedem atenção`}
      descricao="Marque como feito, ou peça para ser lembrado mais tarde."
    >
      <ul className="space-y-2.5">
        {compromissos.map((c) => (
          <Item key={c.id} compromisso={c} hoje={hoje} />
        ))}
      </ul>

      <Link
        href="/calendario"
        className="mt-5 inline-flex items-center gap-1.5 text-mini font-semibold text-carimbo hover:underline"
      >
        <CalendarDays size={13} aria-hidden="true" />
        Abrir o calendário
      </Link>
    </Dialogo>
  );
}

function Item({ compromisso: c, hoje }: { compromisso: CompromissoAvisado; hoje: DataIso }) {
  const urgente = c.importancia === "URGENTE";
  const cor = urgente ? "var(--perigo)" : "var(--grafico-4)";
  const Icone = urgente ? AlertTriangle : Flag;
  const quando = distanciaDeHoje(c.dia, hoje);
  const atrasado = c.dia < hoje;

  const [estadoFeito, feito, concluindo] = useActionState<EstadoFormulario, FormData>(
    concluirCompromisso.bind(null, c.id, true),
    {},
  );
  const [estadoAdiar, adiar, adiando] = useActionState<EstadoFormulario, FormData>(
    adiarAviso.bind(null, c.id),
    {},
  );

  return (
    <li
      className="rounded-suave border border-filete border-l-[4px] p-3"
      style={{ borderLeftColor: cor, background: `color-mix(in oklab, ${cor} 8%, transparent)` }}
    >
      <div className="flex items-start gap-2.5">
        <Icone size={17} strokeWidth={2.25} style={{ color: cor }} className="shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-corpo font-semibold">{c.titulo}</div>
          <div className="text-mini text-tinta-2 flex flex-wrap gap-x-2">
            <span className={atrasado ? "text-perigo font-semibold" : ""}>
              {urgente ? "Urgente" : "Importante"} · {quando}
              {c.hora && ` às ${c.hora}`}
            </span>
            {c.cliente && <span>{c.cliente}</span>}
            {!c.meu && (
              <span className="inline-flex items-center gap-1">
                <Users size={10} aria-hidden="true" />
                marcado por {c.autor}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3 pl-7">
        {/* Concluir é do autor; o colega só cala o próprio aviso. */}
        {c.meu && (
          <form action={feito}>
            <button
              type="submit"
              disabled={concluindo}
              className="inline-flex items-center gap-1.5 rounded-full bg-verde px-3 py-1.5 text-mini font-semibold
                text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              <Check size={13} strokeWidth={2.5} aria-hidden="true" />
              Feito
            </button>
          </form>
        )}
        <form action={adiar}>
          <button
            type="submit"
            disabled={adiando}
            className="inline-flex items-center gap-1.5 rounded-full border border-filete bg-folha px-3 py-1.5
              text-mini font-semibold text-tinta-2 hover:text-tinta hover:bg-folha-2 transition-colors
              cursor-pointer disabled:opacity-50"
          >
            <BellOff size={13} aria-hidden="true" />
            Lembrar em 2 horas
          </button>
        </form>
      </div>
      <MensagemErro>{estadoFeito.erro ?? estadoAdiar.erro}</MensagemErro>
    </li>
  );
}
