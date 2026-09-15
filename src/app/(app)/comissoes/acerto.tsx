"use client";

/**
 * A linha de um pedido na apuração, com o acerto embutido.
 *
 * O acerto abre DENTRO da linha em vez de numa janela sobreposta. Conferir o
 * extrato da indústria é ler uma lista e ir lançando: uma janela por pedido
 * obrigaria a abrir e fechar quinze vezes, perdendo de vista a lista que se
 * está conferindo.
 *
 * Enquanto não há acerto, a linha mostra só o previsto — que é a verdade
 * daquele momento: o pedido foi enviado e ainda não foi pago.
 */

import { Check, ChevronDown, Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { SeloStatus } from "@/components/selo-status";
import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE,
  Chip,
  MensagemErro,
  formatarMoeda,
  formatarPercentual,
} from "@/components/ui";
import { pontualidadeEntrega } from "@/lib/comissao";

import type { EstadoFormulario } from "./acoes";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export type LinhaPedido = {
  id: string;
  numero: number;
  status: string;
  apelidoCliente: string;
  enviadoEm: string | null;
  /** "AAAA-MM-DD", como o input date espera. */
  prazoEntrega: string | null;
  entregueEm: string | null;
  base: string;
  percentual: string;
  previsto: number;
  /** Já no padrão brasileiro; vazio quando ainda não houve acerto. */
  valorRecebido: string;
  percentualRecebido: string;
  recebido: number | null;

  /** Nome do preposto que leva a fatia. Nulo quando o pedido é da casa. */
  preposto: string | null;
  /**
   * As duas fatias, do previsto e do já acertado.
   *
   * Chegam NULAS na tela do preposto — e isso não é a tela escondendo: a página
   * simplesmente não as coloca aqui, então elas não viajam para o navegador
   * dele. O que o escritório ganha não é assunto dele.
   */
  rateio: { preposto: number; escritorio: number } | null;
  rateioRecebido: { preposto: number; escritorio: number } | null;
  /** O acerto é do administrador: é ele quem recebe da indústria. */
  podeAcertar: boolean;
};

