/**
 * Testes de como um erro sai da ação para a tela.
 *
 * O que mais importa aqui é o que NÃO pode acontecer: texto do Prisma, do
 * Postgres ou do servidor de e-mail chegando a quem só queria salvar.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ErroDeCampo,
  ErroParaUsuario,
  campoDaLinha,
  erroDoCampo,
  falhou,
  valoresDigitados,
} from "./erro-formulario";

function formulario(pares: [string, string][]) {
  const dados = new FormData();
  for (const [nome, valor] of pares) dados.append(nome, valor);
  return dados;
}

afterEach(() => vi.restoreAllMocks());

describe("falhou", () => {
  it("leva o erro de campo ao campo, com o que foi digitado", () => {
    const dados = formulario([
      ["nome", "QUALYPLAST"],
      ["ultimoNumeroPedido", "10"],
    ]);
    const estado = falhou(new ErroDeCampo("ultimoNumeroPedido", "Número baixo."), dados);

    expect(estado).toEqual({
      erro: "Número baixo.",
      campo: "ultimoNumeroPedido",
      valores: expect.objectContaining({ nome: "QUALYPLAST", ultimoNumeroPedido: "10" }),
    });
  });

  it("mostra o erro escrito para o usuário, sem campo", () => {
    expect(falhou(new ErroParaUsuario("Sessão expirada."))).toEqual({
      erro: "Sessão expirada.",
      valores: undefined,
    });
  });

  it("nunca mostra a mensagem de um erro comum", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const estado = falhou(new Error('new row violates row-level security policy for table "pedido"'));

    expect(estado.erro).not.toMatch(/row-level|policy|pedido/);
    expect(estado.erro).toMatch(/tente de novo/);
    expect(console.error).toHaveBeenCalled();
  });

  it("traduz o duplicado do Prisma, sem o texto técnico", () => {
    const prisma = Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), {
      code: "P2002",
    });
    const estado = falhou(prisma);

    expect(estado.erro).not.toMatch(/constraint|email/i);
    expect(estado.erro).toMatch(/Já existe/);
  });
});

describe("valoresDigitados", () => {
  it("nunca devolve senha, nem o que foi pedido para tirar", () => {
    const valores = valoresDigitados(
      formulario([
        ["email", "a@b.com"],
        ["senha", "segredo"],
        ["confirmacaoSenha", "segredo"],
        ["token", "x"],
      ]),
      { sem: ["token"] },
    );

    expect(valores).toEqual({ email: "a@b.com", "email#0": "a@b.com" });
  });

  it("também não devolve a senha repetida (confirmacao) nem a atual", () => {
    const valores = valoresDigitados(
      formulario([
        ["nome", "Ana"],
        ["confirmacao", "segredo"],
        ["atual", "antiga"],
      ]),
    );

    expect(valores).toEqual({ nome: "Ana", "nome#0": "Ana" });
  });

  it("numera os campos repetidos das linhas de tabela", () => {
    const valores = valoresDigitados(
      formulario([
        ["email", "a@b.com"],
        ["email", "c@d.com"],
      ]),
    );

    expect(valores[campoDaLinha("email", 1)]).toBe("c@d.com");
    expect(valores.email).toBe("a@b.com");
  });
});

describe("erroDoCampo", () => {
  it("só entrega o erro ao campo apontado", () => {
    const estado = { erro: "Informe o nome.", campo: "nome" };

    expect(erroDoCampo(estado, "nome")).toBe("Informe o nome.");
    expect(erroDoCampo(estado, "email")).toBeUndefined();
    expect(erroDoCampo({ erro: "Geral." }, "nome")).toBeUndefined();
  });
});
