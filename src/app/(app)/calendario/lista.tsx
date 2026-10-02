"use client";

/**
 * Os próximos 30 dias como uma lista — a agenda lida de cima para baixo.
 *
 * É a visão que funciona no celular, onde a grade não tem largura para nomes,
 * e a que responde "o que tenho pela frente" sem precisar varrer semana a
 * semana. Dia sem nada não aparece.
 */

import { CalendarDays } from "lucide-react";

import { DIAS_DA_LISTA, type EventoAgenda } from "@/lib/agenda";
import { dataCurta, distanciaDeHoje, nomeDoFeriado, somarDias, type DataIso } from "@/lib/calendario";

import type { CompromissoDaAgenda } from "./consulta";
import { aparencia } from "./marca";

export function ListaDaAgenda({
  hoje,
  porDia,
  aoAbrir,
}: {
  hoje: DataIso;
  porDia: Map<DataIso, (EventoAgenda | CompromissoDaAgenda)[]>;
  aoAbrir: (dia: DataIso) => void;
}) {
  const dias = Array.from({ length: DIAS_DA_LISTA }, (_, i) => somarDias(hoje, i)).filter(
    (dia) => (porDia.get(dia)?.length ?? 0) > 0,
  );

  if (dias.length === 0) {
    return (
      <div className="text-center py-14 text-tinta-3">
        <CalendarDays size={28} className="mx-auto mb-3 opacity-60" aria-hidden="true" />
        Nada nos próximos {DIAS_DA_LISTA} dias.
      </div>
    );
  }

  return (
    <ol className="space-y-5">
      {dias.map((dia) => {
        const feriado = nomeDoFeriado(dia);
        return (
          <li key={dia}>
            <button
              type="button"
              onClick={() => aoAbrir(dia)}
              className="flex items-baseline gap-2 mb-2 cursor-pointer hover:text-carimbo transition-colors"
            >
              <span className="text-corpo font-semibold">{dataCurta(dia, hoje)}</span>
              <span className={`text-mini ${dia === hoje ? "text-carimbo font-semibold" : "text-tinta-3"}`}>
                {distanciaDeHoje(dia, hoje)}
              </span>
              {feriado && <span className="text-mini text-perigo">{feriado}</span>}
            </button>

            <ul className="space-y-1.5">
              {porDia.get(dia)!.map((evento) => {
                const { cor, icone: Icone, rotulo } = aparencia(evento);
                const resolvido = evento.situacao === "concluido" || evento.situacao === "paga";
                return (
                  <li key={evento.chave}>
                    <button
                      type="button"
                      onClick={() => aoAbrir(dia)}
                      className="w-full flex items-center gap-3 rounded-suave border border-filete border-l-[4px]
                        px-3 py-2 text-left hover:bg-folha-2 transition-colors cursor-pointer"
                      style={{ borderLeftColor: cor }}
                    >
                      <Icone size={15} style={{ color: cor }} className="shrink-0" aria-hidden="true" />
                      <span className="w-11 shrink-0 numerico text-mini text-tinta-2">
                        {evento.hora ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-corpo truncate ${resolvido ? "line-through text-tinta-3" : ""}`}
                        >
                          {evento.titulo}
                        </span>
                        <span className="block text-mini text-tinta-3 truncate">
                          {rotulo}
                          {evento.detalhe && ` · ${evento.detalhe}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
