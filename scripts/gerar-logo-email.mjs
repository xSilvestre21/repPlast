/**
 * Gera `public/email/repplast-logo.png`: a marca no cabeçalho dos e-mails do
 * sistema (`src/lib/email-sistema-html.ts`).
 *
 * O e-mail não carrega a fonte do site — o Gmail troca tudo por Arial —, então a
 * marca vai como imagem: "RepPlast" na Plus Jakarta Sans 800 sobre o marca-texto
 * amarelo, o mesmo `.marcador` do herói da landing. Tirada pelo Chromium do
 * Playwright em 2x, para ficar nítida em tela retina.
 *
 * Rode de novo só se a marca mudar:
 *   node scripts/gerar-logo-email.mjs
 */

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

// Em data URL: a página nasce em about:blank, de onde o Chromium não lê
// `file://` — com o caminho, a marca saía calada na serifa padrão.
const fonte =
  "data:font/woff;base64," +
  readFileSync(
    path.join(process.cwd(), "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff"),
  ).toString("base64");
const destino = path.join(process.cwd(), "public/email/repplast-logo.png");

const pagina = `<!doctype html>
<html><head><style>
  @font-face { font-family: "Jakarta"; font-weight: 800; src: url("${fonte}") format("woff"); }
  html, body { margin: 0; background: transparent; }
  span {
    display: inline-block;
    font: 800 30px/1.15 "Jakarta";
    letter-spacing: -0.03em;
    color: #1a1608;
    background: #fcf08f;
    border-radius: 6px;
    padding: 1px 9px 2px;
  }
</style></head>
<body><span id="marca">RepPlast</span></body></html>`;

const navegador = await chromium.launch();
try {
  const contexto = await navegador.newContext({ deviceScaleFactor: 2 });
  const aba = await contexto.newPage();
  await aba.setContent(pagina);
  const carregou = await aba.evaluate(async () => {
    await document.fonts.load('800 30px "Jakarta"');
    return document.fonts.check('800 30px "Jakarta"');
  });
  if (!carregou) throw new Error("A Plus Jakarta Sans não carregou — a marca sairia em outra fonte.");
  mkdirSync(path.dirname(destino), { recursive: true });
  await aba.locator("#marca").screenshot({ path: destino, omitBackground: true });
  const { width, height } = await aba.locator("#marca").boundingBox();
  console.log(`${destino}: ${Math.round(width)}×${Math.round(height)} (gravado em 2x)`);
} finally {
  await navegador.close();
}
