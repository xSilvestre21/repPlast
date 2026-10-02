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
        a tendência, os prepostos e a concentração, e o resto em seguida. Cada
        cartão tem a própria altura — o grid alinha o topo, sem esticar um
        cartão curto para acompanhar o vizinho.
      */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <CartaoClientes base={base} />
        <CartaoIndustrias base={base} />
      </div>

      <CartaoMensal base={base} />

      {/* Sem preposto (plano Padrão, ou a tela do próprio preposto), a curva ABC
          fica sozinha na linha e ganha a largura toda. */}
      <div className={`grid gap-5 items-start ${base.comPreposto ? "lg:grid-cols-2" : ""}`}>
        {base.comPreposto && <CartaoPrepostos base={base} />}
        <CartaoAbc base={base} />
      </div>

      <CartaoMapaCalor base={base} />

      <div className="grid gap-5 lg:grid-cols-3 items-start">
        <CartaoCancelados base={base} />
        <CartaoOrcamentos base={base} />
        <CartaoPontualidade base={base} />
      </div>

      <CartaoSumidos base={base} />
    </div>
  );
}
