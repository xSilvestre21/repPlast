/**
 * Testes de navegador do aviso "pedido enviado".
 *
 * Em Chromium porque o que importa aqui é o que só existe com layout e CSS: o
 * cartão no CENTRO da tela, por cima de um fundo que escurece sem esconder a
 * página — foi por estar "num lugar estranho" que o aviso virou isto.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { EntregaEnviado } from "@/components/entrega-enviado";
import { BotaoEnviarEmail } from "./envio";

const BASE = {
  titulo: "Pedido enviado para a QUALYPLAST EMBALAGENS",
  para: ["compras@exemplo.com.br", "pcp@exemplo.com.br"],
  cc: ["voce@exemplo.com"],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("onde aparece", () => {
  test("o cartão fica no centro da tela, dizendo para quem foi", async () => {
    // Vai por portal para o <body>, fora do contêiner do `render`: busca no documento.
    await render(<EntregaEnviado {...BASE} fechar={() => {}} />);
    const cartao = document.querySelector('[role="status"]') as HTMLElement;

    expect(cartao.textContent).toContain("Pedido enviado para a QUALYPLAST EMBALAGENS");
    expect(cartao.textContent).toContain("compras@exemplo.com.br, pcp@exemplo.com.br");
    expect(cartao.textContent).toContain("cópia para voce@exemplo.com");

    // Espera o pouso (a animação termina em ~950 ms) antes de medir.
    await new Promise((pronto) => setTimeout(pronto, 1100));
    const caixa = cartao.getBoundingClientRect();
    const centroX = caixa.left + caixa.width / 2;
    const centroY = caixa.top + caixa.height / 2;

    expect(Math.abs(centroX - window.innerWidth / 2)).toBeLessThan(2);
    expect(Math.abs(centroY - window.innerHeight / 2)).toBeLessThan(2);
  });

  test("o fundo escurece a tela inteira, mas deixa ver a página por trás", async () => {
    await render(<EntregaEnviado {...BASE} fechar={() => {}} />);
    const fundo = document.querySelector(".entrega-fundo") as HTMLElement;
    const caixa = fundo.getBoundingClientRect();

    expect(caixa.width).toBe(window.innerWidth);
    expect(caixa.height).toBe(window.innerHeight);

    // Translúcido: preto com alfa, nunca opaco.
    // O Tailwind 4 resolve `bg-black/45` como `oklab(0 0 0 / 0.45)`.
    const cor = getComputedStyle(fundo).backgroundColor;
    const alfa = Number(/\/\s*([\d.]+)\)$/.exec(cor)?.[1] ?? /,\s*([\d.]+)\)$/.exec(cor)?.[1]);
    expect(alfa).toBeGreaterThan(0.2);
    expect(alfa).toBeLessThan(0.7);
  });
});

describe("como sai", () => {
  test("sem recusa, some sozinho depois de uns segundos", async () => {
    vi.useFakeTimers();
    const fechar = vi.fn();
    await render(<EntregaEnviado {...BASE} fechar={fechar} />);

    vi.advanceTimersByTime(3000);
    expect(fechar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(fechar).toHaveBeenCalledOnce();
  });

  test("Esc fecha antes do tempo", async () => {
    vi.useFakeTimers();
    const fechar = vi.fn();
    await render(<EntregaEnviado {...BASE} fechar={fechar} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    vi.advanceTimersByTime(300);
    expect(fechar).toHaveBeenCalledOnce();
  });

  test("com recusa, NÃO some sozinho — espera o Entendi", async () => {
    vi.useFakeTimers();
    const fechar = vi.fn();
    await render(
      <EntregaEnviado {...BASE} aviso="Enviado, mas o servidor recusou: pcp@exemplo.com.br." fechar={fechar} />,
    );

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("recusou");
    vi.advanceTimersByTime(10_000);
    expect(fechar).not.toHaveBeenCalled();

    const entendi = [...document.querySelectorAll("button")].find((b) => b.textContent === "Entendi");
    entendi!.click();
    vi.advanceTimersByTime(300);
    expect(fechar).toHaveBeenCalledOnce();
  });
});

/**
 * O defeito que chegou ao usuário: o envio de verdade leva uns cinco segundos,
 * e fechar o diálogo nesse meio desmontava quem esperava a resposta — o pedido
 * saía e o aviso nunca aparecia.
 */
