"use client";

/**
 * As peças que os temas da Ajuda repetem: a régua, a linha de conta, o passo
 * numerado e o valor que "pula" quando muda.
 */

import * as m from "motion/react-m";
import { useId, type ReactNode } from "react";

/** A mesma curva da tela de entrada: chega rápido e pousa devagar. */
export const SUAVE = [0.22, 1, 0.36, 1] as const;

/** Régua com o valor escrito ao lado — para mexer num número sem digitar. */
export function Regua({
  rotulo,
  valor,
  aoMudar,
  minimo,
  maximo,
  passo = 1,
  escrito,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (valor: number) => void;
  minimo: number;
  maximo: number;
  passo?: number;
  /** O valor como a pessoa lê: "30 cm", "dia 20". */
  escrito: string;
}) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="rotulo text-tinta-2">
          {rotulo}
        </label>
        <span className="text-corpo font-semibold text-tinta numerico">{escrito}</span>
      </div>
      <input
        id={id}
        type="range"
        min={minimo}
        max={maximo}
        step={passo}
        value={valor}
        onChange={(evento) => aoMudar(Number(evento.target.value))}
        aria-valuetext={escrito}
        className="mt-2 w-full accent-[var(--carimbo)] cursor-pointer"
      />
    </div>
  );
}

/** Uma linha de conta: o que é, e quanto. */
export function LinhaConta({ rotulo, valor, forte = false }: { rotulo: ReactNode; valor: ReactNode; forte?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-2 ${
        forte ? "border-t border-filete-forte mt-1 pt-3" : "border-b border-filete last:border-b-0"
      }`}
    >
      <span className={forte ? "text-corpo font-semibold text-tinta" : "text-corpo text-tinta-2"}>{rotulo}</span>
      <span className={`numerico text-right ${forte ? "text-forte font-bold text-tinta" : "text-corpo text-tinta"}`}>
        {valor}
      </span>
    </div>
  );
}

/**
 * Um valor que dá um pulinho quando muda — a `key` troca, o elemento monta de
 * novo e a entrada roda. É o que faz o olho achar o que a régua mexeu.
 */
export function Pulo({ children, className = "" }: { children: string; className?: string }) {
  return (
    <m.span
      key={children}
      initial={{ opacity: 0.4, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: SUAVE }}
      className={`inline-block ${className}`}
    >
      {children}
    </m.span>
  );
}

/** O quadro onde a demonstração acontece, separado do texto que a explica. */
export function Quadro({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-suave border border-filete bg-folha-2 p-4 sm:p-5 ${className}`}>{children}</div>;
}

/** Parágrafo de explicação, na medida de leitura. */
export function Texto({ children }: { children: ReactNode }) {
  return <p className="text-corpo text-tinta-2 max-w-2xl">{children}</p>;
}

/** "Onde fica": o caminho até a tela, escrito como a pessoa clica. */
export function Onde({ children }: { children: ReactNode }) {
  return (
    <p className="text-mini text-tinta-2">
      <span className="rotulo text-tinta-3 mr-2">Onde fica</span>
      {children}
    </p>
  );
}
