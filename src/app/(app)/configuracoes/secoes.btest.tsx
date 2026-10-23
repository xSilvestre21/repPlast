/**
 * Testes de navegador da busca em Configurações.
 *
 * A busca esconde os cartões no próprio DOM (`hidden`), lendo o texto que eles
 * mostram e as palavras extras do `data-busca` — só se confere com o DOM de
 * verdade: em `node` não há `textContent` de cartão desenhado nem `hidden`
 * que esconda.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { ItemConfiguracao, SecaoConfiguracao } from "./secao";
import { bateComBusca, SecoesConfiguracao } from "./secoes";

function Tela() {
  return (
    <SecoesConfiguracao
      secoes={[
        { id: "perfil", titulo: "Perfil", icone: "perfil" },
        { id: "orcamento", titulo: "Orçamento", icone: "orcamento" },
      ]}
    >
      <SecaoConfiguracao id="perfil" titulo="Perfil">
        <ItemConfiguracao busca="login acesso">
          <p>Cartão do e-mail de login</p>
        </ItemConfiguracao>
        <ItemConfiguracao busca="segurança">
          <p>Cartão da senha</p>
        </ItemConfiguracao>
      </SecaoConfiguracao>
      <SecaoConfiguracao id="orcamento" titulo="Orçamento">
        <ItemConfiguracao busca="icms frete">
          <p>Condições padrão da proposta</p>
        </ItemConfiguracao>
      </SecaoConfiguracao>
    </SecoesConfiguracao>
  );
}

async function buscar(texto: string) {
  const campo = page.getByPlaceholder("Buscar configuração");
  await userEvent.clear(campo);
  if (texto) await userEvent.type(campo, texto);
}

describe("busca em Configurações", () => {
  test("acha pelo texto do cartão, sem acento nem maiúscula", async () => {
    render(<Tela />);
    await buscar("CONDICOES");

    await expect.element(page.getByText("Condições padrão da proposta")).toBeVisible();
    await expect.element(page.getByText("Cartão da senha")).not.toBeVisible();
    // A seção sem resultado some inteira, título junto.
    // (o papel "heading" não acha o que está escondido, por isso pelo id)
    expect(document.getElementById("perfil")?.hidden).toBe(true);
    expect(document.getElementById("orcamento")?.hidden).toBe(false);
  });

  test("acha pelas palavras extras, que o cartão não escreve", async () => {
    render(<Tela />);
    await buscar("icms");

    await expect.element(page.getByText("Condições padrão da proposta")).toBeVisible();
    await expect.element(page.getByText("Cartão do e-mail de login")).not.toBeVisible();
  });

  test("diz quando nada bate, e volta tudo ao limpar", async () => {
    render(<Tela />);
    await buscar("xyzw");

    await expect.element(page.getByText("Nada encontrado")).toBeVisible();

    await buscar("");
    await expect.element(page.getByText("Nada encontrado")).not.toBeInTheDocument();
    await expect.element(page.getByText("Cartão da senha")).toBeVisible();
    await expect.element(page.getByText("Condições padrão da proposta")).toBeVisible();
  });

  test("clicar numa seção escondida pela busca limpa a busca", async () => {
    render(<Tela />);
    await buscar("icms");
    await page.getByRole("link", { name: "Perfil" }).click();

    await expect.element(page.getByPlaceholder("Buscar configuração")).toHaveValue("");
    await expect.element(page.getByText("Cartão da senha")).toBeVisible();
  });

  test("compara pelo começo das palavras, e o hífen não conta", () => {
    // "email" acha "e-mail", e o contrário também.
    expect(bateComBusca("Mensagem padrão do e-mail do pedido", "email")).toBe(true);
    expect(bateComBusca("Contas de email", "e-mail")).toBe(true);
    // Começo de palavra: "pedido" acha "pedidos", "senh" acha "senha"…
    expect(bateComBusca("Todos os pedidos", "pedido")).toBe(true);
    expect(bateComBusca("Trocar minha senha", "SENH")).toBe(true);
    // …mas pedaço do meio não: "tema" não é "sistema", "nome" não é "sobrenome".
    expect(bateComBusca("É com ele que você entra no sistema", "tema")).toBe(false);
    expect(bateComBusca("Sobrenome", "nome")).toBe(false);
    // Vários termos: todos precisam bater, em qualquer ordem.
    expect(bateComBusca("Mensagem padrão do e-mail da proposta", "proposta mensagem")).toBe(true);
    expect(bateComBusca("Mensagem padrão do e-mail da proposta", "proposta senha")).toBe(false);
    // Busca vazia (ou só espaço e pontuação) mostra tudo.
    expect(bateComBusca("qualquer coisa", "  - ")).toBe(true);
  });
});
