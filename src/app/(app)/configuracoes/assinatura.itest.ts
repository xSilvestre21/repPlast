/**
 * Testes de integração das assinaturas da conta de e-mail.
 *
 * O que se protege: o HTML colado é gravado LIMPO — sem script nem `on…` —,
 * a caixa pode ter várias e só uma é a padrão, assinatura vazia é recusada, e
 * o envio acha a escolhida (ou nenhuma, em "Sem assinatura"). O teste da
 * conexão SMTP é trocado por um que sempre passa: aqui se testa o que se
 * grava, não o servidor de e-mail.
 *
 * As ações rodam com o papel restrito (`dbParaOrganizacao`), não como dono do
 * banco, que passaria por cima do RLS.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts assinatura.itest
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { assinaturaEscolhida } from "@/lib/conta-email";
import { type Ator, dbAdministrativo, dbParaOrganizacao } from "@/lib/db";

import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();

let org = "";
let ator: Ator = { usuarioId: "", papel: "ADMIN" };

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: org,
    usuarioId: ator.usuarioId,
    papel: "ADMIN",
    ehAdmin: true,
    plano: "PRO",
    db: dbParaOrganizacao(org, ator),
  }),
  exigirAdmin: async () => {},
}));

vi.mock("@/lib/email", () => ({ testarConta: async () => ({ ok: true }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { definirAssinaturaPadrao, excluirAssinaturaEmail, salvarAssinaturaEmail, salvarContaEmail } =
  await import("./acoes");

let contaId = "";

beforeAll(async () => {
  const o = await admin.organizacao.create({
    data: { nome: nomeDeTeste("Escritório da Assinatura"), plano: "PLUS" },
  });
  org = o.id;
  const usuario = await admin.usuario.create({
    data: {
      organizacaoId: org,
      nome: "Renata",
      email: `val-${org}@exemplo.test`,
      senhaHash: "x",
      papel: "ADMIN",
    },
  });
  ator = { usuarioId: usuario.id, papel: "ADMIN" };

  const formData = new FormData();
  formData.set("provedor", "GMAIL");
  formData.set("email", "val@gmail.com");
  formData.set("nomeExibicao", "Renata");
  formData.set("host", "smtp.gmail.com");
  formData.set("porta", "465");
  formData.set("seguranca", "ssl");
  formData.set("senha", "abcd efgh ijkl mnop");
  const estado = await salvarContaEmail(null, {}, formData);
  expect(estado.erro).toBeUndefined();
  contaId = (await admin.contaEmail.findFirstOrThrow({ where: { usuarioId: usuario.id } })).id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

function assinatura(nome: string, html: string, padrao = false) {
  const formData = new FormData();
  formData.set("nome", nome);
  formData.set("assinatura", html);
  if (padrao) formData.set("padrao", "on");
  return formData;
}

async function gravadas() {
  return admin.assinaturaEmail.findMany({ where: { contaId }, orderBy: { criadoEm: "asc" } });
}

function escolha(assinaturaId: string) {
  const formData = new FormData();
  formData.set("assinaturaId", assinaturaId);
  return assinaturaEscolhida(dbParaOrganizacao(org, ator), ator.usuarioId, contaId, formData);
}

describe("assinaturas da conta", () => {
  it("grava o HTML colado já limpo, e a primeira vira a padrão", async () => {
    const estado = await salvarAssinaturaEmail(
      contaId,
      null,
      {},
      assinatura(
        "Completa",
        '<table><tr><td><img src="https://ci3.googleusercontent.com/logo.png"></td>' +
          '<td onclick="x()"><b>Renata</b><script>alert(1)</script></td></tr></table>',
      ),
    );
    expect(estado.erro).toBeUndefined();

    const [completa] = await gravadas();
    expect(completa.html).toContain('src="https://ci3.googleusercontent.com/logo.png"');
    expect(completa.html).toContain("<b>Renata</b>");
    expect(completa.html).not.toMatch(/script|onclick/);
    expect(completa.padrao).toBe(true);
  });

  it("guarda mais de uma, e só uma é a padrão", async () => {
    const estado = await salvarAssinaturaEmail(contaId, null, {}, assinatura("Curta", "<b>R.</b>", true));
    expect(estado.erro).toBeUndefined();

    const lista = await gravadas();
    expect(lista.map((a) => [a.nome, a.padrao])).toEqual([
      ["Completa", false],
      ["Curta", true],
    ]);

    await definirAssinaturaPadrao(lista[0].id, {}, new FormData());
    expect((await gravadas()).map((a) => a.padrao)).toEqual([true, false]);
  });

  it("recusa assinatura vazia e nome repetido, embaixo do campo", async () => {
    const vazia = await salvarAssinaturaEmail(contaId, null, {}, assinatura("Outra", "<div><br></div>"));
    expect(vazia.campo).toBe("assinatura");

    const repetida = await salvarAssinaturaEmail(contaId, null, {}, assinatura("Curta", "<b>x</b>"));
    expect(repetida.campo).toBe("nome");

    expect(await gravadas()).toHaveLength(2);
  });

  it("o envio acha a escolhida, e “Sem assinatura” é nenhuma", async () => {
    const [completa, curta] = await gravadas();
    expect(await escolha(curta.id)).toBe("<b>R.</b>");
    expect(await escolha(completa.id)).toContain("<b>Renata</b>");
    expect(await escolha("")).toBeNull();
    await expect(escolha("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/não existe mais/);
  });

  it("excluir a padrão passa o posto para a próxima", async () => {
    const [completa] = await gravadas();
    await excluirAssinaturaEmail(completa.id, {}, new FormData());

    const lista = await gravadas();
    expect(lista.map((a) => [a.nome, a.padrao])).toEqual([["Curta", true]]);
  });
});
