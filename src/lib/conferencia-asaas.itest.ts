/**
 * Testes de integração da conferência diária com o Asaas.
 *
 * O que se protege: quem pagou e ficou bloqueado é liberado; quem tem fatura
 * vencida ou assinatura encerrada é bloqueado — mas só com o Asaas dizendo o
 * mesmo duas vezes, e só se o webhook não chegou no meio; a assinatura nova do
 * cliente é ligada; o que é decisão de gente só vira alerta; e o escritório
 * "sem cobrança" fica de fora — marca que o próprio escritório não consegue
 * se dar.
 *
 * O Asaas não é chamado: cada assinatura deste teste tem respostas fixas, e
 * qualquer outra (os escritórios de outros testes, no mesmo banco) dá erro —
 * o que a conferência conta como "não conferido", sem mudar nada.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

interface Resposta {
  ativa: boolean;
  valor: string;
  cobrancas: string[];
}

const asaas = vi.hoisted(() => ({
  /** As respostas de cada assinatura, em ordem; a última se repete. `null`: o Asaas não a conhece (404). */
  assinaturas: new Map<string, (Resposta | null)[]>(),
  /** A assinatura ativa de cada cliente, para `assinaturaDoCliente`. */
  clientes: new Map<string, string | null>(),
  /** O que acontece no meio da consulta — o webhook chegando, por exemplo. */
  durante: new Map<string, () => Promise<void>>(),
  ultima: new Map<string, Resposta>(),
  consultadas: [] as string[],
}));

vi.mock("./asaas", () => ({
  pagamentoConfigurado: () => true,
  assinaturaNoAsaas: async (id: string) => {
    asaas.consultadas.push(id);
    const respostas = asaas.assinaturas.get(id);
    if (!respostas) throw new Error(`assinatura ${id} fora deste teste`);
    await asaas.durante.get(id)?.();

    const resposta = respostas.length > 1 ? respostas.shift()! : respostas[0];
    if (!resposta) return null;
    asaas.ultima.set(id, resposta);
    const { default: Decimal } = await import("decimal.js");
    return { ativa: resposta.ativa, valor: new Decimal(resposta.valor) };
  },
  cobrancasDaAssinatura: async (id: string) =>
    (asaas.ultima.get(id)?.cobrancas ?? []).map((status, i) => ({ id: `${id}_${i}`, status, vencimento: "2099-01-05" })),
  assinaturaDoCliente: async (cliente: string) => {
    if (!asaas.clientes.has(cliente)) throw new Error(`cliente ${cliente} fora deste teste`);
    return asaas.clientes.get(cliente) ?? null;
  },
}));

import { conferirComOAsaas, type ResultadoDaConferencia } from "./conferencia-asaas";
import { dbAdministrativo, dbParaOrganizacao } from "./db";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const criadas: string[] = [];
const DIA = 24 * 60 * 60 * 1000;

const emDia: Resposta = { ativa: true, valor: "79", cobrancas: ["CONFIRMED", "PENDING"] };
const vencida: Resposta = { ativa: true, valor: "79", cobrancas: ["CONFIRMED", "OVERDUE"] };

type Situacao = "AGUARDANDO_PAGAMENTO" | "ATIVA" | "ATRASADA" | "CANCELADA";

async function escritorio(
  rotulo: string,
  dados: {
    assinatura: Situacao;
    acessoAte?: Date;
    asaasAssinaturaId?: string;
    asaasClienteId?: string;
    semCobranca?: boolean;
  },
) {
  const { id, usuarios } = await admin.organizacao.create({
    data: {
      nome: `CONFERENCIA ${rotulo} ${sufixo}`,
      plano: "PADRAO",
      ...dados,
      usuarios: { create: { nome: "Dona", email: `conferencia-${rotulo}-${sufixo}@teste.local`, senhaHash: "x" } },
    },
    select: { id: true, usuarios: { select: { id: true } } },
  });
  criadas.push(id);
  return { id, adminId: usuarios[0].id };
}

async function agora(id: string) {
  return admin.organizacao.findUniqueOrThrow({
    where: { id },
    select: { assinatura: true, acessoAte: true, asaasAssinaturaId: true },
  });
}

const sub = (nome: string) => `sub_${nome}_${sufixo}`;
const doTeste = (resultado: ResultadoDaConferencia, id: string) => ({
  corrigido: resultado.corrigidos.find((c) => c.escritorio === id),
  alertas: resultado.alertas.filter((a) => a.escritorio === id).map((a) => a.alerta),
});

let erros: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  asaas.assinaturas.clear();
  asaas.clientes.clear();
  asaas.durante.clear();
  asaas.ultima.clear();
  asaas.consultadas = [];
  erros = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterAll(async () => {
  vi.restoreAllMocks();
  await admin.usuario.deleteMany({ where: { organizacaoId: { in: criadas } } });
  await admin.organizacao.deleteMany({ where: { id: { in: criadas } } });
});

