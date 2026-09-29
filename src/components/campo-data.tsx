"use client";

/**
 * Campo de data com calendário próprio, no lugar do `<input type="date">`.
 *
 * O nativo muda de cara a cada navegador, fala a língua do sistema e não
 * aceita a paleta do app — no Windows escuro, abria um calendário branco no
 * meio da tela. Este mostra a data como se fala ("Sex., 09 de out. de 2026 ·
 * em 10 dias"), abre um mês inteiro em português e traz atalhos para os prazos
 * de sempre, que é como o prazo de entrega é combinado com a indústria.
 *
 * No formulário continua saindo `aaaa-mm-dd` num input escondido: a Server
 * Action do outro lado não muda. As contas são as de `lib/calendario.ts`.
 *
 * Teclado: setas andam pelos dias, PageUp/PageDown trocam o mês, Enter
 * escolhe, Esc fecha e devolve o foco ao campo.
 */

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  dataCurta,
  dataPorExtenso,
  dataValida,
  distanciaDeHoje,
  ehFimDeSemana,
  hojeIso,
  inicioDoMes,
  nomeDoMes,
  semanasDoMes,
  somarDias,
  somarMeses,
  type DataIso,
} from "@/lib/calendario";

import { CLASSE_CONTROLE, RodapeCampo, Rotulo } from "./ui";

const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOMES_DOS_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Espaço que o calendário aberto ocupa — abaixo dele não cabendo, abre para cima. */
const ALTURA_CALENDARIO = 400;

