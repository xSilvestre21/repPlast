import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Abrir o servidor de desenvolvimento do PC a partir do notebook, pela rede
  // local. Sem isto o Next bloqueia os recursos de dev vindos de outra origem e
  // a página carrega sem a parte interativa.
  allowedDevOrigins: ["192.168.15.129"],
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

export default nextConfig;
