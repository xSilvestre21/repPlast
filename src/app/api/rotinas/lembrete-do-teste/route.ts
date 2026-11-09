import { enviarLembretesDoTeste, tokenDaRotinaConfere } from "@/lib/lembrete-do-teste";

/**
 * A rotina diária do e-mail "o teste grátis está acabando"
 * (`lib/lembrete-do-teste.ts`).
 *
 * Quem chama é o cron do servidor, de dentro do container, com o
 * `ROTINA_TOKEN` do próprio `app.env` — o segredo nem sai de lá (README,
 * "Produção"). A rota passa pelo Caddy como qualquer outra; sem o token, 401.
 * Chamar duas vezes no mesmo dia não manda dois e-mails.
 */
export async function POST(requisicao: Request) {
  if (!tokenDaRotinaConfere(requisicao.headers.get("authorization"))) {
    return new Response("Token inválido", { status: 401 });
  }

  return Response.json(await enviarLembretesDoTeste());
}
