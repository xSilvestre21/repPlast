/**
 * Os prazos da sessão: 7 dias sem uso, 12 horas sem "Manter conectado", e 30
 * dias desde o login em qualquer caso.
 */

import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { criarToken, lerToken, precisaRenovar } from "./token-sessao";

const SEGREDO = "x".repeat(32);
const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const LOGIN = Date.UTC(2026, 9, 1, 12);

const token = (manter: boolean, agora = LOGIN, inicio = LOGIN) =>
  criarToken({ usuarioId: "u1", versao: 2, manter, inicio }, SEGREDO, agora);

describe("token da sessão", () => {
  it("vale logo depois do login, com quem é e se fica conectado", () => {
    expect(lerToken(token(true), SEGREDO, LOGIN + MIN)).toEqual({
      usuarioId: "u1",
      versao: 2,
      manter: true,
      inicio: LOGIN,
      emitidoEm: LOGIN,
    });
  });

  it("mantendo conectado, cai com 7 dias sem uso", () => {
    expect(lerToken(token(true), SEGREDO, LOGIN + 6 * DIA)).not.toBeNull();
    expect(lerToken(token(true), SEGREDO, LOGIN + 7 * DIA + MIN)).toBeNull();
  });

  it("sem manter conectado, cai com 12 horas sem uso", () => {
    expect(lerToken(token(false), SEGREDO, LOGIN + 11 * HORA)).not.toBeNull();
    expect(lerToken(token(false), SEGREDO, LOGIN + 12 * HORA + MIN)).toBeNull();
  });

  it("usando todo dia, ainda cai 30 dias depois do login", () => {
    let atual = token(true);
    for (let dia = 1; dia <= 29; dia++) {
      const lido = lerToken(atual, SEGREDO, LOGIN + dia * DIA);
      expect(lido).not.toBeNull();
      atual = criarToken(lido!, SEGREDO, LOGIN + dia * DIA);
    }

    expect(lerToken(atual, SEGREDO, LOGIN + 30 * DIA - MIN)).not.toBeNull();
    expect(lerToken(atual, SEGREDO, LOGIN + 30 * DIA + MIN)).toBeNull();
  });

  it("recusa a assinatura adulterada", () => {
    const [dados] = token(true).split(".");
    expect(lerToken(`${dados}.abc`, SEGREDO, LOGIN)).toBeNull();
    expect(lerToken(token(true), "y".repeat(32), LOGIN)).toBeNull();
  });

  it("recusa o payload trocado: esticar o prazo à mão não passa", () => {
    const [dados, assinatura] = token(false).split(".");
    const payload = JSON.parse(Buffer.from(dados, "base64url").toString());
    const esticado = Buffer.from(JSON.stringify({ ...payload, manter: true, expiraEm: LOGIN + 99 * DIA }))
      .toString("base64url");

    expect(lerToken(`${esticado}.${assinatura}`, SEGREDO, LOGIN + 13 * HORA)).toBeNull();
  });

  describe("token de antes dos prazos (30 dias fixos)", () => {
    const antigo = (emitidoEm: number) => {
      const dados = Buffer.from(JSON.stringify({ usuarioId: "u1", expiraEm: emitidoEm + 30 * DIA, versao: 1 }))
        .toString("base64url");
      return `${dados}.${createHmac("sha256", SEGREDO).update(dados).digest("base64url")}`;
    };

    it("vale enquanto o login tem menos de 7 dias, e vira mantido", () => {
      expect(lerToken(antigo(LOGIN), SEGREDO, LOGIN + 3 * DIA)).toMatchObject({ manter: true, inicio: LOGIN });
    });

    it("pede a senha de novo quando o login tem mais de 7 dias", () => {
      expect(lerToken(antigo(LOGIN), SEGREDO, LOGIN + 10 * DIA)).toBeNull();
    });
  });

  it("só refaz o token passada uma hora do último", () => {
    const lido = lerToken(token(true), SEGREDO, LOGIN)!;
    expect(precisaRenovar(lido, LOGIN + 30 * MIN)).toBe(false);
    expect(precisaRenovar(lido, LOGIN + 2 * HORA)).toBe(true);
  });
});