export function CampoData({
  name,
  rotulo,
  defaultValue = "",
  dica,
  atalhos = [7, 15, 30, 45],
}: {
  name: string;
  rotulo: string;
  defaultValue?: string;
  dica?: string;
  /** Prazos em dias corridos a partir de hoje, oferecidos como botões. */
  atalhos?: number[];
}) {
  const [valor, setValor] = useState(dataValida(defaultValue) ? defaultValue : "");
  const [aberto, setAberto] = useState(false);
  const [paraCima, setParaCima] = useState(false);
  /** O dia com o foco do teclado; o mês mostrado é sempre o dele. */
  const [foco, setFoco] = useState<DataIso>(valor || hojeIso());

  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const idCalendario = useId();

  const hoje = hojeIso();

  function abrir() {
    const caixa = botaoRef.current?.getBoundingClientRect();
    if (caixa) {
      const abaixo = window.innerHeight - caixa.bottom;
      setParaCima(abaixo < ALTURA_CALENDARIO && caixa.top > abaixo);
    }
    setFoco(valor || hoje);
    setAberto(true);
  }

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) botaoRef.current?.focus();
  }

  function escolher(iso: DataIso) {
    setValor(iso);
    fechar();
  }

  /* Clique fora fecha, sem roubar o foco de onde a pessoa clicou. */
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  /* O foco do teclado acompanha o dia destacado, inclusive ao trocar de mês. */
  useEffect(() => {
    if (!aberto) return;
    gradeRef.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
  }, [aberto, foco]);

  function aoTeclarNaGrade(evento: React.KeyboardEvent) {
    const passos: Record<string, () => DataIso> = {
      ArrowLeft: () => somarDias(foco, -1),
      ArrowRight: () => somarDias(foco, 1),
      ArrowUp: () => somarDias(foco, -7),
      ArrowDown: () => somarDias(foco, 7),
      PageUp: () => somarMeses(foco, -1),
      PageDown: () => somarMeses(foco, 1),
    };
    const passo = passos[evento.key];
    if (passo) {
      evento.preventDefault();
      setFoco(passo());
    }
  }

  const semanas = semanasDoMes(foco);
  const mesMostrado = inicioDoMes(foco).slice(0, 7);

  return (
    <div
      ref={raizRef}
      className="relative"
      onKeyDown={(evento) => {
        if (evento.key === "Escape" && aberto) {
          evento.preventDefault();
          fechar();
        }
      }}
    >
      <Rotulo>{rotulo}</Rotulo>
      <input type="hidden" name={name} value={valor} />

      <button
        ref={botaoRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={idCalendario}
        aria-label={`${rotulo}: ${valor ? dataPorExtenso(valor) : "sem data"}`}
        onClick={() => (aberto ? fechar() : abrir())}
        className={`${CLASSE_CONTROLE} flex items-center gap-2.5 text-left`}
      >
        <CalendarDays size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-tinta-3" />
        {valor ? (
          <span className="min-w-0 truncate">
            <span className="text-tinta">{dataCurta(valor)}</span>
            <span className="text-tinta-3"> · {distanciaDeHoje(valor, hoje)}</span>
          </span>
        ) : (
          <span className="text-tinta-3">Escolher data</span>
        )}
      </button>

      <RodapeCampo dica={dica} />

      {aberto && (
        <div
          id={idCalendario}
          role="dialog"
          aria-label={`Escolher ${rotulo.toLowerCase()}`}
          className={`folha absolute left-0 z-50 w-[19rem] p-3 ${
            paraCima ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setFoco(somarMeses(foco, -1))}
              className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="text-corpo font-semibold text-tinta" aria-live="polite">
              {nomeDoMes(foco)}
            </span>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => setFoco(somarMeses(foco, 1))}
              className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta"
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div ref={gradeRef} role="grid" onKeyDown={aoTeclarNaGrade}>
            <div role="row" className="grid grid-cols-7">
              {DIAS_DA_SEMANA.map((letra, i) => (
                <span
                  key={i}
                  role="columnheader"
                  aria-label={NOMES_DOS_DIAS[i]}
                  className="py-1 text-center text-mini font-semibold text-tinta-3"
                >
                  {letra}
                </span>
              ))}
            </div>

            {semanas.map((semana) => (
              <div key={semana[0]} role="row" className="grid grid-cols-7 gap-y-0.5">
                {semana.map((dia) => {
                  const doMes = dia.slice(0, 7) === mesMostrado;
                  const escolhido = dia === valor;
                  const ehHoje = dia === hoje;
                  return (
                    <button
                      key={dia}
                      type="button"
                      role="gridcell"
                      data-dia={dia}
                      tabIndex={dia === foco ? 0 : -1}
                      aria-selected={escolhido}
                      aria-current={ehHoje ? "date" : undefined}
                      aria-label={dataPorExtenso(dia)}
                      onClick={() => escolher(dia)}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-corpo
                        numerico transition-colors outline-none
                        focus-visible:ring-2 focus-visible:ring-carimbo
                        ${
                          escolhido
                            ? "bg-carimbo font-semibold text-folha"
                            : `hover:bg-folha-2 ${
                                ehHoje ? "font-semibold text-carimbo ring-1 ring-inset ring-carimbo" : ""
                              } ${
                                !doMes
                                  ? "text-tinta-3 opacity-50"
                                  : ehFimDeSemana(dia)
                                    ? "text-tinta-3"
                                    : "text-tinta"
                              }`
                        }`}
                    >
                      {Number(dia.slice(8))}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3 border-t border-filete pt-3">
            <div className="flex flex-wrap gap-1.5">
              {atalhos.map((dias) => {
                const alvo = somarDias(hoje, dias);
                return (
                  <button
                    key={dias}
                    type="button"
                    title={dataCurta(alvo)}
                    onClick={() => escolher(alvo)}
                    className={`rounded-full border px-2.5 py-1 text-mini transition-colors ${
                      alvo === valor
                        ? "border-carimbo bg-carimbo-fraco text-carimbo"
                        : "border-filete text-tinta-2 hover:border-carimbo hover:text-tinta"
                    }`}
                  >
                    {dias} dias
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-mini">
              <button
                type="button"
                onClick={() => escolher(hoje)}
                className="text-carimbo hover:underline"
              >
                Hoje
              </button>
              {valor && (
                <button
                  type="button"
                  onClick={() => {
                    setValor("");
                    fechar();
                  }}
                  className="flex items-center gap-1 text-tinta-3 hover:text-tinta"
                >
                  <X size={12} strokeWidth={2} aria-hidden="true" />
                  Tirar a data
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
