"use client";

/**
 * O motor de animação da tela de entrada, carregado pela metade.
 *
 * `LazyMotion` com `domAnimation` traz só o que a landing usa — animar,
 * entrar e sair, aparecer ao rolar, hover — e deixa de fora o que pesa e ela
 * não usa (arrastar, animação de layout). Os componentes animados usam `m`
 * (`motion/react-m`) em vez de `motion`, que é o que permite o corte.
 *
 * `strict`: um `motion.div` esquecido dentro daqui lança erro em vez de
 * puxar o pacote inteiro de volta em silêncio.
 */

import { domAnimation, LazyMotion } from "motion/react";
import type { ReactNode } from "react";

export function Movimento({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
