import { defineConfig } from "vitest/config";

/**
 * Testes que precisam de banco de verdade.
 *
 * Separados do `npm test` de propósito: os testes do motor de preço rodam em
 * milissegundos e sem dependência nenhuma, e não devem ficar reféns de um
 * Postgres no ar.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    setupFiles: ["dotenv/config"],
    // O banco é compartilhado entre os arquivos; rodar em série evita
    // interferência entre eles.
    fileParallelism: false,
    // O padrão de 5s do Vitest é pensado para teste unitário. Aqui cada
    // operação vai até um Postgres na nuvem, e um teste que monta o cenário
    // faz várias — o limite precisa acomodar a latência da rede.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
