/**
 * Gera `src/lib/larguras-escritorio.ts`: a largura de cada caractere da Plus
 * Jakarta Sans 800, a fonte do nome do escritório no topo.
 *
 * O cadastro recusa o nome que não caberia no topo (`escritorio-regras.ts`), e
 * isso precisa ser decidido no servidor, onde não há navegador para medir. A
 * tabela é a medida que o navegador faria, tirada do próprio arquivo da fonte.
 *
 * Rode de novo só se a fonte ou o peso do nome mudarem:
 *   node scripts/gerar-larguras-escritorio.mjs
 */

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit");

const arquivo = path.join(
  process.cwd(),
  "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff",
);
const fonte = fontkit.openSync(arquivo);

const caracteres = [];
for (let c = 32; c <= 126; c++) caracteres.push(String.fromCharCode(c));
for (let c = 160; c <= 255; c++) caracteres.push(String.fromCharCode(c));
caracteres.push(..."“”‘’–—•…€");

const larguras = {};
for (const caractere of caracteres) {
  const glifo = fonte.glyphForCodePoint(caractere.codePointAt(0));
  if (!glifo || glifo.id === 0) continue;
  larguras[caractere] = Math.round((glifo.advanceWidth / fonte.unitsPerEm) * 10000) / 10000;
}

const linhas = Object.entries(larguras).map(
  ([caractere, largura]) => `  ${JSON.stringify(caractere)}: ${largura},`,
);

writeFileSync(
  path.join(process.cwd(), "src/lib/larguras-escritorio.ts"),
  `// Gerado por scripts/gerar-larguras-escritorio.mjs — não editar à mão.
// Largura de cada caractere da Plus Jakarta Sans 800, em em (1 = tamanho da fonte).

export const LARGURAS_EM: Record<string, number> = {
${linhas.join("\n")}
};
`,
);

console.log(`${linhas.length} caracteres`);
