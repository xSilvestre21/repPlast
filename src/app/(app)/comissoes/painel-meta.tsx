"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Botao, BotaoTexto, Campo, Cartao, MensagemErro, formatarMoeda } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

/** Quantidade de confetes. O suficiente para parecer festa sem pesar a página. */
const PECAS = 60;
const CORES = ["#f59e0b", "#ec4899", "#8b5cf6", "#22d3ee", "#fbbf24", "#4ade80"];

export function PainelMeta({
  competencia,
  meta,
  alcancado,
  progresso,
  batida,
  falta,
  definirMeta,
}: {
  competencia: string;
  meta: string | null;
  alcancado: number;
  progresso: number | null;
  batida: boolean;
  falta: number | null;
  definirMeta: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(definirMeta, {});
  const [editando, setEditando] = useState(meta === null);

  return (
    <>
      {batida && <Comemoracao competencia={competencia} />}

      <Cartao className="p-5 sm:p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs text-texto-fraco uppercase tracking-wide">
              Comissão do mês
            </div>
            <div className="text-3xl font-semibold texto-gradiente numerico mt-0.5">
              {formatarMoeda(alcancado)}
            </div>
          </div>

          {!editando && meta !== null && (
            <div className="text-right">
              <div className="text-xs text-texto-fraco uppercase tracking-wide">Sua meta</div>
              <div className="numerico">{formatarMoeda(meta)}</div>
              <BotaoTexto type="button" onClick={() => setEditando(true)} className="mt-0.5">
                alterar
              </BotaoTexto>
            </div>
          )}
        </div>

        {!editando && progresso !== null && (
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-2">
              {batida ? (
                <span className="font-medium">
                  🎉 Meta batida — e você já passou dela em{" "}
                  <strong className="numerico">
                    {formatarMoeda(alcancado - Number(meta))}
                  </strong>
                  .
                </span>
              ) : (
                <span className="text-texto-suave">
                  Faltam{" "}
                  <strong className="text-texto numerico">{formatarMoeda(falta ?? 0)}</strong> para
                  a sua meta
                </span>
              )}
              <span className="numerico text-texto-suave">{Math.round(progresso)}%</span>
            </div>

            <div className="h-2 rounded-full bg-superficie-alta overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  batida ? "bg-aviso" : "fundo-gradiente"
                }`}
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>
        )}

        {editando && (
          <form action={enviar} className="mt-5 space-y-3">
            <MensagemErro>{estado.erro}</MensagemErro>

            <div className="flex flex-wrap items-end gap-3">
              <Campo
                name="meta"
                rotulo="Sua meta de comissão por mês"
                inputMode="decimal"
                sufixo="R$"
                placeholder="8.000"
                defaultValue={meta ?? ""}
                dica="Deixe vazio para não acompanhar meta."
                className="flex-1 min-w-48"
              />

              <Botao type="submit" variante="secundaria" disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar meta"}
              </Botao>

              {meta !== null && (
                <BotaoTexto type="button" onClick={() => setEditando(false)} className="mb-3">
                  cancelar
                </BotaoTexto>
              )}
            </div>
          </form>
        )}
      </Cartao>
    </>
  );
}

/**
 * A festa.
 *
 * O brilho de fundo vira dourado enquanto a meta estiver batida — é estado, não
 * evento, então acompanha o mês. Já o confete é evento: dispara UMA vez por
 * competência. Bater a meta é notícia; ver o mesmo confete a cada carregamento
 * de página vira incômodo.
 */
function Comemoracao({ competencia }: { competencia: string }) {
  const confete = useRef<HTMLDivElement>(null);

  /*
   * O efeito só mexe no DOM — que é justamente para o que ele serve. Decidir
   * "comemorar ou não" depende de `localStorage`, que não existe no servidor;
   * resolver isso com `setState` dentro do efeito causaria render em cascata.
   * Mostrar e esconder um elemento já renderizado evita as duas coisas.
   */
  useEffect(() => {
    const aurora = document.getElementById("aurora");
    aurora?.classList.add("comemorando");

    const chave = `comemorou:${competencia}`;
    let jaComemorou = true;

    try {
      jaComemorou = localStorage.getItem(chave) === "sim";
      if (!jaComemorou) localStorage.setItem(chave, "sim");
    } catch {
      // Armazenamento bloqueado: melhor não comemorar do que comemorar sempre.
    }

    const pecas = confete.current;
    let esconder: ReturnType<typeof setTimeout> | undefined;

    if (!jaComemorou && pecas) {
      // As animações só começam quando o elemento deixa de estar oculto.
      pecas.hidden = false;
      esconder = setTimeout(() => {
        pecas.hidden = true;
      }, 5000);
    }

    return () => {
      clearTimeout(esconder);
      aurora?.classList.remove("comemorando");
    };
  }, [competencia]);

  return (
    <div ref={confete} hidden className="confete" aria-hidden="true">
      {Array.from({ length: PECAS }, (_, indice) => (
        <span
          key={indice}
          style={
            {
              left: `${(indice * 97) % 100}%`,
              background: CORES[indice % CORES.length],
              "--duracao": `${2.4 + ((indice * 13) % 18) / 10}s`,
              "--atraso": `${((indice * 29) % 20) / 10}s`,
              "--giro": `${((indice * 71) % 4) * 180 + 360}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
