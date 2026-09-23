/**
 * O caminho da proposta avulsa até o pedido, pelas ações de verdade.
 *
 * Proposta para quem ainda não é cliente NÃO vira pedido: os itens nascem de
 * conta, sem produto, e o pedido precisa de cliente cadastrado e de produto em
 * cada linha. O que se protege aqui é que esse bloqueio exista no servidor, e
 * não só na tela — e que o caminho de saída (cadastrar o cliente, depois os
 * produtos) funcione sem perder a conta nem o preço cotado.
 *
 * A sessão é simulada com o cliente administrativo, que passa por cima da RLS:
 * o isolamento entre escritórios tem testes próprios em `db.itest.ts`.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { dbAdministrativo } from "@/lib/db";

const admin = dbAdministrativo();
const sessao = { organizacaoId: "" };

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: sessao.organizacaoId,
    usuarioId: "00000000-0000-0000-0000-000000000000",
    papel: "ADMIN",
    ehAdmin: true,
    plano: "PRO",
    db: admin,
  }),
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

const { adicionarItem, adicionarItemPorConta, cadastrarProdutosDaProposta, converterEmPedido } =
  await import("./acoes");
const { criarClienteDaProposta } = await import("../clientes/acoes");
const { criarProdutoDoItem } = await import("../produtos/acoes");

let fornecedorId = "";
let aditivoId = "";
let orcamentoId = "";

function formulario(campos: Record<string, string>, aditivos: string[] = []): FormData {
  const formData = new FormData();
  for (const [campo, valor] of Object.entries(campos)) formData.set(campo, valor);
  for (const aditivo of aditivos) formData.append("aditivos", aditivo);
  return formData;
}

/** O que `ContaItem` envia para um saco 30×40×0,06 de PEAD. */
const SACO = {
  familia: "SACO",
  material: "PEAD",
  larguraCm: "30",
  comprimentoCm: "40",
  espessuraMm: "0,06",
  densidade: "0,1",
  fatorKg: "14,00",
  descricao: "30x40x0,06 S/SF PEAD C/ DESLIZANTE",
  unidade: "MIL",
  quantidade: "5",
};

beforeAll(async () => {
  const organizacao = await admin.organizacao.create({
    data: { nome: "Teste proposta avulsa" },
  });
  sessao.organizacaoId = organizacao.id;

  const fornecedor = await admin.fornecedor.create({
    data: { organizacaoId: organizacao.id, nome: "QUALYPLAST" },
  });
  fornecedorId = fornecedor.id;

  const aditivo = await admin.aditivo.create({
    data: {
      fornecedorId,
      nome: "Deslizante",
      sufixoDescricao: "C/ DESLIZANTE",
      tipo: "POR_KG",
      valor: "1",
    },
  });
  aditivoId = aditivo.id;

  const orcamento = await admin.orcamento.create({
    data: {
      organizacaoId: organizacao.id,
      fornecedorId,
      clienteAvulsoNome: "HIMAFLEX",
      clienteAvulsoMunicipio: "Limeira",
      numero: 1,
    },
  });
  orcamentoId = orcamento.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: sessao.organizacaoId } });
});

async function pedirPedido() {
  try {
    await converterEmPedido(orcamentoId, new FormData());
  } catch (erro) {
    return erro;
  }
  throw new Error("converterEmPedido deveria ter interrompido");
}

describe("proposta para quem ainda não é cliente", () => {
  it("não lança produto do catálogo", async () => {
    const estado = await adicionarItem(orcamentoId, {}, formulario({ produtoId: "x" }));
    expect(estado.erro).toMatch(/conta/);
  });

  it("lança o item pela conta, sem produto, com o preço da fórmula", async () => {
    const estado = await adicionarItemPorConta(orcamentoId, {}, formulario(SACO, [aditivoId]));
    expect(estado.erro).toBeUndefined();

    const [item] = await admin.orcamentoItem.findMany({ where: { orcamentoId } });

    // 30 × 40 × 0,06 × 0,1 = 7,2 kg; × (14 + 1 do aditivo) = 108 o milheiro.
    expect(item.produtoId).toBeNull();
    expect(item.precoUnitario.toString()).toBe("108");
    expect(item.totalSemIpi.toString()).toBe("540");
    expect(item.pesoKg.toString()).toBe("36");
    expect(item.conta).toMatchObject({ espessuraMm: "0,06", aditivos: [aditivoId] });
  });

  it("recusa aditivo de outra indústria", async () => {
    const estado = await adicionarItemPorConta(
      orcamentoId,
      {},
      formulario(SACO, ["00000000-0000-0000-0000-000000000001"]),
    );
    expect(estado.erro).toMatch(/aditivo/);
  });

  it("não vira pedido", async () => {
    const erro = await pedirPedido();
    expect(String(erro)).toMatch(/não vira pedido/);
  });
});

