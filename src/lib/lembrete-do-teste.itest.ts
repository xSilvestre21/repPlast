/**
 * O e-mail de "o teste grátis está acabando", contra o banco: sai para quem
 * tem a cobrança em até 48 horas, uma vez só, e volta a tentar se não saiu.
 *
 * O e-mail não é enviado: o envio só é anotado (ou falha, quando o teste
 * pede). As datas ficam em 2099, longe de qualquer escritório de verdade do
 * banco de teste — a rotina olha todos.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const email = vi.hoisted(() => ({ enviados: [] as { para: string; assunto: string; texto: string }[], falhar: false }));
vi.mock("./email-sistema", () => ({
  enviarDoSistema: async (mensagem: { para: string; assunto: string; texto: string }) => {
    if (email.falhar) return false;
    email.enviados.push(mensagem);
    return true;
  },
  urlDoSistema: () => "https://repplast.teste",
}));

import { dbAdministrativo } from "./db";
import { enviarLembretesDoTeste, tokenDaRotinaConfere } from "./lembrete-do-teste";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const criadas: string[] = [];

/** Às 9h de Brasília de 08/03/2099 — a hora do cron. */
const AGORA = new Date("2099-03-08T12:00:00Z");

async function escritorio(rotulo: string, testeAte: Date, extra: { lembreteTesteEm?: Date } = {}) {
  const { id } = await admin.organizacao.create({
    data: {
      nome: `LEMBRETE ${rotulo} ${sufixo}`,
      plano: "PLUS",
      assinatura: "ATIVA",
      testeAte,
      ...extra,
      usuarios: {
        create: [
          { nome: "Dona", email: `lembrete-${rotulo}-${sufixo}@teste.local`, senhaHash: "x" },
          // Preposto não paga, não recebe — mas entra na conta do valor (o 4º, além dos 3 inclusos).
          ...["a", "b", "c", "d"].map((p) => ({
            nome: `Preposto ${p}`,
            email: `lembrete-${rotulo}-${p}-${sufixo}@teste.local`,
            senhaHash: "x",
            papel: "REPRESENTANTE" as const,
          })),
        ],
      },
    },
    select: { id: true },
  });
  criadas.push(id);
  return id;
}

async function avisadoEm(id: string) {
  return (await admin.organizacao.findUniqueOrThrow({ where: { id }, select: { lembreteTesteEm: true } }))
    .lembreteTesteEm;
}

beforeEach(() => {
  email.enviados = [];
  email.falhar = false;
});

afterAll(async () => {
  await admin.usuario.deleteMany({ where: { organizacaoId: { in: criadas } } });
  await admin.organizacao.deleteMany({ where: { id: { in: criadas } } });
});

describe("token da rotina", () => {
  it("só com o Bearer certo", () => {
    process.env.ROTINA_TOKEN = "token-da-rotina-do-teste-com-32-caracteres";

    expect(tokenDaRotinaConfere(null)).toBe(false);
    expect(tokenDaRotinaConfere("token-da-rotina-do-teste-com-32-caracteres")).toBe(false);
    expect(tokenDaRotinaConfere("Bearer outro-token")).toBe(false);
    expect(tokenDaRotinaConfere("Bearer token-da-rotina-do-teste-com-32-caracteres")).toBe(true);
  });
});

describe("enviarLembretesDoTeste", () => {
  it("avisa o administrador de quem é cobrado em até 48 horas, com a data e o valor — uma vez só", async () => {
    // A cobrança em 10/03: a meia-noite de Brasília, 39 horas depois do cron.
    const id = await escritorio("perto", new Date("2099-03-10T03:00:00Z"));
    const longe = await escritorio("longe", new Date("2099-03-12T03:00:00Z"));

    expect(await enviarLembretesDoTeste(AGORA)).toEqual({ avisados: 1 });

    expect(email.enviados).toHaveLength(1);
    const [enviado] = email.enviados;
    expect(enviado.para).toBe(`lembrete-perto-${sufixo}@teste.local`);
    expect(enviado.assunto).toBe("Seu teste grátis do RepPlast termina em 09/03/2099");
    // O `Intl` escreve "R$" com espaço não separável.
    expect(enviado.texto).toMatch(/No dia 10\/03\/2099, a primeira mensalidade do plano Max, de R\$\s238,00/);
    expect(enviado.texto).toContain("cancele até 09/03/2099 em Configurações → Plano e mensalidade");
    expect(await avisadoEm(id)).toEqual(AGORA);
    expect(await avisadoEm(longe)).toBeNull();

    // O cron de novo, no mesmo dia e no seguinte: o avisado não recebe outra vez.
    email.enviados = [];
    expect(await enviarLembretesDoTeste(AGORA)).toEqual({ avisados: 0 });
    expect(await enviarLembretesDoTeste(new Date("2099-03-09T12:00:00Z"))).toEqual({ avisados: 0 });
    expect(email.enviados).toEqual([]);

    // Dois dias antes da cobrança dele, chega a vez do outro.
    expect(await enviarLembretesDoTeste(new Date("2099-03-10T12:00:00Z"))).toEqual({ avisados: 1 });
    expect(email.enviados.map((e) => e.para)).toEqual([`lembrete-longe-${sufixo}@teste.local`]);
  });

  it("e-mail que não saiu solta a trava: o cron do dia seguinte tenta de novo", async () => {
    const id = await escritorio("falha", new Date("2099-04-10T03:00:00Z"));
    email.falhar = true;

    expect(await enviarLembretesDoTeste(new Date("2099-04-08T12:00:00Z"))).toEqual({ avisados: 0 });
    expect(await avisadoEm(id)).toBeNull();

    email.falhar = false;
    expect(await enviarLembretesDoTeste(new Date("2099-04-09T12:00:00Z"))).toEqual({ avisados: 1 });
  });

  it("quem cancelou no teste, ou já passou da cobrança, não recebe", async () => {
    const cancelado = await escritorio("cancelado", new Date("2099-05-10T03:00:00Z"));
    await admin.organizacao.update({ where: { id: cancelado }, data: { assinatura: "CANCELADA" } });

    expect(await enviarLembretesDoTeste(new Date("2099-05-08T12:00:00Z"))).toEqual({ avisados: 0 });
    expect(await enviarLembretesDoTeste(new Date("2099-05-10T12:00:00Z"))).toEqual({ avisados: 0 });
    expect(email.enviados).toEqual([]);
  });
});
