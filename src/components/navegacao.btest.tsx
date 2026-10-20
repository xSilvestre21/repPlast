/**
 * Testes de navegador do nome do escritório no topo.
 *
 * O nome não pode aparecer cortado com "…": encolhe a fonte e, se preciso,
 * quebra em duas linhas (`NomeQueCabe`), e o cadastro recusa o que nem assim
 * caberia (`cabeNoTopo`). Essa promessa só se confere com o layout de verdade —
 * a largura que sobra ao lado das abas — e com a fonte de verdade: a Plus
 * Jakarta é mais larga que a fonte do sistema, e é com ela que a tabela de
 * `cabeNoTopo` foi tirada.
 *
 * Rode com:  npm run test:navegador
 */

import "@fontsource/plus-jakarta-sans/800.css";

import { beforeAll, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { cabeNoTopo, LARGURA_MINIMA_DO_NOME } from "@/lib/escritorio-regras";

vi.mock("next/navigation", () => ({ usePathname: () => "/pedidos" }));
// A ação de sair puxa o banco; aqui só o botão importa.
vi.mock("@/app/(entrada)/acoes", () => ({ sair: async () => {} }));

import { Navegacao } from "./navegacao";

/**
 * As larguras onde o nome tem menos espaço, e as vizinhas: 320 a 767 é o
 * celular, com a gaveta; 768 é onde as abas aparecem (só ícone); 1279 é o
 * último antes dos rótulos; 1280 e 1366, o notebook, com rótulos — o mínimo.
 */
const LARGURAS = [320, 360, 640, 767, 768, 1024, 1279, 1280, 1366];

/** Só as larguras com a barra de abas (do `md` para cima). */
const COM_ABAS = LARGURAS.filter((largura) => largura >= 768);

const NOMES = [
  "Representação Prado",
  "REPRESENTAÇÕES COMERCIAIS PRADO LTDA",
  "MOREIRA & GUIMARÃES REPRESENTAÇÕES LTDA",
  "Moreira & Guimarães Representações Ltda",
  "COMÉRCIO E REPRESENTAÇÕES WM MAIA LTDA",
  "WM REPRESENTAÇÕES DE EMBALAGENS PLÁSTICAS",
  "MW EMBALAGENS PLÁSTICAS REPRESENTAÇÕES",
  "QUALIPLAST REPRESENTAÇÕES COMERCIAIS",
  "QUALIPLAST REP. COMERCIAIS",
  "Representações Comerciais Prado",
  "PRADO & FILHOS REPRESENTAÇÕES",
  "Rep. Prado Ltda",
  "WWW MMM WWW MMM WWW MMM WWW MMM",
  "Representações Comerciais de Embalagens Plásticas Ltda",
];

beforeAll(async () => {
  document.documentElement.style.setProperty("--fonte-sans", '"Plus Jakarta Sans"');
  await document.fonts.load('800 18px "Plus Jakarta Sans"');
});

async function noTopo(nome: string) {
  const tela = await render(<Navegacao nomeUsuario="Ana Prado" nomeOrganizacao={nome} />);
  const elemento = document.querySelector<HTMLElement>("header [data-nome-escritorio]")!;
  return { tela, elemento };
}

/**
 * Conta as linhas pelo texto, não pela caixa: as caixas de linha que o
 * navegador montou. Independe de como o componente decidiu que cabia.
 */
function linhasDoTexto(elemento: HTMLElement) {
  const faixa = document.createRange();
  faixa.selectNodeContents(elemento);
  return new Set([...faixa.getClientRects()].map((r) => Math.round(r.top))).size;
}

function inteiro(elemento: HTMLElement) {
  return (
    elemento.scrollWidth <= elemento.clientWidth &&
    linhasDoTexto(elemento) <= 2
  );
}

describe("nome do escritório no topo", () => {
  test.each(LARGURAS)("a %ipx, o topo dá ao nome pelo menos o que cabeNoTopo supõe", async (largura) => {
    await page.viewport(largura, 720);
    const { tela } = await noTopo("X".repeat(80));
    const link = document.querySelector<HTMLElement>("header a[title]")!;

    expect(link.getBoundingClientRect().width).toBeGreaterThanOrEqual(LARGURA_MINIMA_DO_NOME);
    await tela.unmount();
  });

  test.each(LARGURAS)("a %ipx, todo nome aceito no cadastro aparece inteiro", async (largura) => {
    await page.viewport(largura, 720);
    const aceitos = NOMES.filter(cabeNoTopo);
    expect(aceitos.length).toBeGreaterThanOrEqual(5);

    for (const nome of aceitos) {
      const { tela, elemento } = await noTopo(nome);
      expect(inteiro(elemento), `"${nome}" a ${largura}px`).toBe(true);
      await tela.unmount();
    }
  });

  test.each(LARGURAS)("a %ipx, nem nome recusado no cadastro aparece com …", async (largura) => {
    // O nome gravado antes da regra de `cabeNoTopo`: não cabe em duas linhas,
    // mas aparece inteiro — em três, ou quebrando a palavra — e dentro do topo.
    await page.viewport(largura, 720);
    const recusados = [...NOMES, "MOREIRA REPRESENTAÇÕES LTDA", "X".repeat(60)].filter(
      (nome) => !cabeNoTopo(nome),
    );

    for (const nome of recusados) {
      const { tela, elemento } = await noTopo(nome);
      const caixa = elemento.getBoundingClientRect();
      const topo = document.querySelector("header")!.getBoundingClientRect();

      expect(getComputedStyle(elemento).textOverflow, nome).not.toBe("ellipsis");
      expect(elemento.scrollWidth, nome).toBeLessThanOrEqual(elemento.clientWidth);
      expect(caixa.top, nome).toBeGreaterThanOrEqual(topo.top);
      expect(caixa.bottom, nome).toBeLessThanOrEqual(topo.bottom);
      await tela.unmount();
    }
  });

  test("nome curto fica no tamanho cheio, numa linha", async () => {
    await page.viewport(1024, 720);
    const { tela, elemento } = await noTopo("Prado Rep.");

    expect(elemento.style.fontSize).toBe("18px");
    expect(elemento.dataset.linhas).toBe("1");
    await tela.unmount();
  });

  test.each(COM_ABAS)("a %ipx, as abas ficam no centro do topo com qualquer nome", async (largura) => {
    await page.viewport(largura, 720);
    const centros: number[] = [];

    for (const nome of ["Vera & Assis", "Moreira & Guimarães Representações Ltda", "X".repeat(80)]) {
      const { tela } = await noTopo(nome);
      const abas = document.querySelector<HTMLElement>("header nav ul")!.getBoundingClientRect();
      const linha = document.querySelector<HTMLElement>("header nav")!.parentElement!.getBoundingClientRect();
      centros.push(abas.left + abas.width / 2 - (linha.left + linha.width / 2));
      await tela.unmount();
    }

    for (const desvio of centros) expect(Math.abs(desvio)).toBeLessThan(1);
  });

  test("nome comprido encolhe na janela estreita e cresce de volta na larga", async () => {
    await page.viewport(1280, 720);
    const { tela, elemento } = await noTopo("Representações Prado");
    const tamanho = () => parseFloat(elemento.style.fontSize);
    const naEstreita = tamanho();
    expect(elemento.dataset.linhas).toBe("2");

    await page.viewport(1024, 720);
    await expect.poll(() => elemento.dataset.linhas).toBe("1");
    expect(tamanho()).toBeGreaterThan(naEstreita);
    expect(inteiro(elemento)).toBe(true);
    await tela.unmount();
  });
});
