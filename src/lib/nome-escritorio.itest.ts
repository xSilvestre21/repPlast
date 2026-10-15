/**
 * Teste de integração do nome único do escritório.
 *
 * O que só o banco responde: o índice `organizacao_nome_unico` recusa o mesmo
 * nome escrito de outro jeito, solta o nome do escritório desativado ou que
 * trocou; a função `app_nome_escritorio_em_uso` enxerga os outros escritórios
 * mesmo chamada pelo papel restrito; e o histórico de trocas fica no escritório.
 *
 * Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbAdministrativo, dbParaOrganizacao } from "./db";
import { ehConflitoDeNome, nomeEmUso } from "./nome-escritorio";

const admin = dbAdministrativo();

/** Nomes únicos por rodada: uma rodada que falhe no meio não trava a seguinte. */
const sufixo = randomUUID().slice(0, 8);
const nome = (base: string) => `${base} ${sufixo}`;

const criados: string[] = [];

async function escritorio(nomeDele: string, dados: { ativa?: boolean } = {}) {
  const org = await admin.organizacao.create({
    data: { nome: nomeDele, ...dados, usuarios: { create: { nome: "Admin", email: `${randomUUID()}@teste.local`, senhaHash: "x" } } },
    select: { id: true, usuarios: { select: { id: true } } },
  });
  criados.push(org.id);
  return { id: org.id, usuarioId: org.usuarios[0].id };
}

function comoEscritorio(org: { id: string; usuarioId: string }) {
  return dbParaOrganizacao(org.id, { usuarioId: org.usuarioId, papel: "ADMIN" });
}

async function falhaPorNome(promessa: Promise<unknown>) {
  const erro = await promessa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(erro, "deveria ter sido recusado pelo índice do nome").not.toBeNull();
  expect(ehConflitoDeNome(erro)).toBe(true);
}

let val: { id: string; usuarioId: string };

beforeAll(async () => {
  val = await escritorio(nome("Val & Amaral"));
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: { in: criados } } });
});

describe("nome único do escritório", () => {
  it("recusa o mesmo nome com outras maiúsculas, acentos e espaços", async () => {
    await falhaPorNome(escritorio(nome("VÁL  &  amaral")));
  });

  it("aceita o nome de um escritório desativado", async () => {
    const antigo = await escritorio(nome("Desativado Ltda"), { ativa: false });
    const novo = await escritorio(nome("Desativado Ltda"));
    expect(novo.id).not.toBe(antigo.id);
  });

  it("nomeEmUso enxerga os outros escritórios, mesmo pelo papel restrito", async () => {
    const outro = await escritorio(nome("Rep. Silvestre"));
    const db = comoEscritorio(outro);

    expect(await nomeEmUso(db, nome("val & AMARAL"))).toBe(true);
    expect(await nomeEmUso(db, nome("Ninguém Usa Este"))).toBe(false);
    // O próprio nome não conta como "de outro".
    expect(await nomeEmUso(db, nome("Rep. Silvestre"), { exceto: outro.id })).toBe(false);
  });

  it("troca A → B → A, e outro escritório pega o nome enquanto está livre", async () => {
    const a = nome("Primeiro Nome");
    const b = nome("Segundo Nome");
    const org = await escritorio(a);
    const db = comoEscritorio(org);

    // O papel restrito troca o próprio nome: o trigger da cobrança não trava `nome`.
    await db.organizacao.update({
      where: { id: org.id },
      data: { nome: b, trocasDeNome: { create: { usuarioId: org.usuarioId, nomeAnterior: a, nomeNovo: b } } },
    });

    // "A" ficou livre: outro escritório pode usar…
    const intruso = await escritorio(a);
    await falhaPorNome(db.organizacao.update({ where: { id: org.id }, data: { nome: a } }));

    // …e quando ele sai, o primeiro volta ao nome antigo.
    await admin.organizacao.update({ where: { id: intruso.id }, data: { ativa: false } });
    await db.organizacao.update({ where: { id: org.id }, data: { nome: a } });

    const atual = await admin.organizacao.findUnique({ where: { id: org.id }, select: { nome: true } });
    expect(atual?.nome).toBe(a);
  });

  it("o histórico de trocas de um escritório não aparece para outro", async () => {
    const org = await escritorio(nome("Com Historico"));
    await comoEscritorio(org).organizacao.update({
      where: { id: org.id },
      data: {
        nome: nome("Com Historico 2"),
        trocasDeNome: {
          create: { usuarioId: org.usuarioId, nomeAnterior: nome("Com Historico"), nomeNovo: nome("Com Historico 2") },
        },
      },
    });

    const doProprio = await comoEscritorio(org).trocaNomeEscritorio.findMany();
    const deOutro = await comoEscritorio(val).trocaNomeEscritorio.findMany({ where: { organizacaoId: org.id } });

    expect(doProprio).toHaveLength(1);
    expect(deOutro).toHaveLength(0);
  });
});