describe("fechar o diálogo no meio do envio", () => {
  const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));
  const botao = (texto: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(texto))!;

  function Botao({ acao }: { acao: () => Promise<{ enviado?: boolean; erro?: string }> }) {
    return (
      <BotaoEnviarEmail
        jaEnviado={false}
        acao={acao}
        contas={[{ id: "c1", email: "eu@exemplo.com", nomeExibicao: "Eu", padrao: true }]}
        contatos={[{ id: "k1", nome: "Compras", setor: null, email: "compras@exemplo.com", padrao: true }]}
        fornecedor={{ id: "f1", nome: "QUALYPLAST" }}
        cliente={{ apelido: "AKILAH", email: null }}
        textoPadrao={{ assunto: "Pedido 1", corpo: "Segue." }}
        nomeArquivoPdf="1.pdf"
      />
    );
  }

  async function enviarEFechar(resposta: { enviado?: boolean; erro?: string }) {
    await render(<Botao acao={async () => (await esperar(600), resposta)} />);
    botao("Enviar por e-mail").click();
    await esperar(100);
    (document.querySelector("dialog button[type=submit]") as HTMLButtonElement).click();
    await esperar(100);
    // Clique no fundo, Esc ou o X: todos chegam ao mesmo `close()`.
    document.querySelector("dialog")!.close();
    await esperar(50);
    expect(document.querySelector("dialog")!.open).toBe(false);
  }

  test("o aviso aparece mesmo assim, e o botão mostra que ainda está enviando", async () => {
    await enviarEFechar({ enviado: true });
    expect(botao("Enviando").textContent).toContain("Enviando");

    await esperar(800);
    expect(document.querySelector(".entrega")).not.toBeNull();
    expect(document.querySelector('[role="status"]')?.textContent).toContain("compras@exemplo.com");
  });

  test("se der erro, o diálogo reabre para mostrar o motivo", async () => {
    await enviarEFechar({ erro: "Não foi possível conectar." });

    await esperar(800);
    expect(document.querySelector("dialog")!.open).toBe(true);
    expect(document.querySelector("dialog")!.textContent).toContain("Não foi possível conectar.");
    expect(document.querySelector(".entrega")).toBeNull();
  });
});

/**
 * Quem decide se há animação é a conta, em Configurações — nunca o sistema
 * operacional. Muito Windows vem com "efeitos de animação" desligado, e o
 * aviso sumiria para essa gente sem ela ter pedido.
 */
describe("quem desliga a animação", () => {
  test("nenhuma regra de `prefers-reduced-motion` mexe na entrega", () => {
    const regras = [...document.styleSheets].flatMap((folha) => [...folha.cssRules]);
    const doSistema = regras.filter(
      (r) => r instanceof CSSMediaRule && r.conditionText.includes("prefers-reduced-motion"),
    );
    expect(doSistema.some((r) => r.cssText.includes("entrega"))).toBe(false);
  });

  test("desligada NO APP, o avião some mas o cartão aparece na hora", async () => {
    document.documentElement.dataset.animacoes = "desativadas";
    try {
      await render(<EntregaEnviado {...BASE} fechar={() => {}} />);
      const aviao = document.querySelector(".entrega-aviao") as HTMLElement;
      const cartao = document.querySelector(".entrega-cartao") as HTMLElement;

      expect(getComputedStyle(aviao).display).toBe("none");
      expect(getComputedStyle(cartao).opacity).toBe("1");
    } finally {
      delete document.documentElement.dataset.animacoes;
    }
  });
});


/**
 * Pedido editado por preposto: o administrador vê quem e quando, e só consegue
 * enviar depois de marcar que conferiu.
 */
describe("edição de preposto antes de enviar", () => {
  const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

  async function abrirDialogo(aConferir: { id: string; quem: string; quando: string }[]) {
    await render(
      <BotaoEnviarEmail
        jaEnviado={false}
        aConferir={aConferir}
        acao={async () => ({ enviado: true })}
        contas={[{ id: "c1", email: "eu@exemplo.com", nomeExibicao: "Eu", padrao: true }]}
        contatos={[{ id: "k1", nome: "Compras", setor: null, email: "compras@exemplo.com", padrao: true }]}
        fornecedor={{ id: "f1", nome: "QUALYPLAST" }}
        cliente={{ apelido: "AKILAH", email: null }}
        textoPadrao={{ assunto: "Pedido 1", corpo: "Segue." }}
        nomeArquivoPdf="1.pdf"
      />,
    );
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("por e-mail"))!.click();
    await esperar(100);
    return {
      dialogo: document.querySelector("dialog")!,
      enviar: document.querySelector("dialog button[type=submit]") as HTMLButtonElement,
      conferido: document.querySelector('dialog input[name="conferido"]') as HTMLInputElement | null,
    };
  }

  test("mostra quem editou e trava o envio até marcar que conferiu", async () => {
    const { dialogo, enviar, conferido } = await abrirDialogo([
      { id: "e1", quem: "Marcos", quando: "29/09/2026, 14:20" },
    ]);

    expect(dialogo.textContent).toContain("Um preposto editou este pedido");
    expect(dialogo.textContent).toContain("Marcos");
    expect(enviar.disabled).toBe(true);

    conferido!.click();
    await esperar(50);
    expect(enviar.disabled).toBe(false);
  });

  test("sem edição a conferir, não há aviso nem caixa", async () => {
    const { dialogo, enviar, conferido } = await abrirDialogo([]);

    expect(dialogo.textContent).not.toContain("preposto");
    expect(conferido).toBeNull();
    expect(enviar.disabled).toBe(false);
  });
});
