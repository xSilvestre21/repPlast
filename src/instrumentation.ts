import * as Sentry from "@sentry/nextjs";

import { conferirAmbiente } from "@/lib/ambiente";
import { filtrarEvento } from "@/lib/monitoramento";

/**
 * O Sentry no servidor: é por ele que um erro em produção vira alerta, em vez
 * de ficar no log da hospedagem até alguém pedir para olhar.
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
 * de produção, fica desligado. E-mail, CPF e CNPJ saem mascarados
 * (`lib/monitoramento.ts`).
 *
 * A versão (`release`) o SDK lê sozinho de `SENTRY_RELEASE`, que o build da
 * imagem grava (`Dockerfile`); no Vercel, do commit.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",
    // De qual hospedagem veio o alerta: `SENTRY_ENVIRONMENT` na AWS
    // ("producao"); no Vercel, "production" ou "preview".
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV,
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    beforeSend: filtrarEvento,
  });

  // Depois do Sentry: no Vercel, a falta vira alerta em vez de derrubar.
  conferirAmbiente();
}

export const onRequestError = Sentry.captureRequestError;
