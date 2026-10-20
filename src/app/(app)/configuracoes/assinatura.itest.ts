/**
 * Testes de integração da assinatura da conta de e-mail.
 *
 * O que se protege: o HTML colado é gravado LIMPO — sem script nem `on…` —,
 * colar nada é remover, e o envio encontra a assinatura da caixa. O teste da
 * conexão SMTP é trocado por um que sempre passa: aqui se testa o que se
 * grava, não o servidor de e-mail.
 *
 * As ações rodam com o papel restrito (`dbParaOrganizacao`), não como dono do
 * banco, que passaria por cima do RLS.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts assinatura.itest
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { contaParaEnvio } from "@/lib/conta-email";
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

const { salvarContaEmail } = await import("./acoes");

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
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

function conta(assinatura: string, senha = "abcd efgh ijkl mnop") {
  const formData = new FormData();
  formData.set("provedor", "GMAIL");
  formData.set("email", "val@gmail.com");
  formData.set("nomeExibicao", "Renata");
  formData.set("host", "smtp.gmail.com");
  formData.set("porta", "465");
  formData.set("seguranca", "ssl");
  formData.set("senha", senha);
  formData.set("assinatura", assinatura);
  return formData;
}

async function gravada() {
  return admin.contaEmail.findFirstOrThrow({ where: { usuarioId: ator.usuarioId } });
}

describe("assinatura da conta", () => {
  it("grava o HTML colado já limpo", async () => {
    const estado = await salvarContaEmail(
      null,
      {},
      conta(
        '<table><tr><td><img src="https://ci3.googleusercontent.com/logo.png"></td>' +
          '<td onclick="x()"><b>Renata</b><script>alert(1)</script></td></tr></table>',
      ),
    );
    expect(estado.erro).toBeUndefined();

    const { assinaturaHtml } = await gravada();
    expect(assinaturaHtml).toContain('src="https://ci3.googleusercontent.com/logo.png"');
    expect(assinaturaHtml).toContain("<b>Renata</b>");
    expect(assinaturaHtml).not.toMatch(/script|onclick/);
  });

  it("o envio encontra a assinatura da caixa", async () => {
    const { id } = await gravada();
    const paraEnvio = await contaParaEnvio(dbParaOrganizacao(org, ator), ator.usuarioId, id);
    expect(paraEnvio?.assinaturaHtml).toContain("<b>Renata</b>");
  });

  it("colar nada é remover", async () => {
    const { id } = await gravada();
    // Senha em branco na edição mantém a guardada.
    const estado = await salvarContaEmail(id, {}, conta("<div><br></div>", ""));
    expect(estado.erro).toBeUndefined();

    expect((await gravada()).assinaturaHtml).toBeNull();
  });
});
