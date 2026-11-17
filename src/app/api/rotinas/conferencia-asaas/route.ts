import { conferirComOAsaas } from "@/lib/conferencia-asaas";
import { tokenDaRotinaConfere } from "@/lib/token-da-rotina";

/**
 * A conferência diária com o Asaas (`lib/conferencia-asaas.ts`).
 *
 * Quem chama é o cron do servidor, de dentro do container, com o
 * `ROTINA_TOKEN` do próprio `app.env` — como o lembrete do teste grátis
 * (README, "A conferência diária com o Asaas"). Sem o token, 401. A resposta
 * diz o que foi corrigido e o que ficou para uma pessoa olhar, e vai para o
 * log do cron, na própria instância.
 */
export async function POST(requisicao: Request) {
  if (!tokenDaRotinaConfere(requisicao.headers.get("authorization"))) {
    return new Response("Token inválido", { status: 401 });
  }

  return Response.json(await conferirComOAsaas());
}
