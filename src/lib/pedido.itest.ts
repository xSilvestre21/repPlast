/**
 * Testes de integração das regras do pedido que dependem do banco.
 *
 * O foco é a numeração: ela é sequencial POR FORNECEDOR, e um número repetido
 * dentro da mesma indústria seria um problema sério — dois pedidos diferentes
 * chegariam lá com a mesma identificação.
 *
 * A busca da lista entra aqui pelo mesmo motivo que no orçamento: ela é uma
 * consulta só, compartilhada pela página e pela rota que pagina enquanto a
 * pessoa digita.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buscarPedidos } from "@/app/(app)/pedidos/consulta";

import { dbAdministrativo, type DbOrganizacao } from "./db";

const admin = dbAdministrativo();

let organizacaoId = "";
let fornecedorA = "";
let fornecedorB = "";
let clienteId = "";

/*
 * A busca tem escritório próprio.
 *
 * Os testes de numeração afirmam números absolutos (133, 2253), e criar pedido
 * para testar busca no mesmo fornecedor empurraria o contador — quebrando um
 * teste conforme a ORDEM em que os `describe` aparecem no arquivo. Aconteceu no
 * `orcamento.itest.ts` e não se repete aqui.
 */
let buscaOrganizacaoId = "";
let buscaFornecedorId = "";

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
  const [organizacao, daBusca] = await Promise.all([
    admin.organizacao.create({ data: { nome: "Teste numeração" } }),
    admin.organizacao.create({ data: { nome: "Escritório da busca de pedidos" } }),
  ]);

  organizacaoId = organizacao.id;
  buscaOrganizacaoId = daBusca.id;

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

  const fornecedorDaBusca = await admin.fornecedor.create({
    data: { organizacaoId: buscaOrganizacaoId, nome: "SELPACK" },
  });

  buscaFornecedorId = fornecedorDaBusca.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({
    where: { id: { in: [organizacaoId, buscaOrganizacaoId] } },
  });
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

/**
 * A busca da lista, com a mesma consulta que a página e a rota usam.
 *
 * `dbAdministrativo` passa por cima da RLS — o isolamento entre escritórios e
 * entre prepostos tem testes próprios em `db.itest.ts` e não é o que se mede
 * aqui.
 */
async function procurar(texto: string, status: "todos" | "aberto" | "enviado" | "cancelado" = "todos") {
  const fatia = await buscarPedidos(admin as unknown as DbOrganizacao, buscaOrganizacaoId, {
    busca: texto,
    status,
    pagina: 0,
  });

  return fatia.linhas.map((l) => l.numero);
}

describe("busca da lista de pedidos", () => {
  beforeAll(async () => {
    const cliente = await admin.cliente.create({
      data: {
        organizacaoId: buscaOrganizacaoId,
        apelido: "HIMAFLEX",
        razaoSocial: "HIMAFLEX EMBALAGENS LTDA",
      },
    });

    const comum = {
      organizacaoId: buscaOrganizacaoId,
      fornecedorId: buscaFornecedorId,
      clienteId: cliente.id,
    };

    await admin.pedido.createMany({
      data: [
        // 7 e 70 formam o par que se confundiria numa busca por "contém".
        { ...comum, numero: 7, status: "ABERTO", pedidoDoCliente: "PC 228156" },
        { ...comum, numero: 70, status: "ENVIADO", enviadoEm: new Date() },
        /*
         * O caso que só o pedido tem: cancelar NÃO apaga `enviadoEm`
         * (ver `mudarStatus` em `pedidos/acoes.ts`). Este pedido tem as duas
         * datas, e é ele que prova que o filtro olha o enum e não a data.
         */
        { ...comum, numero: 99, status: "CANCELADO", enviadoEm: new Date(), canceladoEm: new Date() },
      ],
    });
  });

  it("acha pelo número do pedido", async () => {
    expect(await procurar("7")).toContain(7);
  });

  it("aceita o `#` que a tela imprime junto", async () => {
    expect(await procurar("#7")).toContain(7);
  });

  it("não traz o número que apenas contém os dígitos", async () => {
    // A comparação é exata: quem digita "7" quer o 7, não o 70.
    expect(await procurar("7")).not.toContain(70);
  });

  it("acha pelo apelido do cliente", async () => {
    expect(await procurar("himaflex")).toHaveLength(3);
  });

  it("acha pela razão social", async () => {
    expect(await procurar("embalagens ltda")).toHaveLength(3);
  });

  it("acha pela indústria", async () => {
    expect(await procurar("selpack")).toHaveLength(3);
  });

  it("acha pela ordem de compra do cliente", async () => {
    // O número que vem de FORA: é por ele que o cliente se refere ao pedido.
    expect(await procurar("228156")).toEqual([7]);
  });

  it("texto que não é número não quebra a consulta", async () => {
    // O filtro por número tem de SUMIR do `OR`, e não virar `NaN`.
    await expect(procurar("nao existe nada assim")).resolves.toEqual([]);
  });

  it("número grande demais para o banco não estoura", async () => {
    await expect(procurar("99999999999999")).resolves.toEqual([]);
  });
});

describe("filtro de status do pedido", () => {
  it("em aberto traz só o aberto", async () => {
    expect(await procurar("", "aberto")).toEqual([7]);
  });

  it("enviados traz só o enviado", async () => {
    expect(await procurar("", "enviado")).toEqual([70]);
  });

  it("cancelados traz só o cancelado", async () => {
    expect(await procurar("", "cancelado")).toEqual([99]);
  });

  it("cancelado que já foi enviado NÃO aparece em enviados", async () => {
    /*
     * O #99 tem `enviadoEm` E `canceladoEm` preenchidos, porque cancelar
     * preserva o carimbo do envio de propósito. Um filtro escrito como
     * `enviadoEm: { not: null }` traria ele aqui — por isso o filtro é pelo
     * enum, e por isso este teste existe.
     */
    expect(await procurar("", "enviado")).not.toContain(99);
    expect(await procurar("", "cancelado")).toContain(99);
  });

  it("sem filtro traz os três", async () => {
    expect(await procurar("")).toHaveLength(3);
  });

  it("o filtro combina com a busca", async () => {
    expect(await procurar("himaflex", "cancelado")).toEqual([99]);
  });
});
