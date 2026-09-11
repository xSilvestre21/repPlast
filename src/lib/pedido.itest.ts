/**
 * Testes de integração das regras do pedido que dependem do banco.
 *
 * O foco é a numeração: ela é sequencial POR FORNECEDOR, e um número repetido
 * dentro da mesma indústria seria um problema sério — dois pedidos diferentes
 * chegariam lá com a mesma identificação.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbAdministrativo } from "./db";

const admin = dbAdministrativo();

let organizacaoId = "";
let fornecedorA = "";
let fornecedorB = "";
let clienteId = "";

/** Reproduz o que `criarPedido` faz para obter o próximo número. */
async function proximoNumero(fornecedorId: string) {
  const contador = await admin.fornecedor.update({
    where: { id: fornecedorId },
    data: { proximoNumeroPedido: { increment: 1 } },
    select: { proximoNumeroPedido: true },
  });

  return contador.proximoNumeroPedido - 1;
}

async function criar(fornecedorId: string) {
  return admin.pedido.create({
    data: {
      organizacaoId,
      clienteId,
      fornecedorId,
      numero: await proximoNumero(fornecedorId),
    },
    select: { id: true, numero: true },
  });
}

/** Reproduz o que `excluirPedido` faz: apaga e devolve o número se era o último. */
async function apagar(pedido: { id: string; numero: number }, fornecedorId: string) {
  await admin.pedido.deleteMany({ where: { id: pedido.id } });

  await admin.fornecedor.updateMany({
    where: { id: fornecedorId, proximoNumeroPedido: pedido.numero + 1 },
    data: { proximoNumeroPedido: { decrement: 1 } },
  });
}

beforeAll(async () => {
  const organizacao = await admin.organizacao.create({ data: { nome: "Teste numeração" } });
  organizacaoId = organizacao.id;

  const [a, b, cliente] = await Promise.all([
    admin.fornecedor.create({
      data: { organizacaoId, nome: "Indústria A", proximoNumeroPedido: 133 },
    }),
    admin.fornecedor.create({
      data: { organizacaoId, nome: "Indústria B", proximoNumeroPedido: 2253 },
    }),
    admin.cliente.create({
      data: { organizacaoId, apelido: "CLI", razaoSocial: "Cliente LTDA" },
    }),
  ]);

  fornecedorA = a.id;
  fornecedorB = b.id;
  clienteId = cliente.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

describe("numeração do pedido", () => {
  it("cada indústria tem a própria sequência", async () => {
    // É o caso real: a ERIPACK estava no 133 enquanto a QUALYPLAST estava no 2253.
    const primeiroA = await criar(fornecedorA);
    const primeiroB = await criar(fornecedorB);
    const segundoA = await criar(fornecedorA);

    expect(primeiroA.numero).toBe(133);
    expect(primeiroB.numero).toBe(2253);
    expect(segundoA.numero).toBe(134);
  });

  it("não deixa dois pedidos da mesma indústria com o mesmo número", async () => {
    const pedido = await criar(fornecedorA);

    await expect(
      admin.pedido.create({
        data: { organizacaoId, clienteId, fornecedorId: fornecedorA, numero: pedido.numero },
      }),
    ).rejects.toThrow();
  });

  it("o mesmo número em indústrias diferentes é permitido", async () => {
    const numero = 9999;

    await admin.pedido.create({
      data: { organizacaoId, clienteId, fornecedorId: fornecedorA, numero },
    });

    await expect(
      admin.pedido.create({
        data: { organizacaoId, clienteId, fornecedorId: fornecedorB, numero },
      }),
    ).resolves.toBeTruthy();
  });

  it("apagar o último pedido devolve o número para o próximo", async () => {
    const descartado = await criar(fornecedorA);
    await apagar(descartado, fornecedorA);

    const seguinte = await criar(fornecedorA);

    // O número não pode subir por causa de um pedido que deixou de existir: a
    // indústria confere a sequência dela, e um lançamento errado não pode
    // queimar um número.
    expect(seguinte.numero).toBe(descartado.numero);
  });

  it("apagar um do meio NÃO reaproveita o número", async () => {
    const doMeio = await criar(fornecedorA);
    const depois = await criar(fornecedorA);

    await apagar(doMeio, fornecedorA);
    const novo = await criar(fornecedorA);

    // Reaproveitar o vago faria o pedido de hoje sair com número menor que o
    // de ontem, e a numeração deixaria de dizer o que veio antes.
    expect(novo.numero).toBe(depois.numero + 1);
  });

  it("não devolve o número se outro pedido já pegou o seguinte", async () => {
    const alvo = await criar(fornecedorA);
    const posterior = await criar(fornecedorA);

    // O contador já andou além do `alvo`, então devolver entregaria ao próximo
    // um número que o `posterior` já ocupa.
    await apagar(alvo, fornecedorA);
    const novo = await criar(fornecedorA);

    expect(novo.numero).toBe(posterior.numero + 1);
  });

  it("pedidos simultâneos na mesma indústria pegam números distintos", async () => {
    // O `increment` do Prisma vira UPDATE ... RETURNING atômico, então mesmo
    // disparando tudo de uma vez ninguém repete número.
    const numeros = await Promise.all([
      proximoNumero(fornecedorB),
      proximoNumero(fornecedorB),
      proximoNumero(fornecedorB),
      proximoNumero(fornecedorB),
    ]);

    expect(new Set(numeros).size).toBe(numeros.length);
  });
});
