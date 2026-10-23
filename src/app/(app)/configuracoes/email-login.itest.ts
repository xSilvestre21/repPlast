/**
 * Testes de integração do pedido de troca do e-mail de login.
 *
 * O que se protege: pedir NÃO troca nada (só manda o link ao endereço novo);
 * a senha é conferida, e as erradas contam no mesmo limite do login — sem
 * isso, uma sessão esquecida aberta viraria um lugar para testar senhas; e o
 * e-mail de outra conta, ou o próprio, é recusado embaixo do campo.
 *
 * O envio do e-mail e o DNS são trocados por versões que só registram: aqui
 * se testa o que se grava e o que se recusa.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts email-login.itest
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { type Ator, dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import { gerarHashSenha } from "@/lib/senha";
import { LIMITE_POR_EMAIL } from "@/lib/tentativas-login";

import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const emailDe = (quem: string) => `${quem}-${sufixo}@teste.local`;

let org = "";
let ator: Ator = { usuarioId: "", papel: "ADMIN" };

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: org,
    usuarioId: ator.usuarioId,
    papel: ator.papel,
    ehAdmin: true,
    plano: "PADRAO",
    db: dbParaOrganizacao(org, ator),
  }),
  exigirAdmin: async () => {},
}));

const enviados = vi.hoisted(() => [] as { para: string; texto: string }[]);
vi.mock("@/lib/email-sistema", () => ({
  enviarDoSistema: async (mensagem: { para: string; texto: string }) => {
    enviados.push(mensagem);
  },
  urlDoSistema: () => "http://teste.local",
}));
// `after` roda o envio na hora: aqui não há resposta depois da qual esperar.
vi.mock("next/server", () => ({ after: (tarefa: () => unknown) => tarefa() }));
vi.mock("@/lib/dominio-email", () => ({ dominioRecebeEmail: async () => true }));
vi.mock("@/lib/tentativas-login", async (original) => ({
  ...(await original<typeof import("@/lib/tentativas-login")>()),
  ipDaRequisicao: async () => `ip-${sufixo}`,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { pedirTrocaEmail } = await import("./acoes");

let emailAtual = "";

function pedido(emailNovo: string, senhaAtual: string) {
  const formData = new FormData();
  formData.set("emailNovo", emailNovo);
  formData.set("senhaAtual", senhaAtual);
  return pedirTrocaEmail({}, formData);
}

async function novoUsuario(quem: string) {
  const usuario = await admin.usuario.create({
    data: { organizacaoId: org, nome: quem, email: emailDe(quem), senhaHash: await gerarHashSenha("certa123") },
  });
  ator = { usuarioId: usuario.id, papel: "ADMIN" };
  emailAtual = usuario.email;
}

beforeAll(async () => {
  org = (await admin.organizacao.create({ data: { nome: nomeDeTeste("Escritório do E-mail") } })).id;
});

beforeEach(() => {
  enviados.length = 0;
});

afterAll(async () => {
  await admin.tentativaLogin.deleteMany({ where: { email: { contains: sufixo } } });
  await admin.organizacao.deleteMany({ where: { id: org } });
});

describe("pedirTrocaEmail", () => {
  it("manda o link ao endereço novo e não troca nada ainda", async () => {
    await novoUsuario("ana");

    const estado = await pedido(` ${emailDe("ANA-NOVA").toUpperCase()} `, "certa123");

    expect(estado.erro).toBeUndefined();
    expect(estado.ok).toMatch(/link/);
    expect((await admin.usuario.findUniqueOrThrow({ where: { id: ator.usuarioId } })).email).toBe(emailAtual);
    expect(enviados).toHaveLength(1);
    // Guardado e enviado em minúsculas, como o login guarda.
    expect(enviados[0].para).toBe(emailDe("ana-nova"));
    expect(enviados[0].texto).toMatch(/http:\/\/teste\.local\/confirmar-email\//);
  });

  it("recusa a senha errada embaixo do campo dela, sem mandar nada", async () => {
    await novoUsuario("bia");

    const estado = await pedido(emailDe("bia-nova"), "errada");

    expect(estado.campo).toBe("senhaAtual");
    expect(enviados).toHaveLength(0);
    // A senha nunca volta para o navegador; o e-mail digitado, sim.
    expect(estado.valores?.senhaAtual).toBeUndefined();
    expect(estado.valores?.emailNovo).toBe(emailDe("bia-nova"));
  });

  it("depois do limite de senhas erradas, fecha — mesmo com a senha certa", async () => {
    await novoUsuario("caio");
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await pedido(emailDe("caio-nova"), "errada");

    const estado = await pedido(emailDe("caio-nova"), "certa123");

    expect(estado.campo).toBe("senhaAtual");
    expect(estado.erro).toMatch(/Muitas tentativas/);
    expect(enviados).toHaveLength(0);
  });

  it("recusa o e-mail de outra conta e o próprio e-mail", async () => {
    await novoUsuario("duda");
    await admin.usuario.create({
      data: { organizacaoId: org, nome: "Outra", email: emailDe("ocupado"), senhaHash: "x" },
    });

    const ocupado = await pedido(emailDe("ocupado"), "certa123");
    expect(ocupado.campo).toBe("emailNovo");
    expect(ocupado.erro).toMatch(/outra conta/);

    const proprio = await pedido(emailAtual, "certa123");
    expect(proprio.campo).toBe("emailNovo");
    expect(proprio.erro).toMatch(/já é o seu e-mail/);

    const torto = await pedido("sem-arroba", "certa123");
    expect(torto.campo).toBe("emailNovo");

    expect(enviados).toHaveLength(0);
  });
});
