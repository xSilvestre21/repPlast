"use client";

import { useSyncExternalStore } from "react";

/**
 * Abaixo de 640px — o `sm` do Tailwind, o celular em pé.
 *
 * É a mesma fronteira da `.tabela-cartoes` (`globals.css`): onde a tabela vira
 * cartão, o painel que abria dentro da linha passa a abrir numa folha que sobe
 * de baixo. Os dois precisam trocar juntos, senão o acerto abriria dentro de um
 * cartão que não tem onde o pôr.
 */
const CONSULTA = "(max-width: 639.98px)";

function assinar(avisar: () => void) {
  const consulta = matchMedia(CONSULTA);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

/**
 * O celular em pé, lido do navegador e atualizado ao girar a tela.
 *
 * No servidor não há tela: a primeira pintura é a do computador, e a troca
 * acontece na hidratação. Não pisca, porque o painel só aparece depois de um
 * clique.
 */
export function useTelaEstreita(): boolean {
  return useSyncExternalStore(
    assinar,
    () => matchMedia(CONSULTA).matches,
    () => false,
  );
}
