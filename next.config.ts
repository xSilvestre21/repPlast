import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // O upload de logo passa por server action. O padrão do Next é 1 MB, e o
    // limite que a aplicação valida é 2 MB — a folga cobre o overhead do
    // multipart, para o usuário receber a mensagem de "passa de 2 MB" em vez
    // de um erro cru do framework.
    serverActions: { bodySizeLimit: "3mb" },
  },
  turbopack: {
    // Sem isto o Turbopack sobe a árvore procurando lockfile e encontra um
    // package-lock.json solto em C:\Users\gustt, fora do projeto.
    root: import.meta.dirname,
  },
};

export default nextConfig;