describe("conferirComOAsaas", () => {
  it("libera quem pagou e ficou bloqueado, e avisa no log", async () => {
    const { id } = await escritorio("pagou", { assinatura: "ATRASADA", asaasAssinaturaId: sub("pagou") });
    asaas.assinaturas.set(sub("pagou"), [emDia]);

    const resultado = await conferirComOAsaas();

    expect(await agora(id)).toMatchObject({ assinatura: "ATIVA", acessoAte: null });
    expect(doTeste(resultado, id).corrigido).toMatchObject({ de: "ATRASADA", para: "ATIVA" });
    expect(erros).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${id} corrigido de ATRASADA para ATIVA`)));
  });

  it("bloqueia a fatura vencida — perguntando ao Asaas duas vezes", async () => {
    const { id } = await escritorio("venceu", { assinatura: "ATIVA", asaasAssinaturaId: sub("venceu") });
    asaas.assinaturas.set(sub("venceu"), [vencida]);

    await conferirComOAsaas();

    expect((await agora(id)).assinatura).toBe("ATRASADA");
    expect(asaas.consultadas.filter((s) => s === sub("venceu"))).toHaveLength(2);
  });

  it("não bloqueia quem pagou entre a primeira pergunta e a segunda", async () => {
    const { id } = await escritorio("pagou-no-meio", { assinatura: "ATIVA", asaasAssinaturaId: sub("meio") });
    asaas.assinaturas.set(sub("meio"), [vencida, emDia]);

    const resultado = await conferirComOAsaas();

    expect((await agora(id)).assinatura).toBe("ATIVA");
    expect(doTeste(resultado, id).corrigido).toBeUndefined();
  });

  it("não grava por cima do webhook que chegou no meio da conferência", async () => {
    const { id } = await escritorio("webhook", { assinatura: "ATRASADA", asaasAssinaturaId: sub("webhook") });
    asaas.assinaturas.set(sub("webhook"), [emDia]);
    // O aviso chega enquanto a conferência pergunta ao Asaas, e cancela.
    asaas.durante.set(sub("webhook"), async () => {
      await admin.organizacao.update({ where: { id }, data: { assinatura: "CANCELADA" } });
    });

    const resultado = await conferirComOAsaas();

    expect((await agora(id)).assinatura).toBe("CANCELADA");
    expect(doTeste(resultado, id).corrigido).toBeUndefined();
  });

  it("assinatura encerrada no Asaas: CANCELADA, guardando o prazo do mês pago", async () => {
    const prazo = new Date(Date.now() + 10 * DIA);
    const { id } = await escritorio("encerrada", {
      assinatura: "ATIVA",
      acessoAte: prazo,
      asaasAssinaturaId: sub("encerrada"),
    });
    asaas.assinaturas.set(sub("encerrada"), [null]);

    await conferirComOAsaas();

    expect(await agora(id)).toMatchObject({ assinatura: "CANCELADA", acessoAte: prazo });
  });

  it("liga e libera a assinatura nova de quem cancelou e assinou de novo", async () => {
    const cliente = `cus_novo_${sufixo}`;
    const { id } = await escritorio("assinou-de-novo", {
      assinatura: "CANCELADA",
      acessoAte: new Date(Date.now() - DIA),
      asaasAssinaturaId: sub("velha"),
      asaasClienteId: cliente,
    });
    asaas.assinaturas.set(sub("velha"), [null]);
    asaas.assinaturas.set(sub("nova"), [emDia]);
    asaas.clientes.set(cliente, sub("nova"));

    await conferirComOAsaas();

    expect(await agora(id)).toMatchObject({ assinatura: "ATIVA", acessoAte: null, asaasAssinaturaId: sub("nova") });
  });

  it("cancelado aqui com a assinatura ainda cobrando lá: só alerta", async () => {
    const prazo = new Date(Date.now() + 10 * DIA);
    const { id } = await escritorio("cobrando", {
      assinatura: "CANCELADA",
      acessoAte: prazo,
      asaasAssinaturaId: sub("cobrando"),
    });
    asaas.assinaturas.set(sub("cobrando"), [emDia]);

    const resultado = await conferirComOAsaas();

    expect(await agora(id)).toMatchObject({ assinatura: "CANCELADA", acessoAte: prazo });
    expect(doTeste(resultado, id).alertas).toEqual([expect.stringMatching(/vai continuar cobrando/)]);
    expect(erros).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`${id}: cancelado no sistema`)));
  });

  it("liberado sem assinatura: alerta — e o escritório \"sem cobrança\" fica de fora", async () => {
    const { id: deGraca } = await escritorio("de-graca", { assinatura: "ATIVA" });
    const { id: isento } = await escritorio("isento", { assinatura: "ATIVA", semCobranca: true });

    const resultado = await conferirComOAsaas();

    expect(doTeste(resultado, deGraca).alertas).toEqual([expect.stringMatching(/^liberado sem nenhuma assinatura/)]);
    expect(doTeste(resultado, isento).alertas).toEqual([]);
    expect(resultado.corrigidos.some((c) => c.escritorio === isento)).toBe(false);
    expect((await agora(isento)).assinatura).toBe("ATIVA");
  });

  it("o próprio escritório não se marca como \"sem cobrança\"", async () => {
    const { id, adminId } = await escritorio("se-isenta", { assinatura: "ATIVA" });

    await expect(
      dbParaOrganizacao(id, { usuarioId: adminId, papel: "ADMIN" }).organizacao.update({
        where: { id },
        data: { semCobranca: true },
      }),
    ).rejects.toThrow(/só mudam pela cobrança/);
  });
});
