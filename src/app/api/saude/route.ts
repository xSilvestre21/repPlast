import { dbAdministrativo } from "@/lib/db";

/**
 * Se o sistema está de pé: o servidor responde E alcança o banco.
 *
 * Quem pergunta é a hospedagem, não uma pessoa: o healthcheck do Docker e o
 * deploy, que só dá a versão nova por boa depois de um 200 daqui (ver
 * `deploy/`). Sem sessão, de propósito — e por isso não diz nada além de sim
 * ou não: nem versão, nem o erro do banco.
 */
export async function GET() {
  try {
    await dbAdministrativo().$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    // `warn`, não `error`: o Sentry só leva os `error`, e o healthcheck
    // pergunta a cada 30 s — um banco fora do ar por uma hora gastaria 120
    // eventos da cota repetindo o que as requisições de verdade já reportam.
    console.warn("[saude] o banco não respondeu:", erro);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
