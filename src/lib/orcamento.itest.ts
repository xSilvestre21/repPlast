/**
 * Testes de integração da numeração do orçamento.
 *
 * Diferente da do pedido, ela é POR ESCRITÓRIO e não por indústria: o orçamento
 * é documento do representante para o cliente, e a indústria nem fica sabendo
 * dele. O que se protege aqui é a devolução do número — apagar a proposta que
 * nasceu errada não pode queimar um número, e também não pode entregar à
 * próxima um número que já é de alguém.
 *
 * A busca da lista entra aqui pelo mesmo motivo: ela é uma consulta só,
 * compartilhada pela página e pela rota que pagina enquanto a pessoa digita.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buscarOrcamentos } from "@/app/(app)/orcamentos/consulta";

import { dbAdministrativo, type DbOrganizacao } from "./db";

const admin = dbAdministrativo();

let organizacaoId = "";
let outraOrganizacaoId = "";
let buscaOrganizacaoId = "";
let fornecedorId = "";
let buscaFornecedorId = "";

/** Reproduz o que `criarOrcamento` faz para obter o próximo número. */
async function proximoNumero(orgId: string) {
  const contador = await admin.organizacao.update({
    where: { id: orgId },
    data: { proximoNumeroOrcamento: { increment: 1 } },
    select: { proximoNumeroOrcamento: true },
  });

  return contador.proximoNumeroOrcamento - 1;
}

async function criar(orgId = organizacaoId, fornecedor = fornecedorId) {
  return admin.orcamento.create({
    data: {
      organizacaoId: orgId,
      fornecedorId: fornecedor,
      clienteAvulsoNome: "QUEM PEDIU PREÇO",
      numero: await proximoNumero(orgId),
    },
    select: { id: true, numero: true },
  });
}

/** Reproduz o que `excluirOrcamento` faz: apaga e devolve o número se era o último. */
async function apagar(orcamento: { id: string; numero: number }, orgId = organizacaoId) {
  await admin.orcamento.deleteMany({ where: { id: orcamento.id } });

  await admin.organizacao.updateMany({
    where: { id: orgId, proximoNumeroOrcamento: orcamento.numero + 1 },
    data: { proximoNumeroOrcamento: { decrement: 1 } },
  });
}

beforeAll(async () => {
  const [organizacao, outra, daBusca] = await Promise.all([
    admin.organizacao.create({
      data: { nome: "Teste numeração de orçamento", proximoNumeroOrcamento: 41 },
    }),
    admin.organizacao.create({
      data: { nome: "Escritório vizinho", proximoNumeroOrcamento: 41 },
    }),
    /*
     * A busca tem escritório próprio.
     *
     * O teste de numeração afirma números absolutos (41, 42), e criar orçamento
     * para testar busca no mesmo escritório empurraria o contador — quebrando um
     * teste conforme a ORDEM em que os arquivos declaram os seus, que é o tipo de
     * armadilha que o próximo a mexer aqui não merece.
     */
    admin.organizacao.create({ data: { nome: "Escritório da busca" } }),
  ]);

  organizacaoId = organizacao.id;
  outraOrganizacaoId = outra.id;
  buscaOrganizacaoId = daBusca.id;

  const [fornecedor, fornecedorDaBusca] = await Promise.all([
    admin.fornecedor.create({ data: { organizacaoId, nome: "Indústria" } }),
    admin.fornecedor.create({
      data: { organizacaoId: buscaOrganizacaoId, nome: "SELPACK" },
    }),
  ]);

  fornecedorId = fornecedor.id;
  buscaFornecedorId = fornecedorDaBusca.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({
    where: { id: { in: [organizacaoId, outraOrganizacaoId, buscaOrganizacaoId] } },
  });
});

/**
 * A busca da lista, com o mesmo cliente que a página usaria.
 *
 * `dbAdministrativo` passa por cima da RLS — o isolamento entre escritórios tem
 * testes próprios em `db.itest.ts` e não é o que se mede aqui.
 */
async function procurar(texto: string) {
  const fatia = await buscarOrcamentos(admin as unknown as DbOrganizacao, buscaOrganizacaoId, {
    busca: texto,
    status: "todos",
    pagina: 0,
  });

  return fatia.linhas.map((l) => l.numero);
}

/** Números escolhidos à mão: 7 e 70 para o par que se confundiria. */
async function orcamentoDaBusca(numero: number, nome: string) {
  await admin.orcamento.create({
    data: {
      organizacaoId: buscaOrganizacaoId,
      fornecedorId: buscaFornecedorId,
      clienteAvulsoNome: nome,
      numero,
    },
  });

  return numero;
}

