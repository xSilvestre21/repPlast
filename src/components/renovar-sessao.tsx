"use client";

/**
 * Avisa o servidor de que o sistema está em uso, para a sessão não vencer
 * (`/api/sessao`). Sem uso por 7 dias, ela vence e o sistema pede a senha.
 *
 * Ao abrir e ao voltar para o app (`visibilitychange`) — no celular, o app
 * instalado volta do segundo plano sem recarregar a página. No máximo a cada
 * 15 minutos: o servidor só refaz o cookie de hora em hora, de todo modo.
 */

import { useEffect } from "react";

const INTERVALO_MS = 15 * 60 * 1000;
let ultimoAviso = 0;

function avisar() {
  if (document.visibilityState !== "visible" || Date.now() - ultimoAviso < INTERVALO_MS) return;
  ultimoAviso = Date.now();
  // Sem rede, fica para a próxima vez: é só o prazo, nada se perde.
  fetch("/api/sessao", { method: "POST" }).catch(() => {});
}

export function RenovarSessao() {
  useEffect(() => {
    avisar();
    document.addEventListener("visibilitychange", avisar);
    return () => document.removeEventListener("visibilitychange", avisar);
  }, []);

  return null;
}
