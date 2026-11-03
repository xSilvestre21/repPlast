import { describe, expect, it } from "vitest";

import { bancoEhLocal } from "./banco-local";

describe("bancoEhLocal", () => {
  it("o Postgres desta máquina", () => {
    expect(bancoEhLocal("postgresql://postgres:senha@localhost:5432/repplast?sslmode=disable")).toBe(true);
    expect(bancoEhLocal("postgresql://postgres@127.0.0.1/repplast")).toBe(true);
    expect(bancoEhLocal("postgresql://postgres@[::1]:5432/repplast")).toBe(true);
  });

  it("qualquer outro: a nuvem, ou nada", () => {
    expect(bancoEhLocal("postgresql://neondb_owner:x@ep-abc-pooler.sa-east-1.aws.neon.tech/neondb")).toBe(false);
    expect(bancoEhLocal("postgresql://dono:x@ls-abc.czxyz.sa-east-1.rds.amazonaws.com:5432/repplast")).toBe(false);
    expect(bancoEhLocal(undefined)).toBe(false);
    expect(bancoEhLocal("não é url")).toBe(false);
  });
});
