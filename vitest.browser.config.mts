import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * Testes que precisam de um navegador de verdade.
 *
 * Existem por um motivo específico: há comportamento nosso que só é observável
 * depois que o layout acontece. A lista do `SelecaoBuscavel` decide para que
 * lado abrir medindo o espaço na janela — e isso não é testável em `node`, onde
 * todo elemento tem altura zero e toda medida dá o mesmo número.
 *
 * Foi exatamente esse buraco que deixou passar a lista abrindo para fora da
 * tela: sete produtos no DOM, um visível, e nenhum teste com o que reclamar.
 *
 * Separados do `npm test` como os de banco: sobem um Chromium, levam segundos,
 * e o motor de preço não pode ficar refém disso.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Chega de carona por `ui.tsx` e estoura sem o `process` do Node.
      "next/link": fileURLToPath(new URL("./test/next-link.tsx", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.btest.tsx"],
    setupFiles: ["./test/navegador.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      // Tamanho fixo: o que se testa aqui é geometria, e uma janela que muda de
      // máquina para máquina faria o mesmo teste passar aqui e falhar ali.
      viewport: { width: 1280, height: 720 },
    },
  },
});
