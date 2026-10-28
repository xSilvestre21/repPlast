import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Abrir o servidor de desenvolvimento do PC a partir do notebook, pela rede
  // local. Sem isto o Next bloqueia os recursos de dev vindos de outra origem e
  // a página carrega sem a parte interativa.
  //
  // 127.0.0.1 pelo mesmo motivo: o checkout do Asaas recusa "localhost" nas
  // URLs de volta, então no desenvolvimento o sistema é aberto por
  // 127.0.0.1 — e sem isto os planos de /comecar nem aparecem (são revelados
  // por JavaScript, que o Next bloqueava).
  allowedDevOrigins: ["192.168.15.129", "127.0.0.1"],
  // Arquivos que o servidor lê do disco na hora (`readFile`, `Font.register`),
  // e não por `import`: sem isto, numa hospedagem serverless eles ficam fora do
  // pacote da função. As fontes do PDF de gráficos e o logo do e-mail do
  // sistema (`lib/pdf/documento-graficos.tsx`, `lib/email-sistema.ts`).
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-*-normal.woff",
      "./public/email/**/*",
    ],
  },
  experimental: {
    // Uploads passam por server action, e o padrão do Next é 1 MB. O maior é o
    // envio do pedido por e-mail: a aplicação valida 20 MB de anexos (ver
    // `lib/envio-pedido.ts`), e a folga cobre o overhead do multipart — para a
    // pessoa receber a mensagem de "passa de 20 MB" em vez de um erro cru do
    // framework. O logo (2 MB) cabe com sobra.
    serverActions: { bodySizeLimit: "25mb" },
    // Quanto vale a página que uma aba pré-carregou ao passar o mouse
    // (`prefetch={true}`, em components/navegacao.tsx). O padrão é 5 min; 30 s
    // deixa a troca instantânea sem mostrar dado velho — um pedido lançado por
    // um preposto aparece na próxima ida à aba. Salvar algo aqui mesmo já
    // descarta o que foi guardado (`revalidatePath` nas ações).
    staleTimes: { static: 30 },
  },
  turbopack: {
    // Sem isto o Turbopack sobe a árvore procurando lockfile e encontra um
    // package-lock.json solto em C:\Users\gustt, fora do projeto.
    root: import.meta.dirname,
  },
};

/**
 * O Sentry (`src/instrumentation.ts`). O envio do navegador passa por
 * `/monitoramento`, no próprio domínio: bloqueador de anúncio não o derruba.
 * Com `SENTRY_AUTH_TOKEN` (só no Vercel), o build manda os source maps, e o
 * erro chega apontando a linha do código, e não a do arquivo minificado; sem
 * ele, o build segue sem mandar.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: "/monitoramento",
  widenClientFileUpload: true,
  silent: !process.env.CI,
  telemetry: false,
});
