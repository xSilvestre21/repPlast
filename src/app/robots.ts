import type { MetadataRoute } from "next";

/**
 * O que os buscadores podem ler: só as páginas públicas — a entrada (que é a
 * apresentação do sistema), o começo do cadastro e os textos legais. O resto
 * exige login e não tem o que indexar; e a redefinição de senha leva um token
 * no endereço, que não pode parar num índice.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/entrar", "/comecar", "/termos", "/privacidade"],
      disallow: "/",
    },
  };
}
