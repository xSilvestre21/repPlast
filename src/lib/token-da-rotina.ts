/**
 * O porteiro das rotinas diárias (`api/rotinas/*`): quem chama é o cron do
 * servidor, com o `ROTINA_TOKEN` do próprio `app.env` (README, "Produção").
 */

import "server-only";

import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer <ROTINA_TOKEN>`, comparado em tempo constante. */
export function tokenDaRotinaConfere(cabecalho: string | null): boolean {
  const esperado = process.env.ROTINA_TOKEN?.trim();
  const recebido = cabecalho?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!esperado || !recebido) return false;

  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}