describe("busca da lista", () => {
  beforeAll(async () => {
    await Promise.all([
      orcamentoDaBusca(7, "HIMAFLEX EMBALAGENS"),
      orcamentoDaBusca(70, "OUTRA EMPRESA"),
    ]);
  });

  it("acha pelo número do orçamento", async () => {
    // O número existe para o documento ser citável ao telefone; procurar por
    // ele é o uso mais direto que ele tem — e era o que faltava.
    expect(await procurar("7")).toContain(7);
  });

  it("aceita o `#` que a tela imprime junto", async () => {
    // "Orçamento #7" é como o título escreve, e quem copia de lá copia o `#`.
    expect(await procurar("#7")).toContain(7);
  });

  it("não traz o número que apenas contém os dígitos", async () => {
    // A comparação é exata: quem digita "7" quer o 7, não o 70.
    expect(await procurar("7")).not.toContain(70);
  });

  it("continua achando pelo nome de quem pediu o preço", async () => {
    expect(await procurar("himaflex")).toEqual([7]);
  });

  it("continua achando pela indústria", async () => {
    expect(await procurar("selpack")).toHaveLength(2);
  });

  it("texto que não é número não quebra a consulta", async () => {
    // O filtro por número tem de SUMIR do `OR`, e não virar `NaN`.
    await expect(procurar("nao existe nada assim")).resolves.toEqual([]);
  });

  it("número grande demais para o banco não estoura", async () => {
    // Acima do `int` do Postgres a consulta falharia; a busca só devolve vazio.
    await expect(procurar("99999999999999")).resolves.toEqual([]);
  });
});

describe("numeração do orçamento", () => {
  it("é sequencial dentro do escritório", async () => {
    const primeiro = await criar();
    const segundo = await criar();

    expect(primeiro.numero).toBe(41);
    expect(segundo.numero).toBe(42);
  });

  it("não deixa duas propostas do mesmo escritório com o mesmo número", async () => {
    const orcamento = await criar();

    await expect(
      admin.orcamento.create({
        data: {
          organizacaoId,
          fornecedorId,
          clienteAvulsoNome: "OUTRO",
          numero: orcamento.numero,
        },
      }),
    ).rejects.toThrow();
  });

  it("apagar a última proposta devolve o número para a próxima", async () => {
    const descartada = await criar();
    await apagar(descartada);

    const seguinte = await criar();

    // O número não pode subir por causa de uma proposta que deixou de existir:
    // ele é como o documento se cita ao telefone, e o lançamento errado não
    // pode levar um embora.
    expect(seguinte.numero).toBe(descartada.numero);
  });

  it("apagar uma do meio NÃO reaproveita o número", async () => {
    const doMeio = await criar();
    const depois = await criar();

    await apagar(doMeio);
    const nova = await criar();

    // Reaproveitar o vago faria a proposta de hoje sair com número menor que a
    // de ontem, e a numeração deixaria de dizer o que veio antes.
    expect(nova.numero).toBe(depois.numero + 1);
  });

  it("não devolve o número se outra proposta já pegou o seguinte", async () => {
    const alvo = await criar();
    const posterior = await criar();

    // O contador já andou além do `alvo`, então devolver entregaria à próxima
    // um número que a `posterior` já ocupa.
    await apagar(alvo);
    const nova = await criar();

    expect(nova.numero).toBe(posterior.numero + 1);
  });

  it("o mesmo número em escritórios diferentes é permitido", async () => {
    const outroFornecedor = await admin.fornecedor.create({
      data: { organizacaoId: outraOrganizacaoId, nome: "Indústria do vizinho" },
    });

    // O contador é por escritório: o vizinho começou no 41 igual, e uma proposta
    // #41 aqui não impede a #41 de lá.
    const vizinha = await criar(outraOrganizacaoId, outroFornecedor.id);

    expect(vizinha.numero).toBe(41);
  });

  it("propostas simultâneas do mesmo escritório pegam números distintos", async () => {
    // O `increment` do Prisma vira UPDATE ... RETURNING atômico, então mesmo
    // disparando tudo de uma vez ninguém repete número.
    const numeros = await Promise.all([
      proximoNumero(organizacaoId),
      proximoNumero(organizacaoId),
      proximoNumero(organizacaoId),
      proximoNumero(organizacaoId),
    ]);

    expect(new Set(numeros).size).toBe(numeros.length);
  });
});
