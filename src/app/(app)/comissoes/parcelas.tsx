"use client";

/**
 * O editor do parcelamento do recebimento de um pedido.
 *
 * Abre dentro do painel de acerto da linha, como o próprio acerto: conferir o
 * extrato e parcelar são a mesma conversa com a indústria.
 *
 * Duas formas de montar, que se completam:
 *
 *   - os DIAS a partir da entrega ("28/35/42", já sugeridos pelo prazo de
 *     pagamento do pedido) e "Dividir", que gera parcelas iguais — o que o
 *     SICOV fazia;
 *   - depois, mexer no valor de qualquer parcela: a ÚLTIMA é sempre o que
 *     sobra, então diminuir uma empurra a diferença para frente sem a pessoa
 *     fazer conta.
 *
 * As contas são as de `lib/parcelas.ts`, as mesmas que o servidor confere ao
 * gravar.
 */

import { Plus, Scissors, X } from "lucide-react";
import Decimal from "decimal.js";
import { useActionState, useId, useState } from "react";

import { CampoMoeda } from "@/components/campo-mascarado";
import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE,
  Campo,
  MensagemErro,
  formatarMoeda,
} from "@/components/ui";
import { ratearComissao } from "@/lib/comissao";
import { mascararMoeda } from "@/lib/mascara";
import { dividirIgual, lerPrazoEmDias, restanteDaBase, somarDias } from "@/lib/parcelas";

import type { EstadoFormulario } from "./acoes";

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/** Uma parcela enquanto é editada: a data e o valor como estão no campo. */
type Linha = { vencimento: string; valor: string };

const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "3.255,00" → "3255.00" — do campo mascarado para a conta. */
function paraDecimal(valor: string): Decimal {
  const limpo = valor.replace(/\./g, "").replace(",", ".");
  return new Decimal(limpo === "" ? "0" : limpo);
}

/** "3255.00" → "3.255,00" — da conta para o campo. */
function paraCampo(valor: Decimal.Value): string {
  return mascararMoeda(new Decimal(valor).toFixed(2));
}

function mesDe(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? MES.format(new Date(`${iso}T00:00:00Z`)) : "";
}

