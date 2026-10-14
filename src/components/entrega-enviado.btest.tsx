/**
 * Testes de navegador da animação de "enviado".
 *
 * O voo é geometria e tempo — avião e rastro seguem um caminho calculado em
 * pixels da janela —, e isso só existe com layout de verdade. O que se protege:
 *
 *   - o avião passa pelo centro da tela, que é onde o cartão pousa;
 *   - ele anima SÓ `transform` e `opacity`, as propriedades que o compositor
 *     anima sem a thread principal. Era `offset-path` e um SVG redesenhado a
 *     cada quadro, e travava justo quando o React recarregava a tela depois
 *     do envio. O desenho é o mesmo — comparado em print, quadro a quadro;
 *   - o rastro é a mesma linha contínua de antes, desenhando-se atrás dele;
 *   - com as animações desligadas na conta, nada voa.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { EntregaEnviado } from "./entrega-enviado";

function abrir() {
  return render(
    <EntregaEnviado
      titulo="Pedido enviado para a QUALYPLAST"
      para={["compras@qualyplast.com.br"]}
      cc={[]}
      fechar={() => {}}
    />,
  );
}

function aviao() {
  return document.querySelector<HTMLElement>(".entrega-aviao")!;
}

/** O centro do ícone do avião, na janela. */
function centroDoAviao() {
  const caixa = aviao().querySelector("svg")!.getBoundingClientRect();
  return { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
}

afterEach(() => {
  delete document.documentElement.dataset.animacoes;
});

describe("EntregaEnviado", () => {
  test("o avião voa só com transform e opacity", async () => {
    await abrir();
    const [voo] = aviao().getAnimations();

    expect(voo).toBeDefined();
    const quadros = (voo.effect as KeyframeEffect).getKeyframes();
    const propriedades = new Set(
      quadros.flatMap((quadro) =>
        Object.keys(quadro).filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)),
      ),
    );
    expect([...propriedades].sort()).toEqual(["opacity", "transform"]);
  });

  test("o avião passa pelo centro da tela, onde o cartão pousa", async () => {
    await abrir();
    const [voo] = aviao().getAnimations();
    voo.pause();

    const centro = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let maisPerto = Infinity;
    for (let t = 0; t <= 1250; t += 10) {
      voo.currentTime = t;
      const { x, y } = centroDoAviao();
      maisPerto = Math.min(maisPerto, Math.hypot(x - centro.x, y - centro.y));
    }

    expect(maisPerto).toBeLessThan(12);
  });

  test("o rastro é uma linha contínua, que acende na ordem do caminho", async () => {
    await abrir();
    const trechos = [...document.querySelectorAll<HTMLElement>(".entrega-trecho")];
    expect(trechos.length).toBeGreaterThan(60);

    const atrasos = trechos.map((t) => parseInt(t.style.getPropertyValue("--atraso"), 10));
    expect(atrasos).toEqual([...atrasos].sort((a, b) => a - b));
    expect(atrasos[0]).toBeGreaterThanOrEqual(0);
    expect(atrasos.at(-1)).toBeLessThanOrEqual(1250);

    // Contínua: cada trecho começa onde o anterior termina — sem fresta.
    const extremos = trechos.map((t) => {
      const [, x, y] = t.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!.map(Number);
      const angulo = (Number(t.style.transform.match(/rotate\(([-\d.]+)deg\)/)![1]) * Math.PI) / 180;
      const comprimento = parseFloat(t.style.width) - 1;
      return { inicio: { x, y }, fim: { x: x + Math.cos(angulo) * comprimento, y: y + Math.sin(angulo) * comprimento } };
    });
    for (let i = 1; i < extremos.length; i++) {
      const fresta = Math.hypot(
        extremos[i].inicio.x - extremos[i - 1].fim.x,
        extremos[i].inicio.y - extremos[i - 1].fim.y,
      );
      expect(fresta).toBeLessThan(1);
    }

    // Nada de SVG de rastro redesenhado nem `offset-path`.
    expect(document.querySelector(".entrega-rastro svg")).toBeNull();
    expect(getComputedStyle(aviao()).offsetPath).toBe("none");
  });

  test("a ponta do rastro fica sob o avião no instante em que acende", async () => {
    await abrir();
    const [voo] = aviao().getAnimations();
    voo.pause();

    for (const trecho of document.querySelectorAll<HTMLElement>(".entrega-trecho")) {
      voo.currentTime = parseInt(trecho.style.getPropertyValue("--atraso"), 10);
      const caixa = trecho.getBoundingClientRect();
      const { x, y } = centroDoAviao();
      const distancia = Math.hypot(caixa.left + caixa.width / 2 - x, caixa.top + caixa.height / 2 - y);
      // O meio do trecho fica dentro do avião, que tem 46px.
      expect(distancia).toBeLessThan(10);
    }
  });

  test("com as animações desligadas, nada voa", async () => {
    document.documentElement.dataset.animacoes = "desativadas";
    await abrir();

    expect(aviao().getAnimations()).toHaveLength(0);
    expect(getComputedStyle(aviao()).display).toBe("none");
  });
});
