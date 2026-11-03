/**
 * O limite do cadastro contra o banco: as duas portas, e-mail e IP.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { dbAdministrativo } from "./db";
import {
  bloqueioDoCadastro,
  LIMITE_CADASTROS_POR_EMAIL,
  LIMITE_CADASTROS_POR_IP,
  registrarTentativaDeCadastro,
} from "./tentativas-cadastro";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const ips = [`198.51.100.${sufixo}-a`, `198.51.100.${sufixo}-b`];

afterAll(async () => {
  await admin.tentativaCadastro.deleteMany({ where: { ip: { in: ips } } });
});

describe("limite do cadastro", () => {
  it("fecha o e-mail que insiste, e só ele", async () => {
    const email = `insiste-${sufixo}@teste.local`;
    for (let i = 0; i < LIMITE_CADASTROS_POR_EMAIL - 1; i++) {
      await registrarTentativaDeCadastro({ email, ip: ips[0] });
    }
    expect(await bloqueioDoCadastro({ email, ip: ips[0] })).toBeNull();

    await registrarTentativaDeCadastro({ email, ip: ips[0] });
    expect(await bloqueioDoCadastro({ email, ip: ips[0] })).not.toBeNull();
    // Outro e-mail da mesma rede ainda passa: o IP não chegou ao limite dele.
    expect(await bloqueioDoCadastro({ email: `outro-${sufixo}@teste.local`, ip: ips[0] })).toBeNull();
  });

  it("fecha o IP que troca de e-mail a cada tentativa", async () => {
    for (let i = 0; i < LIMITE_CADASTROS_POR_IP; i++) {
      await registrarTentativaDeCadastro({ email: `robo-${i}-${sufixo}@teste.local`, ip: ips[1] });
    }

    const libera = await bloqueioDoCadastro({ email: `novo-${sufixo}@teste.local`, ip: ips[1] });
    expect(libera).not.toBeNull();
    expect(libera!.getTime()).toBeGreaterThan(Date.now());
  });
});
