"use client";

import { PartyPopper, Pencil, Target, Wallet } from "lucide-react";
import { useActionState, useEffect, useRef, useState, type CSSProperties } from "react";

import {
  Botao,
  BotaoTexto,
  Campo,
  Cartao,
  Emblema,
  MensagemErro,
  formatarMoeda,
} from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

/** Quantidade de confetes. O suficiente para parecer festa sem pesar a página. */
const PECAS = 60;

/**
 * Papel picado nas tintas da casa.
 *
 * Confete arco-íris seria a única coisa da tela que não sai da mesma gráfica.
 * Aqui caem lascas de carimbo, de tinta e da segunda cor — o mesmo papel do
 * resto do sistema, cortado.
 */
const CORES = ["#c8341e", "#1f6f4a", "#16130f", "#e8c07a", "#c8341e", "#f2eee6"];

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

      <Cartao marcada className="p-5 sm:p-7 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Emblema icone={Wallet} className="size-4" />
              <span className="rotulo">Comissão do mês</span>
            </div>
            <div className="text-3xl sm:text-5xl font-extrabold tracking-tighter cifra numerico mt-2 leading-none">
              {formatarMoeda(alcancado)}
            </div>
          </div>

          {!editando && meta !== null && (
            <div className="text-right">
              <span className="rotulo inline-flex items-center gap-1.5">
                <Target size={12} aria-hidden="true" />
                Sua meta
              </span>
              <div className="numerico font-semibold text-lg">{formatarMoeda(meta)}</div>
              <BotaoTexto
                type="button"
                onClick={() => setEditando(true)}
                className="mt-0.5 inline-flex items-center gap-1"
              >
                <Pencil size={11} aria-hidden="true" />
                alterar
              </BotaoTexto>
            </div>
          )}
        </div>

        {!editando && progresso !== null && (
          <div className="mt-5">
            <div className="flex justify-between text-sm mb-2">
              {batida ? (
                <span className="flex items-center gap-2 font-medium">
                  <PartyPopper size={15} className="text-verde shrink-0" aria-hidden="true" />
                  <span>
                    Meta batida — e você já passou dela em{" "}
                    <strong className="numerico">
                      {formatarMoeda(alcancado - Number(meta))}
                    </strong>
                    .
                  </span>
                </span>
              ) : (
                <span className="text-tinta-2">
                  Faltam{" "}
                  <strong className="text-tinta numerico">{formatarMoeda(falta ?? 0)}</strong> para
                  a sua meta
                </span>
              )}
              <span className="numerico text-tinta-2">{Math.round(progresso)}%</span>
            </div>

            <div className="h-2.5 rounded-full bg-folha-2 overflow-hidden border border-filete">
              <div
                style={{ "--alvo": `${progresso}%` } as CSSProperties}
                className={`barra-preenche h-full rounded-full ${
                  batida ? "bg-verde" : "bg-tinta text-papel"
                }`}
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

              <Botao type="submit" variante="secundaria" carregando={salvando}>
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
 * Dispara UMA vez por competência. Bater a meta é notícia; ver o mesmo confete
 * a cada carregamento de página vira incômodo.
 *
 * O estado permanente de "meta batida" é dito pela própria apuração — o rótulo
 * e a barra ficam verdes o mês inteiro. Não há mudança de ambiente: papel não
 * brilha, e inventar um brilho aqui seria trair o resto do sistema.
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

    return () => clearTimeout(esconder);
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
