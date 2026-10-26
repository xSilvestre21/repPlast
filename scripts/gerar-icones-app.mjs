/**
 * Gera os ícones do RepPlast como aplicativo: o que aparece na tela inicial do
 * celular ("Adicionar à Tela de Início" no iPhone, "Instalar app" no Android),
 * na aba do navegador e no alternador de apps.
 *
 * A marca é a mesma do logo dos e-mails (`gerar-logo-email.mjs`): Plus Jakarta
 * Sans 800 sobre o marca-texto amarelo. Num quadrado de ícone "RepPlast" não
 * cabe legível, então vai o monograma "Rp".
 *
 *   - `src/app/icon.png` (64px): a aba do navegador. Convenção do Next, que
 *     escreve a tag sozinho.
 *   - `src/app/apple-icon.png` (180px): a tela inicial do iPhone. Sem
 *     transparência e sem canto arredondado — o iOS arredonda sozinho.
 *   - `public/icones/icone-192.png` e `icone-512.png`: o manifesto (Android).
 *   - `public/icones/icone-mascaravel-512.png`: o Android recorta o ícone no
 *     formato do aparelho (círculo, gota...), então o "Rp" fica dentro dos 80%
 *     do meio, a zona que nenhum recorte come.
 *
 * Rode de novo só se a marca mudar:
 *   node scripts/gerar-icones-app.mjs
 */

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const AMARELO = "#fcf08f";
const TINTA = "#1a1608";

// Em data URL: a página nasce em about:blank, de onde o Chromium não lê `file://`.
const fonte =
  "data:font/woff;base64," +
  readFileSync(
    path.join(process.cwd(), "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff"),
  ).toString("base64");

/** `raio` em fração do lado; `letra` em fração do lado (o tamanho do "Rp"). */
const ICONES = [
  { destino: "src/app/icon.png", lado: 64, raio: 0.22, letra: 0.5 },
  { destino: "src/app/apple-icon.png", lado: 180, raio: 0, letra: 0.46 },
  { destino: "public/icones/icone-192.png", lado: 192, raio: 0.22, letra: 0.46 },
  { destino: "public/icones/icone-512.png", lado: 512, raio: 0.22, letra: 0.46 },
  { destino: "public/icones/icone-mascaravel-512.png", lado: 512, raio: 0, letra: 0.36 },
];

function pagina({ lado, raio, letra }) {
  return `<!doctype html>
<html><head><style>
  @font-face { font-family: "Jakarta"; font-weight: 800; src: url("${fonte}") format("woff"); }
  html, body { margin: 0; background: transparent; }
  #icone {
    width: ${lado}px; height: ${lado}px;
    display: grid; place-items: center;
    background: ${AMARELO};
    border-radius: ${Math.round(lado * raio)}px;
    font: 800 ${Math.round(lado * letra)}px/1 "Jakarta";
    letter-spacing: -0.05em;
    color: ${TINTA};
  }
  /* A caixa da fonte tem mais espaço em cima que embaixo: sem isto o "Rp" fica
     visivelmente alto no quadrado. */
  #icone span { transform: translate(-0.02em, -0.03em); }
</style></head>
<body><div id="icone"><span>Rp</span></div></body></html>`;
}

const navegador = await chromium.launch();
try {
  const contexto = await navegador.newContext({ deviceScaleFactor: 1 });
  const aba = await contexto.newPage();
  for (const icone of ICONES) {
    await aba.setContent(pagina(icone));
    const carregou = await aba.evaluate(async () => {
      await document.fonts.load('800 40px "Jakarta"');
      return document.fonts.check('800 40px "Jakarta"');
    });
    if (!carregou) throw new Error("A Plus Jakarta Sans não carregou — o ícone sairia em outra fonte.");
    const destino = path.join(process.cwd(), icone.destino);
    mkdirSync(path.dirname(destino), { recursive: true });
    // O ícone da Apple não pode ter transparência: o iOS pintaria o fundo de preto.
    await aba.locator("#icone").screenshot({ path: destino, omitBackground: icone.raio > 0 });
    console.log(`${icone.destino}: ${icone.lado}×${icone.lado}`);
  }
} finally {
  await navegador.close();
}
