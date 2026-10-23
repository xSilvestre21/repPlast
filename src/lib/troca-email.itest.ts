/**
 * Teste de integração da troca do e-mail de login.
 *
 * O que só o banco responde: o e-mail só muda pelo link, o link vale uma vez,
 * pedir de novo encerra o anterior, a troca derruba as sessões antigas
 * (`sessaoVersao`), e um e-mail que outra conta pegou no meio do caminho é
 * recusado sem gastar a troca de ninguém.
 *
 * Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { nomeDeTeste } from "../../test/nome-de-teste";
import { dbAdministrativo } from "./db";
import { criarRedefinicao, donoDoLink, redefinirPeloLink } from "./redefinicao-senha";
import {
  bloqueioDasTrocas,
  criarTrocaEmail,
  LIMITE_TROCAS,
  pedidoDoLink,
  trocaPendente,
  trocarPeloLink,
} from "./troca-email";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const emailDe = (quem: string) => `${quem}-${sufixo}@teste.local`;

let organizacaoId = "";

async function usuario(quem: string) {
  return admin.usuario.create({
    data: { organizacaoId, nome: quem, email: emailDe(quem), senhaHash: "x" },
    select: { id: true, email: true },
  });
}

beforeAll(async () => {
  const org = await admin.organizacao.create({ data: { nome: nomeDeTeste("Teste troca de e-mail") } });
  organizacaoId = org.id;
});

afterAll(async () => {
  await admin.redefinicaoSenha.deleteMany({ where: { email: { contains: sufixo } } });
  await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

describe("troca do e-mail de login", () => {
  it("só troca pelo link, uma vez, e derruba as sessões antigas", async () => {
    const ana = await usuario("ana");
    const novo = emailDe("ana-nova");
    const token = await criarTrocaEmail({ usuarioId: ana.id, emailNovo: novo, ip: "ip" });

    // Pedir não troca nada: o login continua o de antes até o clique.
    expect((await admin.usuario.findUniqueOrThrow({ where: { id: ana.id } })).email).toBe(ana.email);
    expect(await trocaPendente(ana.id)).toBe(novo);
    expect(await pedidoDoLink(token)).toMatchObject({ emailAtual: ana.email, emailNovo: novo });

    expect(await trocarPeloLink(token)).toMatchObject({ ok: true, emailAntigo: ana.email, emailNovo: novo });

    const depois = await admin.usuario.findUniqueOrThrow({
      where: { id: ana.id },
      select: { email: true, sessaoVersao: true },
    });
    expect(depois).toEqual({ email: novo, sessaoVersao: 1 });
    expect(await trocaPendente(ana.id)).toBeNull();

    // Segundo uso do mesmo link: recusado.
    expect(await pedidoDoLink(token)).toBeNull();
    expect(await trocarPeloLink(token)).toEqual({ ok: false, motivo: "vencido" });
  });

  it("pedir de novo encerra o link anterior", async () => {
    const bia = await usuario("bia");
    const primeiro = await criarTrocaEmail({ usuarioId: bia.id, emailNovo: emailDe("bia-1"), ip: "ip" });
    const segundo = await criarTrocaEmail({ usuarioId: bia.id, emailNovo: emailDe("bia-2"), ip: "ip" });

    expect(await pedidoDoLink(primeiro)).toBeNull();
    expect(await trocaPendente(bia.id)).toBe(emailDe("bia-2"));
    expect(await trocarPeloLink(segundo)).toMatchObject({ ok: true });
  });

  it("recusa o e-mail que outra conta pegou depois do pedido", async () => {
    const caio = await usuario("caio");
    const disputado = emailDe("disputado");
    const token = await criarTrocaEmail({ usuarioId: caio.id, emailNovo: disputado, ip: "ip" });

    await admin.usuario.create({ data: { organizacaoId, nome: "Outro", email: disputado, senhaHash: "x" } });

    expect(await trocarPeloLink(token)).toEqual({ ok: false, motivo: "em-uso" });
    expect((await admin.usuario.findUniqueOrThrow({ where: { id: caio.id } })).email).toBe(caio.email);
  });

  it("redefinir a senha encerra a troca de e-mail em aberto", async () => {
    // Quem descobriu a senha pede a troca para a caixa dele; a dona da conta
    // percebe e redefine a senha. O link do invasor tem de morrer junto.
    const eva = await usuario("eva");
    const doInvasor = await criarTrocaEmail({ usuarioId: eva.id, emailNovo: emailDe("invasor"), ip: "ip" });

    const redefinicao = await criarRedefinicao({ email: eva.email, ip: `ip-eva-${sufixo}` });
    expect(await redefinirPeloLink(redefinicao!.token, "nova")).not.toBeNull();

    expect(await pedidoDoLink(doInvasor)).toBeNull();
    expect(await trocarPeloLink(doInvasor)).toEqual({ ok: false, motivo: "vencido" });
    expect((await admin.usuario.findUniqueOrThrow({ where: { id: eva.id } })).email).toBe(eva.email);
  });

  it("trocar o e-mail encerra os links de senha mandados ao endereço antigo", async () => {
    const fabi = await usuario("fabi");
    const redefinicao = await criarRedefinicao({ email: fabi.email, ip: `ip-fabi-${sufixo}` });
    const troca = await criarTrocaEmail({ usuarioId: fabi.id, emailNovo: emailDe("fabi-nova"), ip: "ip" });

    expect(await trocarPeloLink(troca)).toMatchObject({ ok: true });
    expect(await donoDoLink(redefinicao!.token)).toBeNull();
  });

  it("fecha novos pedidos depois do limite", async () => {
    const duda = await usuario("duda");
    for (let i = 0; i < LIMITE_TROCAS; i++) {
      expect(await bloqueioDasTrocas(duda.id)).toBeNull();
      await criarTrocaEmail({ usuarioId: duda.id, emailNovo: emailDe(`duda-${i}`), ip: "ip" });
    }
    expect(await bloqueioDasTrocas(duda.id)).toBeInstanceOf(Date);
  });
});
