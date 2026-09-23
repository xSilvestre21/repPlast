/**
 * Testes de integração da lista de produtos que se pode lançar num documento.
 *
 * Esta consulta já esteve errada de um jeito silencioso: durante um tempo o
 * dono do produto morava em DOIS lugares — `produto.clienteId` e uma tabela de
 * vínculo à parte —, cadastrar produto preenchia um e lançar item lia o outro.
 * Ninguém viu, porque a tela simplesmente mostrava uma lista vazia: 23 dos 76
 * orçamentos com cliente e metade dos pedidos não ofereciam nada.
 *
 * É por isso que estes testes existem, e é por isso que o caso do produto de
 * OUTRO cliente está aqui: cada produto carrega o preço negociado do dono dele,
 * e afrouxar o corte sem perceber levaria o preço de uma empresa para dentro do
 * documento de outra.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbAdministrativo } from "./db";

const admin = dbAdministrativo();

let organizacaoId = "";
let industriaA = "";
let industriaB = "";
let clienteA = "";
let clienteB = "";

/** A mesma consulta que `orcamentos/[id]/page.tsx` e `pedidos/[id]/page.tsx` fazem. */
async function aoLancarPara(clienteId: string | null, fornecedorId: string) {
  const produtos = await admin.produto.findMany({
    where: {
      organizacaoId,
      fornecedorId,
      ativo: true,
      ...(clienteId ? { clienteId } : {}),
    },
    orderBy: { descricao: "asc" },
    select: { descricao: true },
  });

  return produtos.map((p) => p.descricao);
}

beforeAll(async () => {
  const organizacao = await admin.organizacao.create({
    data: { nome: "Teste lista de produtos" },
  });
  organizacaoId = organizacao.id;

  const [a, b, ca, cb] = await Promise.all([
    admin.fornecedor.create({ data: { organizacaoId, nome: "Indústria A" } }),
    admin.fornecedor.create({ data: { organizacaoId, nome: "Indústria B" } }),
    admin.cliente.create({
      data: { organizacaoId, apelido: "CLIENTE A", razaoSocial: "Cliente A LTDA" },
    }),
    admin.cliente.create({
      data: { organizacaoId, apelido: "CLIENTE B", razaoSocial: "Cliente B LTDA" },
    }),
  ]);

  industriaA = a.id;
  industriaB = b.id;
  clienteA = ca.id;
  clienteB = cb.id;

  /*
   * As medidas existem por causa do CHECK `produto_campos_por_familia`: saco
   * sem elas não entra no banco. Nada aqui depende do valor — o que se testa é
   * quem é o dono e de qual indústria é o produto.
   */
  const saco = {
    organizacaoId,
    familia: "SACO" as const,
    larguraCm: "90",
    comprimentoCm: "160",
    espessuraMm: "0.055",
    fatorKg: "13.50",
  };

  await admin.produto.createMany({
    data: [
      // O que deve aparecer ao lançar para o cliente A na indústria A.
      {
        ...saco,
        fornecedorId: industriaA,
        clienteId: clienteA,
        descricao: "do A, na A, com código",
        codigoCliente: "121010011",
      },
      {
        ...saco,
        fornecedorId: industriaA,
        clienteId: clienteA,
        descricao: "do A, na A, sem código",
      },
      // Os três que NÃO devem.
      {
        ...saco,
        fornecedorId: industriaA,
        clienteId: clienteB,
        descricao: "do B, na A",
      },
      {
        ...saco,
        fornecedorId: industriaB,
        clienteId: clienteA,
        descricao: "do A, na B",
      },
      {
        ...saco,
        fornecedorId: industriaA,
        clienteId: null,
        descricao: "de ninguém, na A",
      },
      {
        ...saco,
        fornecedorId: industriaA,
        clienteId: clienteA,
        descricao: "do A, na A, inativo",
        ativo: false,
      },
    ],
  });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: organizacaoId } });
});

describe("o que dá para lançar num documento", () => {
  it("traz o produto do cliente naquela indústria", async () => {
    const lista = await aoLancarPara(clienteA, industriaA);

    // O caso que ficou quebrado: com o dono em dois lugares, esta lista vinha
    // vazia mesmo com o cliente e a indústria certos.
    expect(lista).toContain("do A, na A, com código");
  });

  it("o produto sem código do cliente entra igual", async () => {
    const lista = await aoLancarPara(clienteA, industriaA);

    // O código é o número que ELE usa; nem todo cliente numera o que compra, e
    // isso nunca disse nada sobre de quem o produto é.
    expect(lista).toContain("do A, na A, sem código");
  });

  it("não traz o produto de outro cliente", async () => {
    const lista = await aoLancarPara(clienteA, industriaA);

    // O preço dele foi negociado com o outro cliente. Oferecê-lo aqui levaria
    // esse preço para dentro do documento de quem não o negociou.
    expect(lista).not.toContain("do B, na A");
  });

  it("não traz o produto do mesmo cliente em outra indústria", async () => {
    const lista = await aoLancarPara(clienteA, industriaA);

    // O documento é de uma indústria só: é ela que fatura, e é o IPI dela que
    // fica congelado.
    expect(lista).not.toContain("do A, na B");
  });

  it("não traz produto sem dono", async () => {
    const lista = await aoLancarPara(clienteA, industriaA);

    // Corte estrito, por decisão: item de catálogo sem dono não entra no
    // documento de um cliente. Para usá-lo, dá-se dono a ele na ficha.
    expect(lista).not.toContain("de ninguém, na A");
  });

  it("não traz produto inativo", async () => {
    const lista = await aoLancarPara(clienteA, industriaA);

    expect(lista).not.toContain("do A, na A, inativo");
  });

  it("a proposta avulsa recebe a indústria inteira", async () => {
    // Sem cliente não há dono a comparar. É o caminho por onde se cota antes de
    // abrir ficha — exigir o dono ali fecharia a porta de entrada.
    const lista = await aoLancarPara(null, industriaA);

    expect(lista).toContain("do A, na A, com código");
    expect(lista).toContain("do B, na A");
    expect(lista).toContain("de ninguém, na A");
    expect(lista).not.toContain("do A, na A, inativo");
  });
});
