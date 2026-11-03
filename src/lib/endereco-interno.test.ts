import { describe, expect, it } from "vitest";

import { enderecoInterno } from "./endereco-interno";

describe("enderecoInterno", () => {
  it("a própria máquina, a rede privada e os metadados da nuvem", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.3.17",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.15.129",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ]) {
      expect(enderecoInterno(ip), ip).toBe(true);
    }
  });

  it("os servidores de e-mail de verdade passam", () => {
    for (const ip of ["142.250.0.108", "52.97.0.1", "172.32.0.1", "2607:f8b0:4004:c1b::6c", "::ffff:8.8.8.8"]) {
      expect(enderecoInterno(ip), ip).toBe(false);
    }
  });

  it("o que não é IP é recusado", () => {
    expect(enderecoInterno("smtp.gmail.com")).toBe(true);
  });
});
