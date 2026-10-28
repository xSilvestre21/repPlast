import * as Sentry from "@sentry/nextjs";

/**
 * O Sentry no navegador: o erro que acontece na tela de quem usa — e que ele
 * só veria como "Esta tela não carregou". O mesmo de `instrumentation.ts`:
 * só erros, sem gravação de tela, desligado fora de produção.
 *
 * O envio vai pelo próprio sistema (`/monitoramento`, em `next.config.ts`),
 * e não direto ao Sentry: bloqueador de anúncio não o derruba, e a CSP não
 * precisa abrir mais um endereço.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV,
});
