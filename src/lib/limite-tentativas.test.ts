import { describe, expect, it } from "vitest";

import { liberacao, minutosAte, minutosPorExtenso } from "./limite-tentativas";

const agora = new Date("2026-10-15T12:00:00Z");
const ha = (min: number) => new Date(agora.getTime() - min * 60 * 1000);
const regra = { limite: 5, janelaMin: 15, agora };

describe("liberacao", () => {
  it("abaixo do limite, não bloqueia", () => {
    expect(liberacao([ha(1), ha(2), ha(3), ha(4)], regra)).toBeNull();
  });

  it("no limite, libera quando a falha que o completou sai da janela", () => {
    // A 5ª mais recente foi há 10 min: sai da janela de 15 daqui a 5.
    expect(liberacao([ha(1), ha(2), ha(3), ha(4), ha(10)], regra)).toEqual(new Date(agora.getTime() + 5 * 60 * 1000));
  });

  it("falhas fora da janela não contam", () => {
    expect(liberacao([ha(1), ha(2), ha(3), ha(4), ha(16), ha(20)], regra)).toBeNull();
  });

  it("acima do limite, olha a falha do limite, não a mais antiga", () => {
    const datas = [ha(14), ha(1), ha(2), ha(3), ha(4), ha(5), ha(6)];
    expect(liberacao(datas, regra)).toEqual(new Date(ha(5).getTime() + 15 * 60 * 1000));
  });
});

describe("minutosAte", () => {
  it("arredonda para cima e nunca diz 0", () => {
    expect(minutosAte(new Date(agora.getTime() + 61 * 1000), agora)).toBe(2);
    expect(minutosAte(new Date(agora.getTime() + 1000), agora)).toBe(1);
    expect(minutosAte(agora, agora)).toBe(1);
  });

  it("escreve singular e plural", () => {
    expect(minutosPorExtenso(1)).toBe("1 minuto");
    expect(minutosPorExtenso(12)).toBe("12 minutos");
  });
});
