import * as Sentry from "@sentry/nextjs";

/**
 * O Sentry no servidor: é por ele que um erro em produção vira alerta, em vez
 * de ficar no log do Vercel até alguém pedir para olhar.
 *
 * Três caminhos chegam lá:
 *   - o erro que ninguém tratou numa página, ação ou rota (`onRequestError`,
 *     o 500);
 *   - todo `console.error` do servidor — é por ele que passam a cobrança que o
 *     Asaas recusou, o webhook que não acertou a mensalidade, o e-mail do
 *     sistema que não saiu e o erro inesperado de formulário (`falhou`);
 *   - o erro de tela no navegador (`instrumentation-client.ts`).
 *
 * Só erros: sem rastreio de desempenho e sem gravação de tela — esta tem os
 * pedidos e as comissões dos clientes. Sem `NEXT_PUBLIC_SENTRY_DSN`, ou fora
 * de produção, fica desligado.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",
    // "production" ou "preview" no Vercel: o alerta diz de qual deploy veio.
    environment: process.env.VERCEL_ENV,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
  });
}

export const onRequestError = Sentry.captureRequestError;
