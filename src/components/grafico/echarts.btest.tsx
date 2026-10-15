/**
 * Testes de navegador do `Grafico` — o que só existe com canvas e quadros de
 * animação de verdade.
 *
 * O caso que deu origem a este arquivo: o cartão de indústrias derrubava a
 * página com "Cannot read properties of null (reading 'layerStack')". Era o
 * ZRender desenhando num gráfico já descartado — um quadro de pintura agendado
 * antes do `dispose` e executado depois. Em `node` não há canvas nem
 * `requestAnimationFrame`, e o teste passaria sem olhar nada.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import * as echarts from "echarts/core";

import { Grafico, descartar, type OpcaoGrafico } from "./echarts";
import { segurarALargada } from "./fila-de-graficos";

/** Espera N quadros de animação — é neles que o desenho atrasado acontece. */
const quadros = (n: number) =>
  new Promise<void>((resolver) => {
    const passo = (falta: number) => (falta ? requestAnimationFrame(() => passo(falta - 1)) : resolver());
    passo(n);
  });

/** Junta os erros não tratados da página enquanto o teste roda. */
function capturarErros() {
  const erros: string[] = [];
  const aoErro = (e: ErrorEvent) => {
    erros.push(e.message);
    e.preventDefault();
  };
  window.addEventListener("error", aoErro);
  return { erros, parar: () => window.removeEventListener("error", aoErro) };
}

function novaCaixa() {
  const caixa = document.createElement("div");
  caixa.style.cssText = "width:600px;height:400px";
  document.body.appendChild(caixa);
  return caixa;
}

/**
 * Um gráfico grande o bastante para o ZRender NÃO terminar de desenhar num
 * quadro só: com renderização progressiva, ele pinta um pedaço e agenda o resto
 * com `requestAnimationFrame` — o caminho exato do erro.
 */
