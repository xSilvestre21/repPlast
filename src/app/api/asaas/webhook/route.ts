import { processarEventoAsaas, tokenDoWebhookConfere } from "@/lib/asaas-webhook";

/**
 * Webhook do Asaas: é por aqui que a assinatura vira paga, atrasada ou
 * cancelada.
 *
 * Fora de `(app)` porque quem chama é o Asaas, sem sessão. A autenticação é o
 * token configurado no painel do Asaas, que chega no header
 * `asaas-access-token`.
 *
 * Responde 200 também para evento que não interessa: um não-2xx faz o Asaas
 * repetir a entrega e, depois de várias falhas, PAUSAR a fila inteira — e aí
 * os pagamentos seguintes deixariam de liberar escritórios.
 */
export async function POST(requisicao: Request) {
  if (!tokenDoWebhookConfere(requisicao.headers.get("asaas-access-token"))) {
    return new Response("Token inválido", { status: 401 });
  }

  let evento: unknown;
  try {
    evento = await requisicao.json();
  } catch {
    return new Response("Corpo não é JSON", { status: 400 });
  }

  await processarEventoAsaas(evento);
  return Response.json({ recebido: true });
}
