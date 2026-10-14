/**
 * Testes da leitura da hora digitada no seletor de hora do calendário.
 */

import { describe, expect, it } from "vitest";

import { horaCompleta, lerHora, mascararHora } from "./hora";

describe("lerHora", () => {
  it("aceita os jeitos comuns de escrever 14:30", () => {
    for (const texto of ["14:30", "14h30", "14.30", "1430", " 14 h 30 "]) {
      expect(lerHora(texto), texto).toBe("14:30");
    }
  });

  it("completa com zero à esquerda", () => {
    expect(lerHora("930")).toBe("09:30");
    expect(lerHora("9:05")).toBe("09:05");
  });

  it("hora sozinha é a hora cheia", () => {
    expect(lerHora("9")).toBe("09:00");
    expect(lerHora("9h")).toBe("09:00");
    expect(lerHora("18")).toBe("18:00");
  });

  it("com separador, o que vem depois são os minutos", () => {
    expect(lerHora("14:5")).toBe("14:05");
  });

  it("recusa o que não é hora", () => {
    for (const texto of ["", "24:00", "25", "14:60", "abc", "12345", "9 e meia"]) {
      expect(lerHora(texto), texto).toBeNull();
    }
  });
});

describe("horaCompleta", () => {
  it("vale assim que a hora está inteira", () => {
    expect(horaCompleta("14")).toBe("14:00");
    expect(horaCompleta("9h")).toBe("09:00");
    expect(horaCompleta("14h30")).toBe("14:30");
    expect(horaCompleta("1430")).toBe("14:30");
  });

  it("espera o que ainda está no meio do caminho", () => {
    for (const texto of ["14h3", "14:", "143", "9:0"]) {
      expect(horaCompleta(texto), texto).toBeNull();
    }
  });
});

describe("mascararHora", () => {
  /** Digita letra por letra, como no teclado, passando pela máscara a cada tecla. */
  function digitar(teclas: string): string[] {
    const passos: string[] = [];
    let campo = "";
    for (const tecla of teclas) {
      campo = mascararHora(campo + tecla);
      passos.push(campo);
    }
    return passos;
  }

  it("põe os dois-pontos depois da hora", () => {
    expect(digitar("1430")).toEqual(["1", "14:", "14:3", "14:30"]);
  });

  it("hora de um dígito ganha o zero na frente", () => {
    expect(digitar("930")).toEqual(["09:", "09:3", "09:30"]);
    expect(digitar("9h30")).toEqual(["09:", "09:", "09:3", "09:30"]);
  });

  it("completa onde só cabe uma leitura", () => {
    expect(mascararHora("25")).toBe("02:5");
    expect(mascararHora("147")).toBe("14:07");
  });

  it("colar também sai pontuado e nunca passa de HH:MM", () => {
    expect(mascararHora("14h30")).toBe("14:30");
    expect(mascararHora("1430")).toBe("14:30");
    expect(mascararHora("143099")).toBe("14:30");
    expect(mascararHora("abc")).toBe("");
  });

  it("o que a máscara entrega, lerHora entende", () => {
    for (const texto of ["14:30", "09:30", "02:5", "14:07", "14:"]) {
      expect(lerHora(texto), texto).not.toBeNull();
    }
  });
});
