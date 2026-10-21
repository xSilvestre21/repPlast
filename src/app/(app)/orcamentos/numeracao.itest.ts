/**
 * O número da proposta nova, pela ação de verdade.
 *
 * O contador do escritório pode ficar ATRÁS de um número já usado — proposta
 * gravada direto no banco, sem passar por ele. Antes, toda proposta nova batia
 * no índice único e a tela dizia "já existe um cadastro com esses mesmos
 * dados", qualquer que fosse o cliente. O que se protege aqui é que a criação
 * se recupere sozinha disso.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { dbAdministrativo } from "@/lib/db";
import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();
const sessao = { organizacaoId: "", usuarioId: "" };

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: sessao.organizacaoId,
    usuarioId: sessao.usuarioId,
    papel: "ADMIN",
    ehAdmin: true,
    plano: "PRO",
    db: admin,
  }),
  exigirAdmin: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

/** `redirect` do Next interrompe a ação lançando; aqui ele lança o destino. */
class Redirecionou extends Error {
  constructor(readonly destino: string) {
    super(`redirect ${destino}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
}));

const { criarOrcamento } = await import("./acoes");

let fornecedorId = "";

beforeAll(async () => {
  const organizacao = await admin.organizacao.create({
    data: { nome: nomeDeTeste("Teste contador atrasado"), proximoNumeroOrcamento: 1 },
  });
  sessao.organizacaoId = organizacao.id;
  const dono = await admin.usuario.create({
    data: {
      organizacaoId: organizacao.id,
      nome: "Dono",
      email: `dono-${organizacao.id}@teste.local`,
      senhaHash: "x",
      papel: "ADMIN",
    },
  });
  sessao.usuarioId = dono.id;

  const fornecedor = await admin.fornecedor.create({
    data: { organizacaoId: organizacao.id, nome: "ALFAPLAST" },
  });
  fornecedorId = fornecedor.id;

  // Gravadas sem passar pelo contador, que continua em 1.
  await admin.orcamento.createMany({
    data: [1, 2, 3].map((numero) => ({
      organizacaoId: organizacao.id,
      fornecedorId,
      clienteAvulsoNome: "JÁ ESTAVA",
      numero,
    })),
  });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: sessao.organizacaoId } });
});

/** Cria pela ação e devolve o número que a proposta ganhou. */
async function criar(nome: string) {
  const formData = new FormData();
  formData.set("clienteAvulsoNome", nome);
  formData.set("fornecedorId", fornecedorId);

  let destino = "";
  try {
    const estado = await criarOrcamento({}, formData);
    throw new Error(`a ação recusou: ${estado.erro}`);
  } catch (erro) {
    if (!(erro instanceof Redirecionou)) throw erro;
    destino = erro.destino;
  }

  const id = destino.replace("/orcamentos/", "");
  const orcamento = await admin.orcamento.findUniqueOrThrow({
    where: { id },
    select: { numero: true },
  });
  return orcamento.numero;
}

describe("contador atrás de propostas que já existem", () => {
  it("a proposta nova pula os números ocupados em vez de recusar", async () => {
    expect(await criar("PRIMEIRA DEPOIS DA CARGA")).toBe(4);
  });

  it("e a seguinte continua a sequência", async () => {
    expect(await criar("SEGUNDA")).toBe(5);
  });
});
