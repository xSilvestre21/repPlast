/**
 * A contagem dos 7 dias grátis, no alto de toda tela do sistema — só para o
 * administrador, que é quem paga e quem cancela.
 *
 * O cadastro já disse a data e o valor; esta faixa diz de novo todo dia, até a
 * véspera. É ela, mais o e-mail de dois dias antes, que impede a cobrança de
 * chegar como surpresa (`lib/teste-gratis.ts`).
 */

import { ArrowRight, Gift } from "lucide-react";
import Link from "next/link";

export function FaixaDoTeste({
  dias,
  ultimoDia,
  cobranca,
  valor,
}: {
  /** Dias grátis que faltam, contando hoje — `diasDeTesteRestantes`. */
  dias: number;
  /** "15/11" */
  ultimoDia: string;
  /** "16/11" */
  cobranca: string;
  /** "R$ 79,00" */
  valor: string;
}) {
  const titulo = dias <= 1 ? "Último dia do teste grátis." : `Teste grátis: faltam ${dias} dias.`;

  return (
    <aside
      aria-label="Teste grátis"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-suave border border-verde/25 bg-verde-fraco px-4 py-3"
    >
      <p className="flex min-w-0 flex-1 items-start gap-2.5 text-corpo text-tinta">
        <Gift size={17} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-verde" />
        <span>
          <strong className="font-semibold">{titulo}</strong> Em{" "}
          <span className="numerico font-semibold">{cobranca}</span> cobramos{" "}
          <span className="numerico font-semibold">{valor}</span> no cartão — cancele até{" "}
          <span className="numerico">{ultimoDia}</span> e não paga nada.
        </span>
      </p>
      <Link
        href="/configuracoes#escritorio"
        className="group inline-flex items-center gap-1.5 text-rotulo font-semibold text-tinta underline underline-offset-4 decoration-tinta/30 hover:decoration-tinta"
      >
        Ver o plano
        <ArrowRight
          size={14}
          strokeWidth={2.25}
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Link>
    </aside>
  );
}
