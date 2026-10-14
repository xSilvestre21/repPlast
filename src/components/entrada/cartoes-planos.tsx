"use client";

/**
 * Os dois planos lado a lado — na landing (`/entrar#planos`) e no primeiro
 * passo do cadastro (`/comecar`).
 *
 * Lê `PLANOS` direto, em vez de receber os planos por prop: o preço é
 * `Decimal`, que não atravessa de Server para Client Component, e a lista é
 * fixa de todo jeito.
 *
 * O Solo leva o realce (canto marcado, "Para começar") — e o selo diz ONDE
 * começar, não qual é melhor: a escolha entre os dois depende de ter
 * preposto ou não, e isso a pessoa sabe melhor do que a página. "Mais usado"
 * seria afirmar uma estatística que não existe.
 */

import { ArrowRight, Check } from "lucide-react";
import * as m from "motion/react-m";
import Link from "next/link";

import { LISTA_PLANOS } from "@/lib/planos";

const SUAVE = [0.22, 1, 0.36, 1] as const;

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function CartoesPlanos({ animarAoRolar = true }: { animarAoRolar?: boolean }) {
  return (
    <ul className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
      {LISTA_PLANOS.map((plano, i) => {
        const aparecer = { opacity: 1, y: 0 };

        return (
          <m.li
            key={plano.codigo}
            data-revelar=""
            initial={{ opacity: 0, y: 24 }}
            {...(animarAoRolar
              ? { whileInView: aparecer, viewport: { once: true, margin: "0px 0px -10% 0px" } }
              : { animate: aparecer })}
            transition={{ duration: 0.6, ease: SUAVE, delay: 0.1 * i }}
            whileHover={{ y: -6 }}
            className={`folha relative flex flex-col p-6 sm:p-8 ${
              plano.recomendado ? "folha-marcada plano-recomendado" : ""
            }`}
          >
            {plano.recomendado && (
              <span className="absolute -top-3 right-6 rounded-full bg-tinta text-papel text-mini font-semibold px-3 py-1 shadow-suave">
                Para começar
              </span>
            )}

            <h3 className="text-forte font-bold text-tinta">{plano.nome}</h3>
            <p className="text-corpo text-tinta-2 mt-1">{plano.publico}</p>

            <p className="mt-6 flex items-baseline gap-1.5">
              <span className="text-titulo font-extrabold text-tinta numerico">
                {MOEDA.format(plano.precoMensal.toNumber())}
              </span>
              <span className="text-corpo text-tinta-2">/mês</span>
            </p>
            <p className="text-mini text-tinta-3 mt-1 min-h-[1.1rem]">
              {plano.precoPrepostoExtra
                ? `+ ${MOEDA.format(plano.precoPrepostoExtra.toNumber())}/mês por preposto além do ${plano.prepostosInclusos}º`
                : "Um usuário: você."}
            </p>

            <ul className="mt-6 space-y-2.5 flex-1">
              {plano.destaques.map((destaque) => (
                <li key={destaque} className="flex items-start gap-2.5 text-corpo text-tinta">
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    className={`shrink-0 mt-0.5 ${plano.recomendado ? "text-carimbo" : "text-verde"}`}
                    aria-hidden="true"
                  />
                  {destaque}
                </li>
              ))}
            </ul>

            <Link
              href={`/comecar?plano=${plano.slug}`}
              className={`group mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3
                text-corpo font-semibold transition-all duration-200 ${
                  plano.recomendado
                    ? "bg-tinta text-papel shadow-folha hover:shadow-alta hover:-translate-y-0.5"
                    : "bg-folha text-tinta border border-filete-forte hover:bg-folha-2"
                }`}
            >
              Começar com o {plano.nome}
              <ArrowRight
                size={16}
                strokeWidth={2.25}
                className="transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </m.li>
        );
      })}
    </ul>
  );
}
