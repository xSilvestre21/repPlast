"use client";

/**
 * O painel de gráficos: recebe a base UMA vez e distribui aos cartões.
 *
 * É a única fronteira servidor→cliente da página. Se cada cartão fosse uma
 * ilha recebendo a base pela própria prop, o RSC serializaria os 24 meses de
 * itens uma vez por cartão no HTML.
 */

import type { BaseDosGraficos } from "@/lib/grafico/base";

import { CartaoAbc } from "./cartoes/abc";
import { CartaoCancelados } from "./cartoes/cancelados";
import { CartaoClientes } from "./cartoes/clientes";
import { CartaoIndustrias } from "./cartoes/industrias";
import { FaixaKpis } from "./cartoes/kpis";
import { CartaoMapaCalor } from "./cartoes/mapa-calor";
import { CartaoMensal } from "./cartoes/mensal";
import { CartaoOrcamentos } from "./cartoes/orcamentos";
import { CartaoPontualidade } from "./cartoes/pontualidade";
import { CartaoPrepostos } from "./cartoes/prepostos";
import { CartaoSumidos } from "./cartoes/sumidos";

export function PainelGraficos({ base }: { base: BaseDosGraficos }) {
  return (
    <div className="space-y-5">
      <FaixaKpis base={base} />

      {/*
        A ordem é a que o usuário pediu: quem e de onde veio a comissão, depois
        a tendência, os prepostos e a concentração, e o resto em seguida.

        Cartões lado a lado têm SEMPRE a mesma altura: o grid estica o mais
        baixo e o gráfico dele cresce para ocupar a sobra (`CartaoGrafico`).
        Alinhados só pelo topo, o mais baixo deixava um vão vazio embaixo.
      */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CartaoClientes base={base} />
        <CartaoIndustrias base={base} />
      </div>

      <CartaoMensal base={base} />

      {/* Sem preposto (plano Padrão, ou a tela do próprio preposto), a curva ABC
          fica sozinha na linha e ganha a largura toda. */}
      <div className={`grid gap-5 ${base.comPreposto ? "lg:grid-cols-2" : ""}`}>
        {base.comPreposto && <CartaoPrepostos base={base} />}
        <CartaoAbc base={base} />
      </div>

      <CartaoMapaCalor base={base} />

      <div className="grid gap-5 lg:grid-cols-3">
        <CartaoCancelados base={base} />
        <CartaoOrcamentos base={base} />
        <CartaoPontualidade base={base} />
      </div>

      <CartaoSumidos base={base} />
    </div>
  );
}
