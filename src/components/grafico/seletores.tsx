"use client";

/**
 * Os seletores que os cartões repetem: período, métrica e visão.
 *
 * Cada um é um `Segmentado` com a escolha guardada na URL (`useParametro`).
 * Ficam aqui para que "3 meses" signifique a mesma coisa e tenha o mesmo
 * rótulo em todos os cartões.
 */

import type { LucideIcon } from "lucide-react";

import { Segmentado } from "@/components/ui";
import type { Metrica } from "@/lib/grafico/agregar";

export type Periodo = "1" | "3" | "6" | "12" | "24";

const ROTULO_PERIODO: Record<Periodo, string> = {
  "1": "Mês",
  "3": "3 meses",
  "6": "6 meses",
  "12": "12 meses",
  "24": "24 meses",
};

export function SeletorPeriodo({
  opcoes,
  atual,
  aoEscolher,
}: {
  opcoes: readonly Periodo[];
  atual: Periodo;
  aoEscolher: (p: Periodo) => void;
}) {
  return (
    <Segmentado
      nome="Período"
      atual={atual}
      aoEscolher={aoEscolher}
      opcoes={opcoes.map((p) => ({ valor: p, rotulo: ROTULO_PERIODO[p] }))}
    />
  );
}

export function SeletorMetrica({
  atual,
  aoEscolher,
}: {
  atual: Metrica;
  aoEscolher: (m: Metrica) => void;
}) {
  return (
    <Segmentado
      nome="Medida"
      atual={atual}
      aoEscolher={aoEscolher}
      opcoes={[
        { valor: "previsto", rotulo: "Previsto" },
        { valor: "recebido", rotulo: "Recebido" },
      ]}
    />
  );
}

export function SeletorVisao<T extends string>({
  opcoes,
  atual,
  aoEscolher,
  nome = "Visão",
}: {
  opcoes: { valor: T; rotulo: string; icone: LucideIcon }[];
  atual: T;
  aoEscolher: (v: T) => void;
  /** Para leitor de tela — um cartão com dois grupos de ícones precisa de dois nomes. */
  nome?: string;
}) {
  return (
    <Segmentado
      nome={nome}
      atual={atual}
      aoEscolher={aoEscolher}
      opcoes={opcoes.map(({ valor, rotulo, icone: Icone }) => ({
        valor,
        rotulo: (
          <span className="inline-flex items-center gap-1.5">
            <Icone size={12} strokeWidth={2.25} aria-hidden="true" />
            {rotulo}
          </span>
        ),
      }))}
    />
  );
}

/** Um liga-desliga em forma de pílula — "Meta", "Ano anterior". */
export function Alternancia({
  ligada,
  aoMudar,
  children,
  desabilitada = false,
  titulo,
}: {
  ligada: boolean;
  aoMudar: (ligada: boolean) => void;
  children: React.ReactNode;
  desabilitada?: boolean;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={ligada}
      disabled={desabilitada}
      title={titulo}
      onClick={() => aoMudar(!ligada)}
      className={`px-3 py-1 rounded-full text-mini font-semibold border transition-colors cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed ${
          ligada
            ? "bg-tinta text-papel border-tinta"
            : "bg-folha-2 text-tinta-2 border-filete hover:text-tinta"
        }`}
    >
      {children}
    </button>
  );
}

/** Quantos meses o período cobre. */
export const mesesDoPeriodo = (p: Periodo) => Number(p);
