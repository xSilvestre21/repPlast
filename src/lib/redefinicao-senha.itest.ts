/**
 * Teste de integração do "Esqueceu sua senha?" e do limite de tentativas.
 *
 * O que só o banco responde: o link vale uma vez e por pouco tempo, pedir de
 * novo encerra o anterior, a senha nova derruba as sessões antigas
 * (`sessaoVersao`), e os limites contam também e-mails que não têm conta.
 *
 * Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { nomeDeTeste } from "../../test/nome-de-teste";
import { dbAdministrativo, dbParaOrganizacao } from "./db";
import {
  bloqueioDosPedidos,
  criarRedefinicao,
  donoDoLink,
  LIMITE_PEDIDOS_POR_EMAIL,
  redefinirPeloLink,
} from "./redefinicao-senha";
import { bloqueioDoLogin, LIMITE_POR_EMAIL, LIMITE_POR_IP, limparFalhas, registrarFalha } from "./tentativas-login";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const emailDe = (quem: string) => `${quem}-${sufixo}@teste.local`;
/** IP inventado por teste: um teste não pode encher o limite de IP do outro. */
const ipDe = (quem: string) => `ip-${quem}-${sufixo}`;

let organizacaoId = "";

async function usuario(quem: string, dados: { ativo?: boolean } = {}) {
  return admin.usuario.create({
    data: { organizacaoId, nome: quem, email: emailDe(quem), senhaHash: "antiga", ...dados },
    select: { id: true, email: true },
  });
}

beforeAll(async () => {
  const org = await admin.organizacao.create({ data: { nome: nomeDeTeste("Teste redefinição de senha") } });
  organizacaoId = org.id;
});

afterAll(async () => {
  const emails = { contains: sufixo };
  await admin.redefinicaoSenha.deleteMany({ where: { email: emails } });
  await admin.tentativaLogin.deleteMany({ where: { email: emails } });
  await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

describe("link de redefinição", () => {
  it("vale uma vez, troca a senha e derruba as sessões antigas", async () => {
    const ana = await usuario("ana");
    const envio = await criarRedefinicao({ email: ana.email, ip: ipDe("ana") });
    expect(envio?.para).toBe(ana.email);

    expect(await donoDoLink(envio!.token)).toEqual({ usuarioId: ana.id, email: ana.email });
    expect(await redefinirPeloLink(envio!.token, "nova")).toEqual({ email: ana.email });

    const depois = await admin.usuario.findUnique({
      where: { id: ana.id },
      select: { senhaHash: true, sessaoVersao: true },
    });
    expect(depois).toEqual({ senhaHash: "nova", sessaoVersao: 1 });

    // Segundo uso do mesmo link: recusado, e a senha não muda de novo.
    expect(await donoDoLink(envio!.token)).toBeNull();
    expect(await redefinirPeloLink(envio!.token, "outra")).toBeNull();
  });

  it("pedir de novo encerra o link anterior", async () => {
    const bia = await usuario("bia");
    const primeiro = await criarRedefinicao({ email: bia.email, ip: ipDe("bia") });
    const segundo = await criarRedefinicao({ email: bia.email, ip: ipDe("bia") });

    expect(await donoDoLink(primeiro!.token)).toBeNull();
    expect(await donoDoLink(segundo!.token)).not.toBeNull();
  });

  it("link vencido não serve", async () => {
    const caio = await usuario("caio");
    const envio = await criarRedefinicao({ email: caio.email, ip: ipDe("caio") });
    await admin.redefinicaoSenha.updateMany({
      where: { usuarioId: caio.id },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });

    expect(await donoDoLink(envio!.token)).toBeNull();
    expect(await redefinirPeloLink(envio!.token, "nova")).toBeNull();
  });

  it("não manda link para usuário desativado nem para e-mail sem conta", async () => {
    const dani = await usuario("dani", { ativo: false });
    expect(await criarRedefinicao({ email: dani.email, ip: ipDe("dani") })).toBeNull();
    expect(await criarRedefinicao({ email: emailDe("ninguem"), ip: ipDe("ninguem") })).toBeNull();
  });

  it("o limite de pedidos conta também e-mail sem conta", async () => {
    const email = emailDe("sem-conta");
    const ip = ipDe("sem-conta");
    for (let i = 0; i < LIMITE_PEDIDOS_POR_EMAIL - 1; i++) await criarRedefinicao({ email, ip });
    expect(await bloqueioDosPedidos({ email, ip })).toBeNull();

    await criarRedefinicao({ email, ip });
    expect(await bloqueioDosPedidos({ email, ip })).toBeInstanceOf(Date);
  });
});

describe("limite de tentativas do login", () => {
  it(`bloqueia o e-mail na ${LIMITE_POR_EMAIL}ª senha errada, e o login certo zera`, async () => {
    const email = emailDe("login");
    const ip = ipDe("login");

    for (let i = 0; i < LIMITE_POR_EMAIL - 1; i++) await registrarFalha({ email, ip });
    expect(await bloqueioDoLogin({ email, ip })).toBeNull();

    await registrarFalha({ email, ip });
    const libera = await bloqueioDoLogin({ email, ip });
    expect(libera).toBeInstanceOf(Date);
    expect(libera!.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

    await limparFalhas(email);
    expect(await bloqueioDoLogin({ email, ip })).toBeNull();
  });

  it("bloqueia o IP que erra em muitos e-mails diferentes", async () => {
    const ip = ipDe("varredura");
    for (let i = 0; i < LIMITE_POR_IP; i++) await registrarFalha({ email: emailDe(`alvo${i}`), ip });

    // Um e-mail que nunca errou, vindo do mesmo IP: fechado também.
    expect(await bloqueioDoLogin({ email: emailDe("inocente"), ip })).toBeInstanceOf(Date);
    // O mesmo e-mail de outro IP: aberto.
    expect(await bloqueioDoLogin({ email: emailDe("inocente"), ip: ipDe("outro") })).toBeNull();
  });
});

describe("isolamento", () => {
  it("o papel da aplicação não lê pedidos nem tentativas — nem os do próprio escritório", async () => {
    const eva = await usuario("eva");
    await criarRedefinicao({ email: eva.email, ip: ipDe("eva") });
    await registrarFalha({ email: eva.email, ip: ipDe("eva") });

    const db = dbParaOrganizacao(organizacaoId, { usuarioId: eva.id, papel: "ADMIN" });
    expect(await db.redefinicaoSenha.findMany({ where: { email: eva.email } })).toHaveLength(0);
    expect(await db.tentativaLogin.findMany({ where: { email: eva.email } })).toHaveLength(0);
  });
});
