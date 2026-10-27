/**
 * Gera os ícones do RepPlast como aplicativo: o que aparece na tela inicial do
 * celular ("Adicionar à Tela de Início" no iPhone, "Instalar app" no Android),
 * na aba do navegador e no alternador de apps.
 *
 * A marca é a do logo dos e-mails (`gerar-logo-email.mjs`) e do marca-texto da
 * tela de entrar: o "Rp" em Plus Jakarta Sans 800, cor de tinta, sobre uma
 * etiqueta amarela — aqui inclinada, num quadro escuro da mesma tinta, para o
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
 *     formato do aparelho (círculo, gota...), então a etiqueta inteira fica
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

/** Inclinação da etiqueta, em graus: a marca de quem destacou à mão. */
const INCLINACAO = -6;

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
 */
function svg({ raio, tamanho }) {
  const r = Math.round(1024 * raio);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<defs>
  <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2a2516"/><stop offset="1" stop-color="#121008"/>
  </linearGradient>
  <linearGradient id="etiqueta" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff5a6"/><stop offset="1" stop-color="#f8e46a"/>
  </linearGradient>
  <clipPath id="quadro"><rect width="1024" height="1024" rx="${r}"/></clipPath>
</defs>
<g clip-path="url(#quadro)">
  <rect width="1024" height="1024" fill="url(#fundo)"/>
  <g transform="translate(512 512) scale(${tamanho}) rotate(${INCLINACAO}) translate(-512 -512)">
    <rect x="196" y="282" width="632" height="460" rx="92" fill="url(#etiqueta)"/>
    <g fill="${TINTA}">${letras(290, 512, 486)}</g>
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
  // A etiqueta inclinada mede ~0,98 do lado na diagonal; 0,8 do lado é o
  // diâmetro da zona segura — 0,74 deixa uma folga.
  { destino: "public/icones/icone-mascaravel-512.png", lado: 512, raio: 0, tamanho: 0.74 },
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