export function EditorParcelas({
  venda,
  percentual,
  percentualPreposto,
  dataBase,
  prazoSugerido,
  atuais,
  salvar,
  desfazer,
  aoFechar,
}: {
  /** A venda sem IPI do pedido inteiro, "9765.00". */
  venda: string;
  /** O percentual da comissão, para mostrar quanto cada parcela rende. */
  percentual: string;
  /** A fatia do preposto, quando o pedido tem um: cada parcela mostra a dele e a da casa. */
  percentualPreposto: string | null;
  /** "AAAA-MM-DD" de onde os dias contam: a entrega prevista. */
  dataBase: string;
  prazoSugerido: string | null;
  /** As parcelas que o pedido já tem. Vazio: parcelamento novo. */
  atuais: Linha[];
  salvar: Acao;
  /** Só quando o pedido já é parcelado. */
  desfazer: Acao | null;
  aoFechar: () => void;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const [estadoDesfazer, enviarDesfazer, desfazendo] = useActionState<EstadoFormulario, FormData>(
    desfazer ?? (async () => ({})),
    {},
  );

  const sugeridos = lerPrazoEmDias(prazoSugerido);
  const [dias, setDias] = useState(atuais.length > 0 ? "" : (sugeridos?.join("/") ?? ""));
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    atuais.length > 0 ? atuais : sugeridos && sugeridos.length > 1 ? gerar(sugeridos) : [],
  );
  // Remonta os campos de valor quando as linhas são geradas de novo: eles são
  // não controlados (a máscara escreve direto no nó), e guardariam o valor velho.
  const [geracao, setGeracao] = useState(0);
  const [erroDias, setErroDias] = useState<string | null>(null);
  const idDias = useId();

  // Fecha ao salvar sem erro — o mesmo ajuste de estado do acerto e da meta.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (!estado.erro) aoFechar();
  }
  const [desfazerVisto, setDesfazerVisto] = useState(estadoDesfazer);
  if (estadoDesfazer !== desfazerVisto) {
    setDesfazerVisto(estadoDesfazer);
    if (!estadoDesfazer.erro) aoFechar();
  }

  function gerar(listaDias: number[]): Linha[] {
    const valores = dividirIgual(venda, listaDias.length);
    return listaDias.map((d, i) => ({
      vencimento: somarDias(dataBase, d),
      valor: paraCampo(valores[i]),
    }));
  }

  function dividir() {
    const lidos = lerPrazoEmDias(dias);
    if (!lidos || lidos.length < 2) {
      setErroDias('Escreva os dias de cada parcela a partir da entrega, como "0/20" ou "28/35/42".');
      return;
    }
    setErroDias(null);
    setLinhas(gerar(lidos));
    setGeracao((g) => g + 1);
  }

  const anteriores = linhas.slice(0, -1);
  const restante = restanteDaBase(
    venda,
    anteriores.map((l) => paraDecimal(l.valor)),
  );
  const restanteInvalido = linhas.length > 0 && restante.lessThanOrEqualTo(0);

  function mudar(indice: number, campo: keyof Linha, valor: string) {
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  }

  function adicionar() {
    // A nova entra antes da última e começa vazia: a última continua sendo o
    // restante, e a pessoa tira dela o que quiser pôr na nova.
    setLinhas((atual) => {
      const ultima = atual.at(-1);
      const nova = { vencimento: ultima?.vencimento ?? dataBase, valor: "" };
      return [...atual.slice(0, -1), nova, ...(ultima ? [ultima] : [])];
    });
    setGeracao((g) => g + 1);
  }

  function remover(indice: number) {
    setLinhas((atual) => atual.filter((_, i) => i !== indice));
    setGeracao((g) => g + 1);
  }

  /*
   * O rateio é o MESMO da tabela (`ratearComissao`): a casa fica com o resíduo,
   * então preposto + casa fecha no centavo com a comissão da parcela.
   */
  const comissao = (valor: Decimal) => {
    if (!percentual) return null;
    const r = ratearComissao(valor, percentual, percentualPreposto);
    return {
      total: formatarMoeda(r.total.toNumber()),
      fatias: percentualPreposto
        ? `preposto ${formatarMoeda(r.doPreposto.toNumber())} · casa ${formatarMoeda(r.doEscritorio.toNumber())}`
        : null,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo
          id={idDias}
          rotulo="Dias a partir da entrega"
          value={dias}
          onChange={(e) => setDias(e.currentTarget.value)}
          onKeyDown={(e) => {
            // Enter aqui divide, em vez de enviar o formulário de parcelas.
            if (e.key === "Enter") {
              e.preventDefault();
              dividir();
            }
          }}
          placeholder="28/35/42"
          inputMode="numeric"
          autoComplete="off"
          className="basis-48 grow"
        />
        <div className="flex items-center h-11">
          <Botao type="button" variante="secundaria" icone={Scissors} onClick={dividir}>
            Dividir em partes iguais
          </Botao>
        </div>
      </div>
      <MensagemErro>{erroDias}</MensagemErro>

      {linhas.length > 0 && (
        <form action={enviar} className="space-y-3">
          <ol className="space-y-2">
            {linhas.map((linha, i) => {
              const ultima = i === linhas.length - 1;
              const valor = ultima ? restante : paraDecimal(linha.valor);
              const rende = restanteInvalido ? null : comissao(valor);

              return (
                <li
                  key={`${geracao}-${i}`}
                  className="grid grid-cols-[2.5rem_minmax(9rem,11rem)_minmax(9rem,1fr)_minmax(7rem,auto)_2rem] items-center gap-3"
                >
                  <span className="text-mini text-tinta-3 numerico">
                    {i + 1}/{linhas.length}
                  </span>

                  <label>
                    <span className="sr-only">Vencimento da parcela {i + 1}</span>
                    <input
                      type="date"
                      name="vencimento"
                      required
                      defaultValue={linha.vencimento}
                      onChange={(e) => mudar(i, "vencimento", e.currentTarget.value)}
                      className={CLASSE_CONTROLE}
                    />
                  </label>

                  {ultima ? (
                    /*
                      A última não se digita: é o que sobra da venda. É ela que
                      recebe o "restante para frente" quando as outras mudam.
                    */
                    <div>
                      <input type="hidden" name="base" value={restante.toFixed(2)} />
                      <div
                        className={`${CLASSE_CONTROLE} numerico flex justify-between ${
                          restanteInvalido ? "text-perigo" : "text-tinta-2"
                        }`}
                        aria-live="polite"
                      >
                        <span>{paraCampo(restante.abs())}</span>
                        <span className="text-mini text-tinta-3">restante</span>
                      </div>
                    </div>
                  ) : (
                    <CampoMoeda
                      name="base"
                      rotulo={`Valor da parcela ${i + 1}`}
                      defaultValue={linha.valor}
                      onChange={(e) => mudar(i, "valor", e.currentTarget.value)}
                      className="[&>span:first-child]:sr-only"
                    />
                  )}

                  <span className="text-mini text-tinta-3 leading-snug">
                    {mesDe(linha.vencimento)}
                    {rende && (
                      <>
                        <span className="block numerico">comissão {rende.total}</span>
                        {rende.fatias && <span className="block numerico">{rende.fatias}</span>}
                      </>
                    )}
                  </span>

                  {linhas.length > 2 && !ultima ? (
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      aria-label={`Remover a parcela ${i + 1}`}
                      className="grid place-items-center size-8 rounded-full text-tinta-3 transition-colors
                        hover:bg-folha-2 hover:text-perigo cursor-pointer"
                    >
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ol>

          {restanteInvalido && (
            <MensagemErro>
              As parcelas já somam {formatarMoeda(new Decimal(venda).minus(restante).toNumber())} — mais
              que a venda de {formatarMoeda(Number(venda))}. Diminua alguma para sobrar valor na
              última.
            </MensagemErro>
          )}
          <MensagemErro>{estado.erro}</MensagemErro>
          <MensagemErro>{estadoDesfazer.erro}</MensagemErro>

          <div className="flex flex-wrap items-center gap-3">
            <Botao type="submit" variante="secundaria" carregando={salvando} disabled={restanteInvalido}>
              {salvando ? "Salvando…" : "Salvar parcelas"}
            </Botao>
            <BotaoTexto type="button" onClick={adicionar} className="inline-flex items-center gap-1">
              <Plus size={12} aria-hidden="true" />
              mais uma parcela
            </BotaoTexto>
            {desfazer && (
              <BotaoTexto
                type="submit"
                formAction={enviarDesfazer}
                disabled={desfazendo}
                perigoso
                className="ml-auto"
              >
                {desfazendo ? "desfazendo…" : "desfazer parcelamento"}
              </BotaoTexto>
            )}
            <BotaoTexto type="button" onClick={aoFechar}>
              cancelar
            </BotaoTexto>
          </div>

          <p className="text-mini text-tinta-3 leading-relaxed">
            Venda de {formatarMoeda(Number(venda))}. Mude o valor de qualquer parcela: a última fica
            com o restante. Cada parcela conta na comissão do mês em que vence.
          </p>
        </form>
      )}
    </div>
  );
}
