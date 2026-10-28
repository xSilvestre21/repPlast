import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const emDesenvolvimento = process.env.NODE_ENV === "development";

/**
 * O que a página pode carregar, e de onde.
 *
 * Sem nonce: ele pediria um `proxy.ts` gerando um a cada requisição, e a
 * proteção de rota daqui mora no layout, não num proxy. Por isso o
 * `'unsafe-inline'` nos scripts — o do tema (`app/layout.tsx`) e o da guarda
 * da aba (`(app)/layout.tsx`) são embutidos. Mesmo assim a política fecha o
 * que mais importa: o sistema dentro do iframe de outro site, plugin, `<base>`
 * trocada, formulário mandando para fora e conexão com servidor estranho.
 *
 * - `img-src https:`: a prévia da assinatura de e-mail mostra o logo de onde
 *   quer que a pessoa o hospede; `blob:` é a prévia do logo da indústria antes
 *   de enviar, e `data:` a imagem que o gráfico exporta.
 * - `connect-src viacep`: o CEP é consultado direto do navegador (`lib/cep.ts`).
 *   O Sentry não entra aqui: o navegador o alcança pelo túnel `/monitoramento`,
 *   do próprio sistema (lá embaixo).
 * - `form-action asaas`: o cadastro termina no checkout do Asaas; sem
 *   JavaScript, é o formulário que segue para lá.
 * - Em desenvolvimento, `'unsafe-eval'` é do React (as pilhas de erro do
 *   servidor), e sem `upgrade-insecure-requests`: o PC é aberto pela rede local
 *   em http, e ele levaria tudo para um https que não existe.
 */
const politicaDeConteudo = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${emDesenvolvimento ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://viacep.com.br",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.asaas.com",
  "frame-ancestors 'none'",
  ...(emDesenvolvimento ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          { key: "Content-Security-Policy", value: politicaDeConteudo },
          // Só https por dois anos, subdomínios junto. Sem `preload`: entrar
          // na lista dos navegadores é difícil de desfazer.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // O mesmo que `frame-ancestors 'none'`, para navegador antigo.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Para fora, só o endereço do site — nunca o caminho, que na
          // redefinição de senha leva o token.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nada aqui usa câmera, microfone, localização ou pagamento pelo navegador.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
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
