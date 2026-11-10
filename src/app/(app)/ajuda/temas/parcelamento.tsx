"use client";

/**
 * "Parcelamento": dividir o recebimento de um pedido, com as contas de verdade.
 *
 * As funções são as de `lib/parcelas.ts` — as mesmas do editor em Comissões e
 * do servidor que confere antes de gravar. O que a pessoa vê aqui é o que ela
 * vai ver lá.
 */

import Decimal from "decimal.js";
import * as m from "motion/react-m";
import Link from "next/link";
import { useState } from "react";

import { Campo, formatarMoeda } from "@/components/ui";
import { lerNumeroBr } from "@/lib/numero-br";
import { dividirIgual, lerPrazoEmDias, restanteDaBase, somarDias } from "@/lib/parcelas";

import { Onde, Quadro, Regua, SUAVE, Texto } from "../pecas";

/** A entrega do exemplo. Fixa: a demonstração não depende do dia em que é aberta. */
const ENTREGA = "2026-10-05";

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const dia = (iso: string) => DATA.format(new Date(`${iso}T00:00:00Z`));

export function Parcelamento() {
  const [vendaDigitada, setVendaDigitada] = useState("3.000,00");
  const [prazo, setPrazo] = useState("28/35/42");
  /** Quanto a pessoa tirou da primeira parcela — vai para a última. */
  const [tirado, setTirado] = useState(0);

  const venda = lerNumeroBr(vendaDigitada);
  const dias = lerPrazoEmDias(prazo);
  const valida = venda !== null && venda > 0 && dias !== null;

  const iguais = valida ? dividirIgual(venda, dias.length) : [];
  const primeira = iguais.length > 0 ? new Decimal(iguais[0]) : new Decimal(0);
  const maximoTirar = Math.floor(primeira.toNumber());
  const tirar = Math.min(tirado, maximoTirar);

  // A primeira diminui; as do meio ficam; a última é o que sobra da base.
  const valores =
    iguais.length > 1 && valida
      ? (() => {
          const anteriores = iguais.slice(0, -1).map((v, i) => (i === 0 ? new Decimal(v).minus(tirar) : new Decimal(v)));
          return [...anteriores, restanteDaBase(venda, anteriores)];
        })()
      : iguais.map((v) => new Decimal(v));

  return (
    <div className="space-y-5">
      <Texto>
        Quando o cliente paga em parcelas, a indústria também paga a comissão em parcelas. Parcelar o
        recebimento do pedido faz cada parte aparecer em Comissões no mês certo, com o valor certo.
      </Texto>

      <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Quadro className="space-y-4">
          <Campo
            rotulo="Valor da venda (sem IPI)"
            numero="decimal"
            sufixo="R$"
            defaultValue={vendaDigitada}
            onChange={(evento) => setVendaDigitada(evento.currentTarget.value)}
          />
          <Campo
            rotulo="Dias a partir da entrega"
            dica="Como no prazo do cliente: 28/35/42. “À vista” é uma parcela no dia."
            defaultValue={prazo}
            onChange={(evento) => {
              setPrazo(evento.currentTarget.value);
              setTirado(0);
            }}
          />
          <p className="text-mini text-tinta-2">Entrega do exemplo: {dia(ENTREGA)}.</p>
        </Quadro>

        <Quadro>
          {!valida ? (
            <p className="text-corpo text-tinta-2">
              {venda === null || venda <= 0
                ? "Informe o valor da venda, como 3.000,00."
                : "Não deu para ler os dias. Escreva os prazos em ordem, separados por barra — como 28/35/42."}
            </p>
          ) : (
            <>
              <ol className="space-y-2" aria-label="Parcelas">
                {valores.map((valor, i) => (
                  <m.li
                    key={`${prazo}-${i}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: SUAVE, delay: 0.08 * i }}
                    className="flex items-center gap-3 rounded-suave bg-folha border border-filete px-3 py-2.5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-carimbo-fraco text-carimbo text-mini font-bold">
                      {i + 1}
                    </span>
                    <span className="text-corpo text-tinta-2">
                      vence em <span className="text-tinta font-medium numerico">{dia(somarDias(ENTREGA, dias[i]))}</span>
                      <span className="text-tinta-3"> · {dias[i]} dias</span>
                    </span>
                    <span className="ml-auto text-corpo font-semibold text-tinta numerico">
                      {formatarMoeda(valor.toFixed(2))}
                    </span>
                  </m.li>
                ))}
              </ol>
              <p className="mt-3 flex justify-between text-corpo">
                <span className="text-tinta-2">Soma das parcelas</span>
                <span className="font-semibold text-tinta numerico">
                  {formatarMoeda(valores.reduce((soma, v) => soma.plus(v), new Decimal(0)).toFixed(2))}
                </span>
              </p>

              {valores.length > 1 && maximoTirar > 0 && (
                <div className="mt-4 pt-4 border-t border-filete">
                  <Regua
                    rotulo="Diminuir a 1ª parcela em"
                    valor={tirar}
                    aoMudar={setTirado}
                    minimo={0}
                    maximo={maximoTirar}
                    passo={Math.max(1, Math.round(maximoTirar / 100))}
                    escrito={formatarMoeda(tirar)}
                  />
                  <p className="text-mini text-tinta-2 mt-2">
                    A diferença vai sozinha para a última parcela: a soma fecha sem você fazer conta.
                  </p>
                </div>
              )}
            </>
          )}
        </Quadro>
      </div>

      <ul className="space-y-1.5 text-corpo text-tinta-2 list-disc pl-5 max-w-2xl">
        <li>
          Os dias contam a partir da <strong className="text-tinta">entrega</strong>, e o valor é o da venda
          sem IPI. O que não divide exato (R$ 100,00 em 3) vai para a última: 33,33 + 33,33 + 33,34.
        </li>
        <li>
          Depois de parcelado, cada parcela tem o seu acerto. Se o pedido inteiro já foi acertado, desfaça o
          acerto antes de parcelar.
        </li>
        <li>Parcelou errado? “Desfazer” volta o pedido a uma linha só, e dá para parcelar de novo.</li>
      </ul>

      <Onde>
        <Link href="/comissoes" className="text-carimbo hover:underline">Comissões</Link> → a linha do pedido →
        “Parcelar o recebimento” → “Dividir em partes iguais” → “Salvar parcelas”
      </Onde>
    </div>
  );
}