function graficoPesado(caixa: HTMLElement) {
  const instancia = echarts.init(caixa, undefined, { renderer: "canvas" });
  const pontos = Array.from({ length: 200_000 }, (_, i) => [i % 1000, (i * 7919) % 1000]);
  instancia.setOption({
    animation: false,
    xAxis: { type: "value" },
    yAxis: { type: "value" },
    series: [{ type: "scatter", data: pontos, progressive: 2000, progressiveThreshold: 1000, large: false }],
  });
  return instancia;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("descartar o gráfico", () => {
  test("o defeito existe: dispose comum + pintura atrasada quebra a página", async () => {
    // Sem esta prova, o teste de baixo poderia passar só porque o cenário não
    // reproduz nada — e a correção seria indistinguível de sorte.
    const instancia = graficoPesado(novaCaixa());
    await quadros(1); // a pintura começou e agendou o resto num quadro seguinte
    const pintor = instancia.getZr().painter as unknown as {
      refresh: () => void;
      _paintList: () => void;
    };
    instancia.dispose();
    // O que o quadro agendado faria: desenhar com o pintor já apagado.
    expect(() => pintor.refresh()).toThrow(/Cannot read properties of null/);
    // Neutraliza o quadro órfão de verdade, senão ele estoura no meio do
    // próximo teste — que é exatamente o defeito que este arquivo prova.
    pintor._paintList = () => {};
  });

  test("com `descartar`, a pintura atrasada não quebra nada", async () => {
    const { erros, parar } = capturarErros();
    const instancia = graficoPesado(novaCaixa());
    await quadros(1);
    const pintor = instancia.getZr().painter as unknown as { refresh: () => void };
    descartar(instancia);
    expect(() => pintor.refresh()).not.toThrow();
    await quadros(20);
    parar();
    expect(erros).toEqual([]);
  });

  test("descartar no meio de uma pintura em vários quadros não deixa erro", async () => {
    const { erros, parar } = capturarErros();
    for (let i = 0; i < 5; i++) {
      const instancia = graficoPesado(novaCaixa());
      await quadros(1); // a pintura começou e agendou o resto
      descartar(instancia);
    }
    await quadros(30);
    parar();
    expect(erros).toEqual([]);
  });
});

describe("Grafico", () => {
  const opcao: OpcaoGrafico = {
    tooltip: {},
    xAxis: { type: "category", data: ["a", "b", "c"] },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: [1, 2, 3] }],
  };

  test("montar, trocar a opção e desmontar várias vezes, com balão aberto, sem erro", async () => {
    const { erros, parar } = capturarErros();
    for (let i = 0; i < 6; i++) {
      const tela = await render(<Grafico opcao={opcao} altura={240} rotulo="teste" />);
      const canvas = tela.container.querySelector("canvas")!;
      const caixa = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new MouseEvent("mousemove", { clientX: caixa.left + 100, clientY: caixa.top + 120, bubbles: true }),
      );
      await tela.rerender(
        <Grafico opcao={{ ...opcao, series: [{ type: "bar", data: [3, 2, 1] }] }} altura={240} rotulo="teste" />,
      );
      await tela.unmount();
    }
    await quadros(20);
    parar();
    expect(erros).toEqual([]);
  });

  /** Vários gráficos: os primeiros na tela, o resto abaixo da dobra. */
  const pagina = (quantos: number) => (
    <div style={{ width: 400 }}>
      {Array.from({ length: quantos }, (_, i) => (
        // A janela de teste tem 720px: o terceiro já começa abaixo dela.
        <div key={i} style={{ height: 150, marginTop: i === 2 ? 1000 : 0 }}>
          <Grafico opcao={opcao} altura={120} rotulo={`teste ${i}`} />
        </div>
      ))}
    </div>
  );

  test("os que estão na tela nascem juntos, no mesmo render; os de fora, depois da entrada", async () => {
    const tela = await render(pagina(5));
    const naTela = () =>
      [...tela.container.querySelectorAll("[data-grafico]")].map((caixa) => caixa.querySelector("canvas") !== null);
    // Na tela: prontos já no render, para animarem a entrada no mesmo quadro.
    expect(naTela()).toEqual([true, true, false, false, false]);
    // Fora: nada enquanto a entrada dos de cima ainda anima…
    await new Promise((resolver) => setTimeout(resolver, 500));
    expect(naTela().slice(2)).toEqual([false, false, false]);
    // …e todos prontos pouco depois, antes de alguém rolar até eles.
    await vi.waitFor(() => expect(naTela()).toEqual([true, true, true, true, true]), { timeout: 4000 });
    await tela.unmount();
  });

  test("desmontar antes da vez na fila não cria gráfico nem dá erro", async () => {
    const { erros, parar } = capturarErros();
    const tela = await render(pagina(8));
    // Desmonta com boa parte ainda esperando a vez.
    await tela.unmount();
    await new Promise((resolver) => setTimeout(resolver, 1500));
    parar();
    expect(erros).toEqual([]);
    expect(document.querySelectorAll("canvas")).toHaveLength(0);
  });

  test("o canvas acompanha a altura do contêiner quando ele cresce e encolhe", async () => {
    const tela = await render(
      <div style={{ display: "flex", flexDirection: "column", height: 500, width: 400 }}>
        <Grafico opcao={opcao} altura={200} rotulo="teste" />
      </div>,
    );
    await quadros(4);
    const canvas = () => tela.container.querySelector("canvas")!;
    expect(parseFloat(canvas().style.height)).toBe(500);

    await tela.rerender(
      <div style={{ display: "flex", flexDirection: "column", height: 260, width: 400 }}>
        <Grafico opcao={opcao} altura={200} rotulo="teste" />
      </div>,
    );
    await quadros(4);
    expect(parseFloat(canvas().style.height)).toBe(260);
  });
});

/** Prende a thread principal, como uma tarefa longa do React. */
function ocupar(ms: number) {
  const ate = performance.now() + ms;
  while (performance.now() < ate) {
    // nada: só ocupa
  }
}

describe("a largada da animação", () => {
  test("o relógio fica parado durante a tarefa longa e solta quando os quadros voltam ao ritmo", async () => {
    const caixa = novaCaixa();
    const relogio = { pause: vi.fn(), resume: vi.fn() };

    segurarALargada(caixa, relogio);
    expect(relogio.pause).toHaveBeenCalledTimes(1);

    // O resto do clique: a animação já estaria correndo, sem ninguém ver.
    ocupar(150);
    await quadros(1);
    expect(relogio.resume).not.toHaveBeenCalled();

    await quadros(3);
    expect(relogio.resume).toHaveBeenCalledTimes(1);
    caixa.remove();
  });

  test("desistir antes da largada não solta o relógio", async () => {
    const caixa = novaCaixa();
    const relogio = { pause: vi.fn(), resume: vi.fn() };

    const desistir = segurarALargada(caixa, relogio);
    desistir();
    await quadros(4);
    expect(relogio.resume).not.toHaveBeenCalled();
    caixa.remove();
  });
});
