"use client";

/**
 * "Plano e cobrança": o teste, a primeira cobrança e como cancelar. Os valores
 * vêm de `planos.ts` e `teste-gratis.ts` — os mesmos da tela de venda.
 */

import Link from "next/link";

import { formatarMoeda } from "@/components/ui";
import { LISTA_PLANOS } from "@/lib/planos";
import { DIAS_DE_TESTE } from "@/lib/teste-gratis";

import { Onde, Quadro, Texto } from "../pecas";

export function Plano() {
  return (
    <div className="space-y-5">
      <Texto>
        Todo escritório começa com {DIAS_DE_TESTE} dias grátis. A primeira cobrança é no {DIAS_DE_TESTE}º dia, no
        cartão informado no cadastro, e dois dias antes você recebe um e-mail com a data, o valor e como cancelar.
      </Texto>

      <div className="grid gap-4 sm:grid-cols-2">
        {LISTA_PLANOS.map((plano) => (
          <Quadro key={plano.codigo}>
            <p className="text-realce font-semibold text-tinta">{plano.nome}</p>
            <p className="text-mini text-tinta-2 mt-0.5">{plano.publico}</p>
            <p className="text-corpo text-tinta mt-2">
              <span className="font-semibold numerico">{formatarMoeda(plano.precoMensal.toString())}</span> por mês
              {plano.precoPrepostoExtra &&
                ` · ${plano.prepostosInclusos} prepostos inclusos, ${formatarMoeda(
                  plano.precoPrepostoExtra.toString(),
                )} cada um a mais`}
            </p>
          </Quadro>
        ))}
      </div>

      <ul className="space-y-1.5 text-corpo text-tinta-2 list-disc pl-5 max-w-2xl">
        <li>Cancelando durante o teste, nada é cobrado.</li>
        <li>Cancelando depois, o escritório continua usando o sistema até o fim do período já pago.</li>
        <li>Dá para trocar de plano a qualquer momento — por exemplo, quando entrar o primeiro preposto.</li>
      </ul>

      <Onde>
        avatar (canto de cima) → <Link href="/configuracoes" className="text-carimbo hover:underline">Configurações</Link>{" "}
        → Escritório → Plano
      </Onde>
    </div>
  );
}
