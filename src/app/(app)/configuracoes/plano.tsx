"use client";

/**
 * O plano do escritório e a troca para o outro — Solo ↔ Max. Só o
 * administrador vê (a página decide; `trocarPlano` confere de novo).
 *
 * Max → Solo com preposto ativo nem oferece o botão: a pergunta diz o motivo e
 * o caminho (`impedimento`), em vez de perguntar "tem certeza?" e recusar
 * depois do sim. A ação recusa igual, para quem chegar sem passar por aqui.
 */

import { Check, Gem } from "lucide-react";

import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { Botao, formatarMoeda, SecaoCartao, Selo } from "@/components/ui";
import type { EstadoFormulario } from "@/lib/erro-formulario";
import { type CodigoPlano, PLANOS, valorMensal } from "@/lib/planos";

export function CartaoPlano({
  plano,
  prepostosAtivos,
  temCobranca,
  trocar,
}: {
  plano: CodigoPlano;
  prepostosAtivos: number;
  /** O escritório paga pelo Asaas — os de antes da cobrança, não. */
  temCobranca: boolean;
  trocar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const atual = PLANOS[plano];
  const outro = PLANOS[plano === "PLUS" ? "PADRAO" : "PLUS"];
  const mensalidadeAgora = valorMensal(atual.codigo, prepostosAtivos);
  const mensalidadeDepois = valorMensal(outro.codigo, prepostosAtivos);
  const sobe = outro.codigo === "PLUS";

  const impedimento =
    !sobe && prepostosAtivos > 0
      ? `O Solo não tem prepostos, e o escritório tem ${
          prepostosAtivos === 1 ? "1 preposto ativo" : `${prepostosAtivos} prepostos ativos`
        }. ${prepostosAtivos === 1 ? "Inative-o" : "Inative-os"} em “Prepostos” antes de passar para o ` +
        `Solo — ${prepostosAtivos === 1 ? "os dados e os pedidos dele continuam guardados, e voltam" : "os dados e os pedidos deles continuam guardados, e voltam"} ` +
        "se o escritório voltar ao Max."
      : null;

  const quando = temCobranca
    ? "O plano muda na hora; o valor novo vale a partir da próxima mensalidade, sem cobrança proporcional."
    : "O plano muda na hora.";

  return (
    <SecaoCartao
      icone={Gem}
      titulo="Plano e mensalidade"
      descricao={`O escritório está no plano ${atual.nome}. ${atual.publico}`}
    >
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <div className="rounded-suave border border-filete p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-realce font-semibold text-tinta">{atual.nome}</p>
            <Selo tom="verde">Plano atual</Selo>
          </div>
          <p className="mt-2 text-corpo text-tinta-2">
            <span className="text-tinta font-semibold tabular-nums">{formatarMoeda(mensalidadeAgora.toString())}</span>
            {" "}por mês
            {atual.codigo === "PLUS" &&
              ` · ${prepostosAtivos} de ${atual.prepostosInclusos} prepostos inclusos em uso`}
          </p>
        </div>

        <div className="rounded-suave border border-filete p-4">
          <p className="text-realce font-semibold text-tinta">{outro.nome}</p>
          <p className="mt-1 text-mini text-tinta-2">{outro.publico}</p>
          <p className="mt-2 text-corpo text-tinta-2">
            <span className="text-tinta font-semibold tabular-nums">{formatarMoeda(outro.precoMensal.toString())}</span>
            {" "}por mês
            {outro.precoPrepostoExtra &&
              ` · ${outro.prepostosInclusos} prepostos inclusos, ${formatarMoeda(
                outro.precoPrepostoExtra.toString(),
              )} cada um a mais`}
          </p>
          <ul className="mt-3 space-y-1.5">
            {outro.destaques.map((destaque) => (
              <li key={destaque} className="flex items-start gap-2 text-mini text-tinta-2">
                <Check size={14} strokeWidth={2.25} aria-hidden="true" className="mt-0.5 shrink-0 text-verde" />
                {destaque}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <p className="text-mini text-tinta-3 sm:text-right">{quando}</p>
        <AcaoComRecusa
          acao={trocar}
          confirmar={{
            titulo: `Passar para o ${outro.nome}?`,
            texto:
              `A mensalidade passa de ${formatarMoeda(mensalidadeAgora.toString())} para ` +
              `${formatarMoeda(mensalidadeDepois.toString())}. ${quando}` +
              (sobe ? " O menu do seu nome, no alto, ganha “Prepostos”." : " O menu do seu nome, no alto, perde “Prepostos”."),
            rotulo: `Passar para o ${outro.nome}`,
            perigo: false,
            impedimento,
          }}
        >
          <Botao type="submit" variante={sobe ? "primaria" : "secundaria"}>
            Passar para o {outro.nome}
          </Botao>
        </AcaoComRecusa>
      </div>
    </SecaoCartao>
  );
}
