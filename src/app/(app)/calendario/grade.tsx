"use client";

/**
 * A grade do mês: seis semanas de domingo a sábado, sempre — o calendário não
 * muda de altura ao trocar de mês (`semanasDoMes`).
 *
 * No celular a célula não tem largura para texto: as marcas viram pontinhos
 * coloridos, e o dia aberto mostra o resto. No computador aparecem até três
 * marcas com o título e um "+N" para o que sobrar.
 */

import type { EventoAgenda } from "@/lib/agenda";
import { dataPorExtenso, nomeDoFeriado, type DataIso } from "@/lib/calendario";

import type { CompromissoDaAgenda } from "./consulta";
import { Marca, aparencia } from "./marca";

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const VISIVEIS = 3;

export function GradeDoMes({
  semanas,
  competencia,
  hoje,
  porDia,
  aoAbrir,
}: {
  semanas: DataIso[][];
  competencia: string;
  hoje: DataIso;
  porDia: Map<DataIso, (EventoAgenda | CompromissoDaAgenda)[]>;
  aoAbrir: (dia: DataIso) => void;
}) {
  return (
    <div className="rounded-suave border border-filete overflow-hidden bg-filete">
      <div className="grid grid-cols-7 gap-px">
        {DIAS_DA_SEMANA.map((nome, i) => (
          <div
            key={nome}
            className={`bg-folha-2 px-2 py-2 text-mini font-semibold text-center sm:text-left ${
              i === 0 || i === 6 ? "text-tinta-3" : "text-tinta-2"
            }`}
          >
            {nome}
          </div>
        ))}

        {semanas.flat().map((dia, i) => {
          const doMes = dia.slice(0, 7) === competencia;
          const ehHoje = dia === hoje;
          const fimDeSemana = i % 7 === 0 || i % 7 === 6;
          const feriado = nomeDoFeriado(dia);
          const eventos = porDia.get(dia) ?? [];
          const sobra = eventos.length - VISIVEIS;
          const pendentesImportantes = eventos.filter(
            (e) =>
              e.situacao !== "concluido" &&
              (e.importancia === "URGENTE" || e.importancia === "IMPORTANTE" || e.situacao === "atrasada"),
          ).length;

          return (
            <button
              key={dia}
              type="button"
              onClick={() => aoAbrir(dia)}
              aria-label={`${dataPorExtenso(dia)}${eventos.length ? `, ${eventos.length} itens` : ""}${
                feriado ? `, ${feriado}` : ""
              }`}
              className={`group relative text-left min-h-16 sm:min-h-28 p-1.5 sm:p-2 flex flex-col gap-1
                transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-carimbo
                focus-visible:-outline-offset-2 ${
                  fimDeSemana || feriado ? "bg-folha-2/60 hover:bg-folha-2" : "bg-folha hover:bg-folha-2"
                } ${doMes ? "" : "opacity-45"}`}
            >
              <span className="flex items-center justify-between gap-1">
                <span
                  className={`grid place-items-center size-6 rounded-full text-mini font-semibold numerico ${
                    ehHoje ? "bg-carimbo text-white" : feriado ? "text-perigo" : "text-tinta-2"
                  }`}
                >
                  {Number(dia.slice(8))}
                </span>
                {pendentesImportantes > 0 && (
                  <span
                    className="hidden sm:inline-block size-1.5 rounded-full bg-perigo"
                    title={`${pendentesImportantes} pedindo atenção`}
                  />
                )}
              </span>

              {feriado && (
                <span className="hidden sm:block text-[10px] leading-tight text-perigo truncate">{feriado}</span>
              )}

              {/* Computador: as marcas com título. */}
              <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                {eventos.slice(0, VISIVEIS).map((e) => (
                  <Marca
                    key={e.chave}
                    evento={e}
                    compartilhado={"compartilhado" in e && e.compartilhado && !e.meu}
                  />
                ))}
                {sobra > 0 && (
                  <span className="text-[11px] font-medium text-tinta-3 group-hover:text-carimbo pl-1">
                    +{sobra} {sobra === 1 ? "outro" : "outros"}
                  </span>
                )}
              </span>

              {/* Celular: um ponto por evento, na cor dele. */}
              <span className="flex sm:hidden flex-wrap gap-0.5">
                {eventos.slice(0, 6).map((e) => (
                  <span
                    key={e.chave}
                    className="size-1.5 rounded-full"
                    style={{ background: aparencia(e).cor }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
