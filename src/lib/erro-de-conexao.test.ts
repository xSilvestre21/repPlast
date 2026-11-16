import { describe, expect, test, vi } from "vitest";

import { comSegundaTentativa, erroDeConexao, operacaoDeLeitura } from "./erro-de-conexao";

describe("erroDeConexao", () => {
  test("reconhece a conexão que o servidor fechou, em cada formato", () => {
    expect(erroDeConexao(Object.assign(new Error("x"), { code: "P1017" }))).toBe(true);
    expect(erroDeConexao(Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }))).toBe(true);
    expect(erroDeConexao(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(erroDeConexao(new Error("Server has closed the connection."))).toBe(true);
    expect(erroDeConexao({ kind: "ConnectionClosed" })).toBe(true);
  });

  test("acha a causa embrulhada por outra camada", () => {
    const doAdaptador = Object.assign(new Error("falhou"), { cause: { kind: "ConnectionClosed" } });
    const doPrisma = Object.assign(new Error("Invalid `prisma.pedido.findMany()` invocation"), {
      cause: doAdaptador,
    });

    expect(erroDeConexao(doPrisma)).toBe(true);
  });

  test("recusa do banco não é queda de conexão", () => {
    // Violação de unicidade, RLS e registro não encontrado falham igual na segunda vez.
    expect(erroDeConexao(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))).toBe(false);
    expect(erroDeConexao(Object.assign(new Error("permission denied"), { code: "42501" }))).toBe(false);
    expect(erroDeConexao(Object.assign(new Error("No record found"), { code: "P2025" }))).toBe(false);
  });

  test("o que não é erro não quebra", () => {
    expect(erroDeConexao(null)).toBe(false);
    expect(erroDeConexao(undefined)).toBe(false);
    expect(erroDeConexao("Connection terminated")).toBe(false);
  });

  test("uma cadeia de causas em laço termina", () => {
    const a: { cause?: unknown } = {};
    a.cause = a;

    expect(erroDeConexao(a)).toBe(false);
  });
});

describe("operacaoDeLeitura", () => {
  test("só leitura se repete", () => {
    for (const leitura of ["findMany", "findUnique", "findFirst", "count", "aggregate", "groupBy"]) {
      expect(operacaoDeLeitura(leitura)).toBe(true);
    }
    for (const escrita of ["create", "update", "upsert", "delete", "createMany", "updateMany", "deleteMany"]) {
      expect(operacaoDeLeitura(escrita)).toBe(false);
    }
  });
});

describe("comSegundaTentativa", () => {
  const caiu = () => Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" });

  test("leitura que caiu por conexão morta repete uma vez e devolve o resultado", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const executar = vi.fn().mockRejectedValueOnce(caiu()).mockResolvedValueOnce(["pedido"]);

    await expect(comSegundaTentativa("findMany", executar)).resolves.toEqual(["pedido"]);
    expect(executar).toHaveBeenCalledTimes(2);
    aviso.mockRestore();
  });

  test("escrita nunca repete — a conexão pode ter caído depois de gravar", async () => {
    const executar = vi.fn().mockRejectedValue(caiu());

    await expect(comSegundaTentativa("create", executar)).rejects.toThrow("Connection terminated");
    expect(executar).toHaveBeenCalledTimes(1);
  });

  test("recusa do banco não repete", async () => {
    const executar = vi.fn().mockRejectedValue(Object.assign(new Error("permission denied"), { code: "42501" }));

    await expect(comSegundaTentativa("findMany", executar)).rejects.toThrow("permission denied");
    expect(executar).toHaveBeenCalledTimes(1);
  });

  test("caiu de novo na segunda: o erro sobe, sem terceira tentativa", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const executar = vi.fn().mockRejectedValue(caiu());

    await expect(comSegundaTentativa("count", executar)).rejects.toThrow("Connection terminated");
    expect(executar).toHaveBeenCalledTimes(2);
    aviso.mockRestore();
  });
});
