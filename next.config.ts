import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Sem isto o Turbopack sobe a árvore procurando lockfile e encontra um
    // package-lock.json solto em C:\Users\gustt, fora do projeto.
    root: import.meta.dirname,
  },
};

export default nextConfig;
