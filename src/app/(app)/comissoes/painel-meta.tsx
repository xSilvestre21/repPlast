"use client";

import { PartyPopper, Pencil, Target, Wallet } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { CampoMoeda } from "@/components/campo-mascarado";
import {
  Barra,
  Botao,
  BotaoTexto,
  Cartao,
  MensagemErro,
  Placa,
  formatarMoeda,
} from "@/components/ui";
import { escreverNumeroBr } from "@/lib/numero-br";

import type { EstadoFormulario } from "./acoes";

/** Quantidade de confetes. O suficiente para parecer festa sem pesar a página. */
const PECAS = 60;

/**
 * Papel picado nas cores da casa.
 *
 * Confete arco-íris seria a única coisa da tela desenhada por outra pessoa.
 * Aqui caem lascas das cores que o sistema já usa — o azul, o verde, o
 * amarelo do destaque e as duas cores de placa.
 *
 * Nenhuma delas é quase preta, de propósito: no tema escuro uma lasca preta
 * cai invisível, e o efeito perderia um sexto das peças sem ninguém entender
 * por quê.
 *
 * São os tokens, não os hex deles: escritas literalmente, as seis lascas
 * ficariam nas cores do tema claro caindo sobre o fundo do escuro.
 */
const CORES = [
  "var(--carimbo)",
  "var(--verde)",
  "var(--destaque)",
  "var(--placa-pessego-traco)",
  "var(--placa-lilas-traco)",
  "var(--tinta-3)",
];

export function PainelMeta({
  competencia,
  meta,
  nomeDoMes,
  herdadaDe,
  alcancado,
  progresso,
  batida,
  falta,
  definirMeta,
}: {
  competencia: string;
  meta: string | null;
  /** "outubro de 2026" — o mês aberto na tela. */
  nomeDoMes: string;
  /** "agosto de 2026" quando a meta veio de um mês anterior; senão, nulo. */
  herdadaDe: string | null;
  alcancado: number;
  progresso: number | null;
  batida: boolean;
  falta: number | null;
  definirMeta: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(definirMeta, {});
  const [editando, setEditando] = useState(false);

  /*
   * Salvou sem erro, fecha o formulário — na mesma renderização em que os
   * números novos chegam do servidor, para a barra já deslizar até o valor
   * novo. Antes nada fechava, e a meta nova só aparecia saindo da página.
   *
   * É o ajuste de estado durante a renderização que o React recomenda para
   * "reagir a uma prop nova", no lugar de um efeito com `setState`.
   */
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (!estado.erro) setEditando(false);
  }

  // Sem meta não há o que mostrar além do campo para criá-la.
  const comFormulario = editando || meta === null;

  return (
    <>
      {batida && <Comemoracao competencia={competencia} meta={meta} />}

      <Cartao marcada className="p-6 sm:p-8 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Placa icone={Wallet} tom="menta" pequena />
              <span className="rotulo">Comissão do mês</span>
            </div>
            <div className="text-cifra cifra numerico mt-2">
              {formatarMoeda(alcancado)}
            </div>
          </div>

          {!comFormulario && (
            <div className="text-right">
              <span className="rotulo inline-flex items-center gap-1.5">
                <Target size={12} aria-hidden="true" />
                Sua meta
              </span>
              <div className="numerico font-semibold text-medio">{formatarMoeda(meta)}</div>
              {/* A meta pode ter vindo de trás: ela vale do mês em que foi
                  definida em diante. Dizer de onde evita achar que este mês
                  tem uma meta própria. */}
              {herdadaDe && (
                <div className="text-mini text-tinta-3">desde {herdadaDe}</div>
              )}
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

        {/*
          A barra fica na tela enquanto a meta é editada: é isso que deixa ela
          deslizar do progresso antigo até o novo ao salvar, em vez de sumir e
          reaparecer crescendo do zero.
        */}
        {progresso !== null && (
          <div className="mt-5">
            <div className="flex justify-between text-corpo mb-2">
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

            <Barra progresso={progresso} tom={batida ? "verde" : "tinta"} />
          </div>
        )}

        {comFormulario && (
          <form action={enviar} className="mt-5 space-y-4">
            <MensagemErro>{estado.erro}</MensagemErro>

            {/*
              A dica mora FORA da linha. Dentro do campo, ela alongava o bloco
              para baixo e o `items-end` alinhava os botões pela base dela — o
              "Salvar meta" ficava abaixo da caixa e o "cancelar" solto no meio.
              Sem ela, a base da linha é a base da caixa.
            */}
            <div>
              <div className="flex flex-wrap items-end gap-3">
                <CampoMoeda
                  name="meta"
                  rotulo={`Sua meta a partir de ${nomeDoMes}`}
                  placeholder="8.000,00"
                  // Com as duas casas: a máscara leria "20000" como centavos.
                  defaultValue={escreverNumeroBr(meta, 2, 2)}
                  aria-describedby="dica-meta"
                  className="flex-1 min-w-48"
                />

                {/* O par de sempre: a ação e, ao lado, o "voltar atrás" em texto
                    — como em recusar orçamento e cancelar pedido. */}
                <div className="flex items-center gap-3 h-11">
                  <Botao type="submit" variante="secundaria" carregando={salvando}>
                    {salvando ? "Salvando…" : "Salvar meta"}
                  </Botao>

                  {meta !== null && (
                    <BotaoTexto type="button" onClick={() => setEditando(false)}>
                      cancelar
                    </BotaoTexto>
                  )}
                </div>
              </div>

              <p id="dica-meta" className="text-mini text-tinta-3 mt-1.5">
                Vale para este mês e para os seguintes que não têm meta própria. Os meses
                anteriores guardam a meta que tinham. Deixe vazio para não acompanhar meta.
              </p>
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
 * Dispara UMA vez por competência e meta. Bater a meta é notícia; ver o mesmo
 * confete a cada carregamento de página vira incômodo. Trocar a meta por uma
 * que já está batida é notícia nova — e comemora na hora, sem recarregar.
 *
 * O estado permanente de "meta batida" é dito pela própria apuração — o rótulo
 * e a barra ficam verdes o mês inteiro. O confete é só o instante; quem conta
 * o fato depois é a cor da barra.
 */
function Comemoracao({ competencia, meta }: { competencia: string; meta: string | null }) {
  const confete = useRef<HTMLDivElement>(null);

  /*
   * O efeito só mexe no DOM — que é justamente para o que ele serve. Decidir
   * "comemorar ou não" depende de `localStorage`, que não existe no servidor;
   * resolver isso com `setState` dentro do efeito causaria render em cascata.
   * Mostrar e esconder um elemento já renderizado evita as duas coisas.
   */
  useEffect(() => {
    const chave = `comemorou:${competencia}:${meta}`;
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
  }, [competencia, meta]);

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
