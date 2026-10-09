"use client";

import { createContext, useContext } from "react";

/*
 * O canal entre o `Formulario` e os campos dentro dele.
 *
 * Arquivo à parte só para não fechar um ciclo de imports: o `Formulario` usa
 * `ui.tsx` (a mensagem de erro geral), `ui.tsx` reexporta os campos, e os
 * campos precisam disto.
 */

export type Contexto = {
  erroDe: (nome: string | undefined) => string | undefined;
  valorDe: (nome: string | undefined) => string | undefined;
  erroGeral: string | undefined;
};

export const ContextoFormulario = createContext<Contexto | null>(null);

/**
 * O erro e o valor digitado de um campo, para controles que não são `Campo`.
 * Fora de um `Formulario`, não há nada: o controle se comporta como antes.
 */
export function useCampoDoFormulario(nome: string | undefined) {
  const contexto = useContext(ContextoFormulario);
  return {
    erro: contexto?.erroDe(nome),
    valorDigitado: contexto?.valorDe(nome),
  };
}

