import { describe, expect, it } from "vitest";

import { conferirSenha, gerarHashSenha } from "./senha";

describe("hash de senha", () => {
  it("confere a senha correta", async () => {
    const hash = await gerarHashSenha("repplast123");

    await expect(conferirSenha("repplast123", hash)).resolves.toBe(true);
  });

  it("recusa a senha errada", async () => {
    const hash = await gerarHashSenha("repplast123");

    await expect(conferirSenha("repplast124", hash)).resolves.toBe(false);
    await expect(conferirSenha("", hash)).resolves.toBe(false);
    await expect(conferirSenha("REPPLAST123", hash)).resolves.toBe(false);
  });

  it("nunca guarda a senha em claro", async () => {
    const hash = await gerarHashSenha("senha-muito-secreta");

    expect(hash).not.toContain("senha-muito-secreta");
  });

  it("a mesma senha gera hashes diferentes", async () => {
    // O sal é aleatório: sem isso, duas contas com a mesma senha teriam o
    // mesmo hash, e quebrar uma quebraria as duas.
    const [a, b] = await Promise.all([gerarHashSenha("igual"), gerarHashSenha("igual")]);

    expect(a).not.toBe(b);
    await expect(conferirSenha("igual", a)).resolves.toBe(true);
    await expect(conferirSenha("igual", b)).resolves.toBe(true);
  });

  it("guarda os parâmetros de custo junto do hash", async () => {
    // É o que permite endurecer o custo no futuro sem invalidar senhas antigas.
    const hash = await gerarHashSenha("qualquer");

    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(hash.split("$")).toHaveLength(6);
  });

  it("aceita acento e emoji sem depender da forma Unicode", async () => {
    // "ção" pode chegar composto ou decomposto conforme o teclado; normalizar
    // evita que a mesma senha digitada de dois jeitos falhe.
    const hash = await gerarHashSenha("aç̧ão-forte");

    await expect(conferirSenha("aç̧ão-forte", hash)).resolves.toBe(true);
  });

  it("hash corrompido devolve false em vez de estourar", async () => {
    // Um dado ruim no banco não pode virar erro 500 na tela de login.
    await expect(conferirSenha("qualquer", "lixo")).resolves.toBe(false);
    await expect(conferirSenha("qualquer", "")).resolves.toBe(false);
    await expect(conferirSenha("qualquer", "bcrypt$1$2$3$4$5")).resolves.toBe(false);
  });
});
