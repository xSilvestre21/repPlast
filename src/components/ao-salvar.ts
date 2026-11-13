"use client";

/**
 * Avisa quem está FORA do formulário que a ação salvou sem erro — o painel do
 * acerto fecha, a tela do "não pago" volta ao começo.
 *
 * Era feito durante a renderização, com o ajuste de estado de sempre
 * (`if (estado !== visto) { …; aoSalvar() }`). Esse ajuste só pode mexer no
 * estado do PRÓPRIO componente: o `aoSalvar` mexe no do pai, e o React avisava
 * "Cannot update a component while rendering a different component" — os dois
 * avisos que o Next mostrava ao lançar um acerto e ao marcar "não pago". Aqui o
 * aviso sai depois que a renderização termina.
 *
 * O `useEffectEvent` lê sempre o `aoSalvar` mais novo sem fazer o efeito rodar
 * de novo quando só ele muda: o efeito depende do ESTADO, e roda uma vez por
 * resposta da ação. O estado com que o formulário nasceu não conta — abrir o
 * painel não é salvar.
 */

import { useEffect, useEffectEvent, useRef } from "react";

import type { EstadoFormulario } from "@/lib/erro-formulario";

export function useAoSalvar(estado: EstadoFormulario, aoSalvar: () => void) {
  const inicial = useRef(estado);
  const avisar = useEffectEvent(aoSalvar);

  useEffect(() => {
    if (estado !== inicial.current && !estado.erro) avisar();
  }, [estado]);
}