function paraData(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

/** O selo de pontualidade — verde no dia, vermelho atrasado, azul adiantado. */
function SeloEntrega({ prazo, entregue }: { prazo: string | null; entregue: string | null }) {
  const p = pontualidadeEntrega(paraData(prazo), paraData(entregue));
  if (!p) return null;

  const TONS = {
    no_prazo: { classe: "text-verde bg-verde-fraco", icone: Check, texto: "no prazo" },
    atrasado: {
      classe: "text-perigo bg-perigo-fraco",
      icone: TriangleAlert,
      texto: `${p.dias} dia${p.dias === 1 ? "" : "s"} de atraso`,
    },
    adiantado: {
      classe: "text-carimbo bg-carimbo-fraco",
      icone: Clock,
      texto: `${p.dias} dia${p.dias === 1 ? "" : "s"} adiantado`,
    },
  } as const;

  const { classe, icone: Glifo, texto } = TONS[p.situacao];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-mini font-medium ${classe}`}
    >
      <Glifo size={12} strokeWidth={2.25} aria-hidden="true" />
      {texto}
    </span>
  );
}

export function LinhaComissao({
  pedido,
  salvar,
}: {
  pedido: LinhaPedido;
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const acertado = pedido.recebido !== null;
  const [aberto, setAberto] = useState(false);
  const painel = useId();

  const diferenca = acertado ? pedido.recebido! - pedido.previsto : 0;
  const rateio = acertado ? pedido.rateioRecebido : pedido.rateio;

  return (
    <div className="px-3.5 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex items-center gap-3 min-w-0">
          <Link
            href={`/pedidos/${pedido.id}`}
            className="numerico text-tinta-2 hover:text-carimbo transition-colors"
          >
            #{pedido.numero}
          </Link>
          <span className="truncate text-corpo">{pedido.apelidoCliente}</span>
          {pedido.preposto && <Chip>{pedido.preposto}</Chip>}
          <SeloEntrega prazo={pedido.prazoEntrega} entregue={pedido.entregueEm} />
        </span>

        <span className="flex items-center gap-4 numerico text-corpo">
          <span className="text-mini text-tinta-3">{pedido.enviadoEm ?? ""}</span>
          {pedido.percentual && (
            <span className="text-mini text-tinta-3">{formatarPercentual(pedido.percentual)}</span>
          )}

          <span className="text-right">
            {acertado ? (
              <>
                <span className="block font-medium">{formatarMoeda(pedido.recebido!)}</span>
                <span
                  className={`block text-mini ${diferenca < 0 ? "text-perigo" : "text-verde"}`}
                >
                  {diferenca >= 0 ? "+" : ""}
                  {formatarMoeda(diferenca)} vs. previsto
                </span>
              </>
            ) : (
              <>
                <span className="block font-medium">{formatarMoeda(pedido.previsto)}</span>
                <span className="block text-mini text-tinta-3">previsto</span>
              </>
            )}
            {rateio && (
              <span className="block text-mini text-tinta-3">
                {pedido.preposto?.split(/\s+/)[0] ?? "preposto"}{" "}
                {formatarMoeda(rateio.preposto)} · casa {formatarMoeda(rateio.escritorio)}
              </span>
            )}
          </span>

          {pedido.status !== "ENVIADO" && <SeloStatus status={pedido.status} />}

          {pedido.podeAcertar && (
          <BotaoTexto
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls={painel}
            className="inline-flex items-center gap-1"
          >
            {acertado ? "acerto" : "acertar"}
            <ChevronDown
              size={13}
              strokeWidth={2}
              aria-hidden="true"
              className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
            />
          </BotaoTexto>
          )}
        </span>
      </div>

      <div
        id={painel}
        hidden={!aberto || !pedido.podeAcertar}
        className="pt-3 mt-2.5 border-t border-filete"
      >
        <form action={enviar} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="basis-36 grow">
              <span className="rotulo block mb-1.5 text-tinta-2">Valor recebido</span>
              <input
                name="valorRecebido"
                inputMode="decimal"
                defaultValue={pedido.valorRecebido}
                placeholder={formatarMoeda(pedido.base).replace("R$", "").trim()}
                className={`${CLASSE_CONTROLE} numerico`}
              />
            </label>

            <label className="basis-24 grow-0">
              <span className="rotulo block mb-1.5 text-tinta-2">%</span>
              <input
                name="comissaoPercentualRecebido"
                inputMode="decimal"
                /*
                  Nasce com o percentual do pedido, como o usuário pediu: no caso
                  comum a indústria paga o combinado, e quem precisa mudar muda.
                */
                defaultValue={pedido.percentualRecebido || pedido.percentual}
                className={`${CLASSE_CONTROLE} numerico`}
              />
            </label>

            <label className="basis-40 grow">
              <span className="rotulo block mb-1.5 text-tinta-2">Entregue em</span>
              <input
                type="date"
                name="entregueEm"
                defaultValue={pedido.entregueEm ?? ""}
                className={CLASSE_CONTROLE}
              />
            </label>

            <Botao type="submit" variante="secundaria" carregando={salvando} className="px-4 py-2">
              {salvando ? "Salvando…" : "Salvar"}
            </Botao>
          </div>

          <p className="text-mini text-tinta-3 leading-relaxed">
            Previsto: {formatarMoeda(pedido.base)} × {formatarPercentual(pedido.percentual)} ={" "}
            <span className="numerico">{formatarMoeda(pedido.previsto)}</span>.
            {pedido.prazoEntrega && ` Entrega prometida para ${DATA.format(paraData(pedido.prazoEntrega)!)}.`}
            {" "}Deixe os dois primeiros campos em branco para desfazer o acerto.
          </p>

          <MensagemErro>{estado.erro}</MensagemErro>
        </form>
      </div>
    </div>
  );
}
