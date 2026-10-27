/**
 * Gera os ícones do RepPlast como aplicativo: o que aparece na tela inicial do
 * celular ("Adicionar à Tela de Início" no iPhone, "Instalar app" no Android),
 * na aba do navegador e no alternador de apps.
 *
 * Uma sacola plástica de alça vazada — o que o representante vende — no
 * amarelo do marca-texto (`--destaque`), com as linhas longas da solda e o
 * "Rp" do logo dos e-mails (`gerar-logo-email.mjs`) em Plus Jakarta Sans 800,
 * cor de tinta, centrado no corpo. O quadro é escuro, da mesma tinta, para o
 * ícone se destacar na tela do celular, que costuma ter fundo claro.
 *
 * Tudo nasce de um SVG só, com as letras convertidas em desenho (`fontkit`):
 * não depende da fonte instalada e fica nítido em qualquer tamanho.
 *
 *   - `src/app/icon.svg`: a aba do navegador, vetorial. Convenção do Next,
 *     que escreve a tag sozinho.
 *   - `src/app/icon.png` (96px): a aba no navegador que não lê SVG.
 *   - `src/app/apple-icon.png` (180px): a tela inicial do iPhone. Sem
 *     transparência e sem canto arredondado — o iOS arredonda sozinho.
 *   - `public/icones/icone-192.png`, `-512` e `-1024`: o manifesto (Android,
 *     computador). O web.dev pede 192 e 512; o 1024 serve às telas grandes.
 *   - `public/icones/icone-mascaravel-512.png`: o Android recorta o ícone no
 *     formato do aparelho (círculo, gota...), então a sacola inteira fica
 *     dentro do círculo de 40% de raio, a zona que nenhum recorte come.
 *
 * Rode de novo só se a marca mudar:
 *   node scripts/gerar-icones-app.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import * as fontkit from "fontkit";
import { chromium } from "playwright";

const TINTA = "#1a1608";
const FONTE = path.join(
  process.cwd(),
  "node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff",
);

/**
 * O "Rp" como desenho, centrado num quadro de 1024: `altura` é a da caixa
 * alta (o R), e o "p" desce abaixo dela. Espaçamento -0.05em, como no texto.
 */
function letras(altura, cx, cy) {
  const fonte = fontkit.openSync(FONTE);
  const linha = fonte.layout("Rp");
  const escala = altura / fonte.capHeight;
  const espaco = -0.05 * fonte.unitsPerEm;

  let x = 0;
  let esquerda = Infinity;
  let direita = -Infinity;
  const glifos = linha.glyphs.map((glifo, i) => {
    esquerda = Math.min(esquerda, x + glifo.bbox.minX);
    direita = Math.max(direita, x + glifo.bbox.maxX);
    const desenho = { d: glifo.path.toSVG(), x };
    x += linha.positions[i].xAdvance + espaco;
    return desenho;
  });

  const ox = cx - ((direita - esquerda) * escala) / 2 - esquerda * escala;
  const oy = cy + altura / 2;
  return glifos
    .map(({ d, x }) => {
      const t = `translate(${(ox + x * escala).toFixed(2)} ${oy.toFixed(2)}) scale(${escala.toFixed(5)} ${(-escala).toFixed(5)})`;
      return `<path transform="${t}" d="${d}"/>`;
    })
    .join("");
}

/**
 * O ícone num quadro de 1024. `raio`: canto arredondado, em fração do lado (0
 * = quadrado, para quem arredonda sozinho). `tamanho`: escala da etiqueta —
 * menor no mascarável, para caber na zona segura.
 *
 * A sacola: o corpo de canto arredondado, a alça vazada (o furo, com
 * `evenodd`) e três soldas — a de cima, a abaixo da alça e a do fundo.
 */
function svg({ raio, tamanho }) {
  const r = Math.round(1024 * raio);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<defs>
  <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2a2516"/><stop offset="1" stop-color="#121008"/>
  </linearGradient>
  <linearGradient id="sacola" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff7b2"/><stop offset="1" stop-color="#f5dc4c"/>
  </linearGradient>
  <clipPath id="quadro"><rect width="1024" height="1024" rx="${r}"/></clipPath>
</defs>
<g clip-path="url(#quadro)">
  <rect width="1024" height="1024" fill="url(#fundo)"/>
  <g transform="translate(512 512) scale(${tamanho}) translate(-512 -512)">
    <path fill="url(#sacola)" fill-rule="evenodd" d="
      M236 140 H788 Q836 140 836 188 V836 Q836 884 788 884 H236 Q188 884 188 836 V188 Q188 140 236 140 Z
      M424 236 H600 Q644 236 644 280 Q644 324 600 324 H424 Q380 324 380 280 Q380 236 424 236 Z"/>
    <g stroke="${TINTA}" stroke-opacity="0.2" stroke-width="12" stroke-linecap="round">
      <line x1="240" y1="186" x2="784" y2="186"/>
      <line x1="240" y1="384" x2="784" y2="384"/>
      <line x1="240" y1="852" x2="784" y2="852"/>
    </g>
    <g fill="${TINTA}">${letras(290, 512, 582)}</g>
  </g>
</g>
</svg>`;
}

const ICONES = [
  { destino: "src/app/icon.png", lado: 96, raio: 0.22, tamanho: 1 },
  { destino: "src/app/apple-icon.png", lado: 180, raio: 0, tamanho: 1 },
  { destino: "public/icones/icone-192.png", lado: 192, raio: 0.22, tamanho: 1 },
  { destino: "public/icones/icone-512.png", lado: 512, raio: 0.22, tamanho: 1 },
  { destino: "public/icones/icone-1024.png", lado: 1024, raio: 0.22, tamanho: 1 },
  // O canto da sacola fica a ~0,48 do lado do centro; a zona segura tem raio
  // de 0,4 — 0,78 traz o canto para dentro, com folga.
  { destino: "public/icones/icone-mascaravel-512.png", lado: 512, raio: 0, tamanho: 0.78 },
];

function salvar(destino, conteudo) {
  const caminho = path.join(process.cwd(), destino);
  mkdirSync(path.dirname(caminho), { recursive: true });
  writeFileSync(caminho, conteudo);
  console.log(destino);
}

salvar("src/app/icon.svg", svg({ raio: 0.22, tamanho: 1 }));

const navegador = await chromium.launch();
try {
  const aba = await navegador.newPage({ deviceScaleFactor: 1 });
  for (const { destino, lado, raio, tamanho } of ICONES) {
    await aba.setViewportSize({ width: lado, height: lado });
    await aba.setContent(
      `<body style="margin:0;background:transparent">
        <div id="icone" style="width:${lado}px;height:${lado}px">${svg({ raio, tamanho })}</div>
      </body>`,
    );
    // O ícone da Apple não pode ter transparência: o iOS pintaria o fundo de preto.
    salvar(destino, await aba.locator("#icone").screenshot({ omitBackground: raio > 0 }));
  }
} finally {
  await navegador.close();
}
