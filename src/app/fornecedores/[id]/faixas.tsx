"use client";

import { useActionState } from "react";

import {
  Botao,
  Campo,
  MensagemErro,
  SecaoCartao,
  formatarPercentual,
} from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type Faixa = { id: string; minimo: string; percentual: string };

const FORMATO_REAIS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const FORMATO_KG = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

export function SecaoFaixas({
  faixas,
  unidadeMeta,
  comissaoBase,
  modoFaixa,
  adicionar,
  remover,
}: {
  faixas: Faixa[];
  unidadeMeta: "REAIS" | "KG";
  comissaoBase: string;
  modoFaixa: "PROGRESSIVA" | "RETROATIVA";
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estado, enviar, enviando] = useActionState(adicionar, {});

  const emReais = unidadeMeta === "REAIS";
  const formatarMinimo = (v: string) =>
    emReais ? FORMATO_REAIS.format(Number(v)) : `${FORMATO_KG.format(Number(v))} kg`;

  return (
    <SecaoCartao
      titulo="Faixas de comissão"
      descricao={
        `Meta apurada por mês, em ${emReais ? "reais" : "quilos"}. ` +
        (modoFaixa === "RETROATIVA"
          ? "Ao cruzar uma faixa, o novo percentual vale para o mês inteiro."
          : "O percentual maior vale apenas sobre o que passar da faixa.")
      }
    >
      <div className="mb-4 rounded-md border border-borda bg-fundo divide-y divide-borda">
        <div className="flex items-center justify-between px-3 py-2.5 text-sm">
          <span className="text-texto-suave">
            Abaixo da primeira faixa <span className="text-texto-fraco">(comissão base)</span>
          </span>
          <span className="numerico text-acento">{formatarPercentual(comissaoBase)}</span>
        </div>

        {faixas.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-texto-fraco">
            Sem faixas: a comissão base vale para todo o volume.
          </p>
        ) : (
          faixas.map((faixa) => (
            <div key={faixa.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm numerico">
                A partir de <strong>{formatarMinimo(faixa.minimo)}</strong>
              </span>

              <div className="flex items-center gap-3">
                <span className="numerico text-sm text-acento">
                  {formatarPercentual(faixa.percentual)}
                </span>
                <form action={remover}>
                  <input type="hidden" name="faixaId" value={faixa.id} />
                  <button
                    type="submit"
                    className="text-xs text-texto-fraco hover:text-perigo transition-colors px-1"
                    aria-label={`Remover faixa a partir de ${formatarMinimo(faixa.minimo)}`}
                  >
                    remover
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <form action={enviar} className="space-y-3">
        <MensagemErro>{estado.erro}</MensagemErro>

        <div className="flex flex-wrap items-end gap-3">
          <Campo
            name="minimo"
            rotulo={emReais ? "A partir de (R$)" : "A partir de (kg)"}
            inputMode="decimal"
            required
            placeholder={emReais ? "50.000" : "5.000"}
            className="flex-1 min-w-40"
          />
          <Campo
            name="percentual"
            rotulo="Comissão"
            inputMode="decimal"
            sufixo="%"
            required
            placeholder="4"
            className="flex-1 min-w-32"
          />
          <Botao type="submit" variante="secundaria" disabled={enviando}>
            {enviando ? "Adicionando…" : "Adicionar faixa"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
