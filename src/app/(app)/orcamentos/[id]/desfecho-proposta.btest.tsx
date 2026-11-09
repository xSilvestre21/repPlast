/**
 * Testes de navegador do desfecho da proposta.
 *
 * O que se protege: aceitar é o que faz a proposta virar pedido, e isso tem de
 * estar à vista e custar um clique. "Aceitar e gerar pedido" chama a conversão
 * direto (ela mesma marca a proposta como aceita); quem ainda não pode virar
 * pedido só fica aceita, com o motivo dito no cartão.
 *
 * Rode com:  npm run test:navegador
 */

import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { DesfechoProposta } from "./ficha";

type Props = ComponentProps<typeof DesfechoProposta>;

async function abrir(props: Partial<Props> = {}) {
  const acoes = {
    aceitar: vi.fn(async () => ({})),
    recusar: vi.fn(async () => ({})),
    vencer: vi.fn(async () => ({})),
    reabrir: vi.fn(async () => ({})),
    virarPedido: vi.fn(async () => ({})),
    salvarMotivo: vi.fn(async () => {}),
  };
  const tela = await render(
    <DesfechoProposta
      status="ABERTO"
      temItens
      viraPedido
      pedidos={[]}
      motivoRecusa=""
      {...acoes}
      {...props}
    />,
  );
  return { tela, acoes: { ...acoes, ...props } };
}

const cartao = (elemento: Element) => elemento.closest(".folha")!;

describe("proposta aberta", () => {
  test("um clique aceita e gera o pedido", async () => {
    const { tela, acoes } = await abrir();

    await expect.element(tela.getByRole("heading", { name: "O cliente aceitou?" })).toBeVisible();
    await tela.getByRole("button", { name: "Aceitar e gerar pedido" }).click();

    await vi.waitFor(() => expect(acoes.virarPedido).toHaveBeenCalledTimes(1));
    expect(acoes.aceitar).not.toHaveBeenCalled();
  });

  test("não pede dois passos: não há Cliente aceitou nem Virar pedido", async () => {
    const { tela } = await abrir();

    await expect.element(tela.getByRole("button", { name: "Cliente aceitou" })).not.toBeInTheDocument();
    await expect.element(tela.getByRole("button", { name: "Virar pedido" })).not.toBeInTheDocument();
  });

  test("é o cartão em destaque da tela", async () => {
    const { tela } = await abrir();

    const titulo = tela.getByRole("heading", { name: "O cliente aceitou?" }).element();
    expect(cartao(titulo).classList.contains("folha-marcada")).toBe(true);
  });

  test("a recusa da conversão aparece embaixo do botão", async () => {
    const { tela } = await abrir({
      virarPedido: vi.fn(async () => ({ erro: "O cliente não tem CNPJ no cadastro." })),
    });

    await tela.getByRole("button", { name: "Aceitar e gerar pedido" }).click();

    await expect.element(tela.getByText("O cliente não tem CNPJ no cadastro.")).toBeVisible();
  });

  test("sem itens, aceitar espera, e o cartão diz por quê", async () => {
    const { tela } = await abrir({ temItens: false });

    await expect.element(tela.getByRole("button", { name: "Aceitar e gerar pedido" })).toBeDisabled();
    await expect.element(tela.getByText(/Lance os itens primeiro/)).toBeVisible();
    const titulo = tela.getByRole("heading", { name: "O cliente aceitou?" }).element();
    expect(cartao(titulo).classList.contains("folha-marcada")).toBe(false);
  });

  test("quem ainda não vira pedido só fica aceita, e o cartão diz o que falta", async () => {
    const { tela, acoes } = await abrir({ viraPedido: false });

    await expect.element(tela.getByText(/O pedido sai depois de cadastrar o cliente/)).toBeVisible();
    await tela.getByRole("button", { name: "Cliente aceitou" }).click();

    await vi.waitFor(() => expect(acoes.aceitar).toHaveBeenCalledTimes(1));
    expect(acoes.virarPedido).not.toHaveBeenCalled();
  });

  test("recusar pede o motivo antes de fechar", async () => {
    const { tela, acoes } = await abrir();

    await tela.getByRole("button", { name: "Recusou" }).click();
    await expect.element(tela.getByRole("textbox", { name: /Por que o cliente recusou/ })).toBeVisible();
    await tela.getByRole("button", { name: "Marcar como recusada" }).click();

    await vi.waitFor(() => expect(acoes.recusar).toHaveBeenCalledTimes(1));
  });
});

describe("proposta fechada", () => {
  test("aceita sem pedido: o próximo passo é gerar o pedido", async () => {
    const { tela, acoes } = await abrir({ status: "ACEITO" });

    await expect
      .element(tela.getByRole("heading", { name: "Aceita. Falta gerar o pedido" }))
      .toBeVisible();
    await tela.getByRole("button", { name: "Gerar pedido" }).click();

    await vi.waitFor(() => expect(acoes.virarPedido).toHaveBeenCalledTimes(1));
  });

  test("aceita e já virou pedido: leva até ele, e ainda dá para gerar outro", async () => {
    const { tela } = await abrir({ status: "ACEITO", pedidos: [{ id: "p1", numero: 2253 }] });

    await expect.element(tela.getByRole("heading", { name: "Aceita e virou pedido" })).toBeVisible();
    await expect
      .element(tela.getByRole("link", { name: "pedido #2253" }))
      .toHaveAttribute("href", "/pedidos/p1");
    await expect.element(tela.getByRole("button", { name: "Gerar outro pedido" })).toBeVisible();
  });

  test("recusada mostra o motivo e deixa reabrir", async () => {
    const { tela } = await abrir({ status: "RECUSADO", motivoRecusa: "Preço" });

    await expect.element(tela.getByRole("heading", { name: "Recusada" })).toBeVisible();
    await expect.element(tela.getByRole("textbox", { name: /Por que o cliente recusou/ })).toHaveValue("Preço");
    await expect.element(tela.getByRole("button", { name: "reabrir a proposta" })).toBeVisible();
  });

  test("vencida deixa reabrir", async () => {
    const { tela } = await abrir({ status: "EXPIRADO" });

    await expect.element(tela.getByRole("heading", { name: "Vencida" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "reabrir a proposta" })).toBeVisible();
  });
});
