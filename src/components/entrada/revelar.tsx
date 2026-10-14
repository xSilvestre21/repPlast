"use client";

/**
 * Entrada ao rolar: o bloco sobe um pouco e acende quando chega à janela.
 *
 * Só na tela de entrada. Dentro do sistema a regra é outra (`.surgir`, só
 * opacidade, ao montar): lá a pessoa já sabe onde está; aqui a página é lida
 * de cima para baixo pela primeira vez, e o movimento é o que marca onde cada
 * argumento começa.
 *
 * `once`: anima na primeira vez e fica. Voltar a rolar para cima e ver tudo
 * apagar e acender de novo é cansativo na segunda leitura.
 *
 * O HTML nasce com `opacity: 0` (é o `initial` do motion). Quem não tem
 * JavaScript veria a página vazia — o `<SemScriptRevela />` da página desfaz
 * isso com um `<noscript>`.
 */

import * as m from "motion/react-m";
import type { ReactNode } from "react";

const SUAVE = [0.22, 1, 0.36, 1] as const;

export function Revelar({
  children,
  atraso = 0,
  className = "",
  como = "div",
}: {
  children: ReactNode;
  /** Em segundos — para a cascata de uma grade. */
  atraso?: number;
  className?: string;
  como?: "div" | "li" | "section";
}) {
  const Elemento = m[como];

  return (
    <Elemento
      data-revelar=""
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.6, ease: SUAVE, delay: atraso }}
    >
      {children}
    </Elemento>
  );
}

/**
 * Sem JavaScript o motion nunca roda, e os blocos ficariam no `opacity: 0` do
 * HTML. Esta regra só existe quando o script está desligado.
 */
export function SemScriptRevela() {
  return (
    <noscript>
      <style>{`[data-revelar]{opacity:1!important;transform:none!important}`}</style>
    </noscript>
  );
}
