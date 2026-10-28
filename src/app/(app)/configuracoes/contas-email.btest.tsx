/**
 * Testes de navegador da chegada ao cadastro de e-mail.
 *
 * O que se protege: quem clica em "Cadastrar meu e-mail" no envio de um pedido
 * chega a Configurações com o formulário de cadastro aberto e na tela — e não
 * no topo da página, procurando onde fica. Só se confere com layout de verdade:
 * em `node` não há rolagem, e tudo tem altura zero.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { SecaoContasEmail } from "./contas-email";

const nada = async () => ({});

function Tela({
  abrirCadastro = false,
  criptoConfigurada = true,
}: {
  abrirCadastro?: boolean;
  criptoConfigurada?: boolean;
}) {
  return (
    <>
      {/* O que vem antes em Configurações (Perfil, Escritório): o cadastro fica longe do topo. */}
      <div style={{ height: 2000 }} />
      <SecaoContasEmail
        contas={[]}
        adicionar={nada}
        nomeUsuario="Ana Souza"
        emailUsuario="ana@gmail.com"
        criptoConfigurada={criptoConfigurada}
        abrirCadastro={abrirCadastro}
      />
      <div style={{ height: 2000 }} />
    </>
  );
}

let endereco: string;

beforeEach(() => {
  endereco = window.location.pathname + window.location.search;
  window.scrollTo(0, 0);
});

afterEach(() => {
  history.replaceState(null, "", endereco);
  window.scrollTo(0, 0);
});

describe("chegada ao cadastro de e-mail", () => {
  test("vindo do envio, o formulário abre e a tela desce até ele", async () => {
    history.replaceState(null, "", `${window.location.pathname}?conta=nova#nova-conta`);

    render(<Tela abrirCadastro />);

    const passo = page.getByText("Qual é o seu e-mail");
    await expect.element(passo).toBeVisible();
    // Logo abaixo da barra fixa do topo, e não 2000 px abaixo.
    const topo = passo.element().getBoundingClientRect().top;
    expect(topo).toBeGreaterThan(0);
    expect(topo).toBeLessThan(window.innerHeight / 2);
    // Cumprido o pedido, recarregar não reabre o formulário.
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("#email");
  });

  test("chegando de outro jeito, a seção fica como sempre: fechada, com o botão", async () => {
    render(<Tela />);

    await expect.element(page.getByRole("button", { name: "Adicionar conta" })).toBeInTheDocument();
    expect(page.getByText("Qual é o seu e-mail").query()).toBeNull();
    expect(window.scrollY).toBe(0);
  });

  test("sem a chave de cifra, não abre o formulário que não pode salvar", async () => {
    render(<Tela abrirCadastro criptoConfigurada={false} />);

    await expect.element(page.getByRole("button", { name: "Adicionar conta" })).toBeDisabled();
    expect(page.getByText("Qual é o seu e-mail").query()).toBeNull();
  });
});
