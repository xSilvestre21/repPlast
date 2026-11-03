import { describe, expect, it } from "vitest";

import { problemasDoAmbiente } from "./ambiente";

const COMPLETO = {
  DATABASE_URL: "postgresql://app:senha@banco.interno:5432/repplast?sslmode=verify-full",
  APP_DB_ROLE: "repplast_app",
  SESSAO_SECRET: "x".repeat(43),
  EMAIL_CHAVE: Buffer.alloc(32, 7).toString("base64"),
  APP_URL: "https://repplast.com.br",
  ASAAS_URL: "https://api.asaas.com",
  ASAAS_API_KEY: "$aact_prod_abc",
  ASAAS_WEBHOOK_TOKEN: "token-inventado-no-painel",
  SISTEMA_SMTP_HOST: "email-smtp.sa-east-1.amazonaws.com",
  SISTEMA_SMTP_PORTA: "587",
  SISTEMA_EMAIL_REMETENTE: "nao-responda@repplast.com.br",
};

describe("problemasDoAmbiente", () => {
  it("completo: nenhum", () => {
    expect(problemasDoAmbiente(COMPLETO)).toEqual([]);
  });

  it("APP_DB_ROLE vazio é recusado — é o isolamento entre escritórios", () => {
    const problemas = problemasDoAmbiente({ ...COMPLETO, APP_DB_ROLE: " " });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/^APP_DB_ROLE: vazia — .*isolamento/);
  });

  it("a chave do Asaas com a barra do .env", () => {
    expect(problemasDoAmbiente({ ...COMPLETO, ASAAS_API_KEY: "\\$aact_prod_abc" })[0]).toMatch(
      /^ASAAS_API_KEY: começa com \\/,
    );
  });

  it("o token do webhook igual à chave de API", () => {
    expect(problemasDoAmbiente({ ...COMPLETO, ASAAS_WEBHOOK_TOKEN: COMPLETO.ASAAS_API_KEY })).toEqual([
      expect.stringMatching(/^ASAAS_WEBHOOK_TOKEN: igual à ASAAS_API_KEY/),
    ]);
  });

  it("APP_URL sem https e segredo curto", () => {
    const problemas = problemasDoAmbiente({ ...COMPLETO, APP_URL: "http://repplast.com.br", SESSAO_SECRET: "curta" });
    expect(problemas).toEqual([
      expect.stringMatching(/^SESSAO_SECRET: curta demais/),
      expect.stringMatching(/^APP_URL: precisa começar com https:\/\//),
    ]);
  });

  it("http só no próprio PC ou na rede local — o `next start` de medir desempenho", () => {
    for (const local of ["http://127.0.0.1:3100", "http://localhost:3000", "http://192.168.15.129:3000"]) {
      expect(problemasDoAmbiente({ ...COMPLETO, APP_URL: local })).toEqual([]);
    }
  });

  it("lista cada ausente pelo nome", () => {
    const problemas = problemasDoAmbiente({});
    expect(problemas.map((problema) => problema.split(":")[0])).toEqual([
      "DATABASE_URL",
      "APP_DB_ROLE",
      "SESSAO_SECRET",
      "EMAIL_CHAVE",
      "APP_URL",
      "ASAAS_URL",
      "ASAAS_API_KEY",
      "ASAAS_WEBHOOK_TOKEN",
      "SISTEMA_SMTP_HOST",
      "SISTEMA_EMAIL_REMETENTE",
    ]);
  });
});
