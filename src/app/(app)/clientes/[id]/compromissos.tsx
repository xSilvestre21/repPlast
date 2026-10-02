/**
 * Os compromissos ligados a este cliente, na ficha dele.
 *
 * Mostra os que vêm pela frente e os que passaram sem ser feitos — o que já
 * foi resolvido mora no calendário. O botão abre o calendário com o formulário
 * pronto e o cliente já escolhido.
 */

import { CalendarDays, ChevronRight, Plus, Users } from "lucide-react";
import Link from "next/link";

import { BotaoLink, Cartao, Placa } from "@/components/ui";
import type { EventoAgenda, Importancia } from "@/lib/agenda";
import { dataCurta, distanciaDeHoje, type DataIso } from "@/lib/calendario";

import { aparencia } from "../../calendario/marca";

export interface CompromissoDoCliente {
  id: string;
  titulo: string;
  dia: DataIso;
  hora: string | null;
  importancia: Importancia;
  compartilhado: boolean;
  meu: boolean;
  autor: string;
}

export function SecaoCompromissos({
  clienteId,
  compromissos,
  hoje,
}: {
  clienteId: string;
  compromissos: CompromissoDoCliente[];
  hoje: DataIso;
}) {
  return (
    <Cartao className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="titulo-regra">
          <Placa icone={CalendarDays} tom="mar" pequena />
          <h2 className="text-realce font-semibold">Compromissos</h2>
        </div>
        <BotaoLink
          href={`/calendario?novo=1&cliente=${clienteId}`}
          variante="secundaria"
          tamanho="compacto"
          icone={Plus}
        >
          Marcar compromisso
        </BotaoLink>
      </div>

      {compromissos.length === 0 ? (
        <p className="text-corpo text-tinta-3">Nenhum compromisso pela frente com este cliente.</p>
      ) : (
        <ul className="space-y-2">
          {compromissos.map((c) => {
            const evento: EventoAgenda = {
              chave: c.id,
              tipo: "compromisso",
              dia: c.dia,
              titulo: c.titulo,
              importancia: c.importancia,
            };
            const { cor, icone: Icone, rotulo } = aparencia(evento);
            const atrasado = c.dia < hoje;

            return (
              <li key={c.id}>
                <Link
                  href={`/calendario?mes=${c.dia.slice(0, 7)}`}
                  className="flex items-center gap-3 rounded-suave border border-filete border-l-[4px] px-3 py-2
                    hover:bg-folha-2 transition-colors group"
                  style={{ borderLeftColor: cor }}
                >
                  <Icone size={15} style={{ color: cor }} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-corpo truncate">{c.titulo}</span>
                    <span className="block text-mini text-tinta-3">
                      {rotulo} · {dataCurta(c.dia, hoje)}
                      {c.hora && ` às ${c.hora}`} ·{" "}
                      <span className={atrasado ? "text-perigo font-semibold" : ""}>
                        {distanciaDeHoje(c.dia, hoje)}
                      </span>
                      {c.compartilhado && !c.meu && (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <Users size={10} aria-hidden="true" />
                          {c.autor}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-tinta-3 group-hover:text-carimbo"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}