describe("depois de cadastrar o cliente", () => {
  let clienteId = "";

  beforeAll(async () => {
    // Uma fita também, para cadastrar esta pelo Novo produto e o saco em lote.
    const estado = await adicionarItemPorConta(
      orcamentoId,
      {},
      formulario({
        familia: "FITA",
        material: "Fita adesiva",
        precoCaixa: "120",
        descricao: "Fita adesiva 45x100",
        unidade: "CX",
        quantidade: "2",
      }),
    );
    expect(estado.erro).toBeUndefined();

    const cadastro = criarClienteDaProposta(
      orcamentoId,
      {},
      formulario({ apelido: "HIMAFLEX", razaoSocial: "HIMAFLEX LTDA", cnpj: "" }),
    );
    await expect(cadastro).rejects.toMatchObject({ destino: `/orcamentos/${orcamentoId}` });

    const orcamento = await admin.orcamento.findUniqueOrThrow({ where: { id: orcamentoId } });
    expect(orcamento.clienteId).not.toBeNull();
    expect(orcamento.clienteAvulsoNome).toBeNull();
    clienteId = orcamento.clienteId!;
  });

  it("ainda não vira pedido enquanto houver item sem produto", async () => {
    const erro = await pedirPedido();
    expect(String(erro)).toMatch(/Faltam 2 item/);
  });

  it("o Novo produto só aceita o cliente e a indústria da proposta", async () => {
    const fita = await admin.orcamentoItem.findFirstOrThrow({
      where: { orcamentoId, familia: "FITA" },
    });
    const campos = {
      familia: "FITA",
      material: "Fita adesiva",
      precoCaixa: "120",
      descricao: "Fita adesiva 45x100",
      fornecedorId,
      codigoFornecedor: "F-45",
    };

    const semCliente = await criarProdutoDoItem(fita.id, {}, formulario(campos));
    expect(semCliente.erro).toMatch(/cliente da proposta/);

    const certo = criarProdutoDoItem(fita.id, {}, formulario({ ...campos, clienteId }));
    await expect(certo).rejects.toMatchObject({ destino: `/orcamentos/${orcamentoId}` });

    const ligada = await admin.orcamentoItem.findUniqueOrThrow({
      where: { id: fita.id },
      include: { produto: true },
    });
    expect(ligada.produto?.clienteId).toBe(clienteId);
    expect(ligada.codigoFornecedor).toBe("F-45");
    // O item é o que o cliente recebeu: o preço cotado não muda.
    expect(ligada.precoUnitario.toString()).toBe("120");
  });

  it("cadastra o resto de uma vez, como produtos do cliente", async () => {
    const estado = await cadastrarProdutosDaProposta(orcamentoId, {}, new FormData());
    expect(estado.erro).toBeUndefined();

    const saco = await admin.orcamentoItem.findFirstOrThrow({
      where: { orcamentoId, familia: "SACO" },
      include: { produto: { include: { aditivos: true } } },
    });

    expect(saco.produto?.clienteId).toBe(clienteId);
    expect(saco.produto?.espessuraMm?.toString()).toBe("0.06");
    expect(saco.produto?.fatorKg?.toString()).toBe("14");
    expect(saco.produto?.aditivos.map((a) => a.aditivoId)).toEqual([aditivoId]);
    expect(saco.produto?.descricao).toBe(SACO.descricao);
  });

  it("e aí vira pedido", async () => {
    const erro = await pedirPedido();
    expect(erro).toBeInstanceOf(Redirecionou);

    const pedido = await admin.pedido.findFirstOrThrow({
      where: { orcamentoId },
      include: { itens: true },
    });
    expect(pedido.clienteId).toBe(clienteId);
    expect(pedido.itens.every((i) => i.produtoId !== null)).toBe(true);
  });
});

describe("saco vendido por quilo", () => {
  it("entra com o preço do kg = fator + aditivo por kg, e pesa a própria quantidade", async () => {
    const proposta = await admin.orcamento.create({
      data: {
        organizacaoId: sessao.organizacaoId,
        fornecedorId,
        clienteAvulsoNome: "QUEM COMPRA A PESO",
        numero: 2,
      },
    });

    const estado = await adicionarItemPorConta(
      proposta.id,
      {},
      formulario({ ...SACO, unidade: "KG", quantidade: "120" }, [aditivoId]),
    );
    expect(estado.erro).toBeUndefined();

    const [item] = await admin.orcamentoItem.findMany({ where: { orcamentoId: proposta.id } });

    // Fator 14 + deslizante 1 por kg = 15 o quilo; 120 kg = 1.800.
    expect(item.unidade).toBe("KG");
    expect(item.precoUnitario.toString()).toBe("15");
    expect(item.totalSemIpi.toString()).toBe("1800");
    expect(item.pesoKg.toString()).toBe("120");
  });
});
