import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads passam por server action, e o padrão do Next é 1 MB. O maior é o
    // envio do pedido por e-mail: a aplicação valida 20 MB de anexos (ver
    // `lib/envio-pedido.ts`), e a folga cobre o overhead do multipart — para a
    // pessoa receber a mensagem de "passa de 20 MB" em vez de um erro cru do
    // framework. O logo (2 MB) cabe com sobra.
    serverActions: { bodySizeLimit: "25mb" },
  },
  turbopack: {
    // Sem isto o Turbopack sobe a árvore procurando lockfile e encontra um
    // package-lock.json solto em C:\Users\gustt, fora do projeto.
    root: import.meta.dirname,
  },
};

export default nextConfig;
