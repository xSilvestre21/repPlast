/**
 * Conjunto com fornecedor de tampa e acabamento, do cadastro ao PDF, pelas ações.
 *
 * O que se protege: o acabamento entra no preço; o fornecedor da tampa acompanha a
 * linha do pedido e da proposta, e não aparece no PDF que a indústria recebe.
 *
 * A sessão é simulada com o cliente administrativo, como em
 * `orcamentos/avulso.itest.ts`.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { dbAdministrativo } from "@/lib/db";
import { nomeDeTeste } from "../../../../test/nome-de-teste";

const admin = dbAdministrativo();
const sessao = { organizacaoId: "", usuarioId: "", ehAdmin: true };

vi.mock("@/lib/sessao", () => ({
  escopoAtual: async () => ({
    organizacaoId: sessao.organizacaoId,
    usuarioId: sessao.usuarioId,
    papel: "ADMIN",
    ehAdmin: sessao.ehAdmin,
    plano: "PRO",
    db: admin,
  }),
  exigirAdmin: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

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

const pedidos = await import("./acoes");
const propostas = await import("../orcamentos/acoes");
const { criarProduto, criarProdutoDoItem } = await import("../produtos/acoes");
const { excluirFornecedor } = await import("../fornecedores/acoes");
const { carregarPedidoParaPdf } = await import("@/lib/pdf/gerar-pedido");

let fornecedorId = "";
let daTampaId = "";
let clienteId = "";
let produtoVariavelId = "";
let produtoFixoId = "";
let proximoNumero = 100;

function formulario(campos: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [campo, valor] of Object.entries(campos)) formData.set(campo, valor);
  return formData;
}

const CONJUNTO = {
  familia: "FRASCO_TAMPA",
  material: "PEAD",
  capacidade: "500",
  capacidadeUnidade: "mL",
  diametroMm: "28",
  precoAvulso: "2.000,00",
};

async function novoPedido() {
  return admin.pedido.create({
    data: {
      organizacaoId: sessao.organizacaoId,
      fornecedorId,
      clienteId,
      numero: proximoNumero++,
      criadoPorId: sessao.usuarioId,
    },
  });
}

async function novaProposta(cliente: string | null = clienteId) {
  return admin.orcamento.create({
    data: {
      organizacaoId: sessao.organizacaoId,
      fornecedorId,
      numero: proximoNumero++,
      ...(cliente ? { clienteId: cliente } : { clienteAvulsoNome: "QUEM AINDA NÃO É CLIENTE" }),
    },
  });
}

/** A linha antes de dizer com ou sem mão de obra. */
const SEM_ESCOLHA = { unidade: "MIL", quantidade: "2" };

/** O que `FormularioAdicao` envia. */
const LINHA = { ...SEM_ESCOLHA, acabamentoMaoDeObra: "COM" };

const itemDoPedido = (pedidoId: string) =>
  admin.pedidoItem.findFirstOrThrow({ where: { pedidoId } });

beforeAll(async () => {
  const organizacao = await admin.organizacao.create({
    data: { nome: nomeDeTeste("Teste tampa e acabamento") },
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

  const [fornecedor, daTampa, cliente] = await Promise.all([
    admin.fornecedor.create({ data: { organizacaoId: organizacao.id, nome: "VELAPLAST" } }),
    admin.fornecedor.create({ data: { organizacaoId: organizacao.id, nome: "SOROPLAST" } }),
    admin.cliente.create({
      data: { organizacaoId: organizacao.id, apelido: "COMPRADOR", razaoSocial: "Comprador LTDA" },
    }),
  ]);
  fornecedorId = fornecedor.id;
  daTampaId = daTampa.id;
  clienteId = cliente.id;

  const cadastrar = async (campos: Record<string, string>) => {
    await expect(
      criarProduto(
        {},
        formulario({ ...CONJUNTO, fornecedorId, clienteId, ...campos }),
      ),
    ).rejects.toBeInstanceOf(Redirecionou);

    return admin.produto.findFirstOrThrow({
      where: { organizacaoId: organizacao.id, descricao: campos.descricao },
    });
  };

  const variavel = await cadastrar({
    descricao: "Frasco variável Serigrafado",
    fornecedorTampaVariavel: "1",
    codigoTampa: "T-42",
    acabamento: "Serigrafado",
    acabamentoValorCom: "150,00",
    acabamentoValorSem: "90,00",
  });
  produtoVariavelId = variavel.id;

  const fixo = await cadastrar({
    descricao: "Frasco com tampa de outra",
    fornecedorTampaId: daTampaId,
    codigoTampa: "T-99",
  });
  produtoFixoId = fixo.id;
});

afterAll(async () => {
  await admin.pedido.deleteMany({ where: { organizacaoId: sessao.organizacaoId } });
  await admin.orcamento.deleteMany({ where: { organizacaoId: sessao.organizacaoId } });
  await admin.organizacao.deleteMany({ where: { id: sessao.organizacaoId } });
});

describe("cadastro", () => {
  it("guarda acabamento e tampa, sem fornecedor fixo no variável", async () => {
    const produto = await admin.produto.findUniqueOrThrow({ where: { id: produtoVariavelId } });

    expect(produto).not.toHaveProperty("acabamentoMaoDeObra");
    expect(produto).toMatchObject({
      acabamento: "Serigrafado",
      fornecedorTampaVariavel: true,
      fornecedorTampaId: null,
      codigoTampa: "T-42",
    });
    expect(produto.acabamentoValorCom?.toString()).toBe("150");
    expect(produto.acabamentoValorSem?.toString()).toBe("90");
  });

  it("recusa indústria da tampa que não é do escritório", async () => {
    const estado = await criarProduto(
      {},
      formulario({
        ...CONJUNTO,
        fornecedorId,
        descricao: "Outro",
        fornecedorTampaId: "00000000-0000-4000-8000-000000000000",
      }),
    );

    expect(estado.campo).toBe("fornecedorTampaId");
  });
});

describe("pedido", () => {
  it("variável sem escolha é recusado, apontando o campo", async () => {
    const pedido = await novoPedido();

    const estado = await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId }),
    );

    expect(estado.campo).toBe("fornecedorTampaId");
    expect(await admin.pedidoItem.count({ where: { pedidoId: pedido.id } })).toBe(0);
  });

  it("variável com escolha grava fornecedor, código e o preço com acabamento", async () => {
    const pedido = await novoPedido();

    const estado = await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId, fornecedorTampaId: daTampaId }),
    );
    expect(estado.erro).toBeUndefined();

    const item = await itemDoPedido(pedido.id);
    expect(item).toMatchObject({
      fornecedorTampaId: daTampaId,
      fornecedorTampaNome: "SOROPLAST",
      codigoTampa: "T-42",
    });
    expect(item.precoUnitario.toString()).toBe("2150");
    expect(item.total.toString()).toBe("4300");
    expect(item.acabamentoMaoDeObra).toBe(true);
    expect(item.descricao).toBe("Frasco variável Serigrafado");
  });

  it("sem dizer com ou sem mão de obra é recusado, apontando o campo", async () => {
    const pedido = await novoPedido();

    const estado = await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({
        ...SEM_ESCOLHA,
        produtoId: produtoVariavelId,
        fornecedorTampaId: daTampaId,
      }),
    );

    expect(estado.campo).toBe("acabamentoMaoDeObra");
    expect(await admin.pedidoItem.count({ where: { pedidoId: pedido.id } })).toBe(0);
  });

  it("sem mão de obra cobra o outro valor", async () => {
    const pedido = await novoPedido();

    await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({
        ...LINHA,
        acabamentoMaoDeObra: "SEM",
        produtoId: produtoVariavelId,
        fornecedorTampaId: daTampaId,
      }),
    );

    const item = await itemDoPedido(pedido.id);
    expect(item.precoUnitario.toString()).toBe("2090");
    expect(item.acabamentoMaoDeObra).toBe(false);
  });

  it("voltar de amostra recalcula com a escolha da linha", async () => {
    const pedido = await novoPedido();

    await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({
        ...LINHA,
        acabamentoMaoDeObra: "SEM",
        produtoId: produtoVariavelId,
        fornecedorTampaId: daTampaId,
      }),
    );

    await pedidos.alternarAmostra(pedido.id, {}, new FormData());
    expect((await itemDoPedido(pedido.id)).precoUnitario.toString()).toBe("0");

    await pedidos.alternarAmostra(pedido.id, {}, new FormData());
    expect((await itemDoPedido(pedido.id)).precoUnitario.toString()).toBe("2090");
  });

  it("fixo já entra com o fornecedor do cadastro", async () => {
    const pedido = await novoPedido();

    await pedidos.adicionarItem(pedido.id, {}, formulario({ ...LINHA, produtoId: produtoFixoId }));

    expect(await itemDoPedido(pedido.id)).toMatchObject({
      fornecedorTampaId: daTampaId,
      fornecedorTampaNome: "SOROPLAST",
      codigoTampa: "T-99",
    });
  });

  it("trocar o fornecedor na linha grava, e no fixo a tentativa não muda nada", async () => {
    const outra = await admin.fornecedor.create({
      data: { organizacaoId: sessao.organizacaoId, nome: "ALEMOLDE" },
    });

    const pedido = await novoPedido();
    await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId, fornecedorTampaId: daTampaId }),
    );
    const item = await itemDoPedido(pedido.id);

    const estado = await pedidos.atualizarItem(
      pedido.id,
      {},
      formulario({
        itemId: item.id,
        quantidade: "2",
        precoUnitario: "2.150,00",
        fornecedorTampaId: outra.id,
      }),
    );
    expect(estado.erro).toBeUndefined();
    expect(await itemDoPedido(pedido.id)).toMatchObject({
      fornecedorTampaId: outra.id,
      fornecedorTampaNome: "ALEMOLDE",
    });

    const fixo = await novoPedido();
    await pedidos.adicionarItem(fixo.id, {}, formulario({ ...LINHA, produtoId: produtoFixoId }));
    const linhaFixa = await itemDoPedido(fixo.id);

    await pedidos.atualizarItem(
      fixo.id,
      {},
      formulario({
        itemId: linhaFixa.id,
        quantidade: "2",
        precoUnitario: "2.000,00",
        fornecedorTampaId: outra.id,
      }),
    );
    expect((await itemDoPedido(fixo.id)).fornecedorTampaId).toBe(daTampaId);
  });

  it("salvar a quantidade não confere de novo a indústria que foi inativada", async () => {
    const inativa = await admin.fornecedor.create({
      data: { organizacaoId: sessao.organizacaoId, nome: "VAI SAIR" },
    });

    const pedido = await novoPedido();
    await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId, fornecedorTampaId: inativa.id }),
    );
    await admin.fornecedor.update({ where: { id: inativa.id }, data: { ativo: false } });

    const item = await itemDoPedido(pedido.id);
    const estado = await pedidos.atualizarItem(
      pedido.id,
      {},
      formulario({
        itemId: item.id,
        quantidade: "3",
        precoUnitario: "2.150,00",
        fornecedorTampaId: inativa.id,
      }),
    );

    expect(estado.erro).toBeUndefined();
    expect((await itemDoPedido(pedido.id)).quantidade.toString()).toBe("3");
  });

  it("não aceita escolher indústria inativa", async () => {
    const inativa = await admin.fornecedor.create({
      data: { organizacaoId: sessao.organizacaoId, nome: "INATIVA", ativo: false },
    });
    const pedido = await novoPedido();

    const estado = await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId, fornecedorTampaId: inativa.id }),
    );

    expect(estado.campo).toBe("fornecedorTampaId");
  });

  it("duplicar mantém a tampa", async () => {
    const pedido = await novoPedido();
    await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId, fornecedorTampaId: daTampaId }),
    );

    let destino = "";
    await pedidos.duplicarPedido(pedido.id, {}, new FormData()).catch((erro) => {
      destino = (erro as Redirecionou).destino;
    });

    expect(await itemDoPedido(destino.split("/").pop()!)).toMatchObject({
      fornecedorTampaId: daTampaId,
      fornecedorTampaNome: "SOROPLAST",
      codigoTampa: "T-42",
      acabamentoMaoDeObra: true,
    });
  });

  it("o PDF mostra o acabamento na descrição, e nada da tampa", async () => {
    const pedido = await novoPedido();
    await pedidos.adicionarItem(
      pedido.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId, fornecedorTampaId: daTampaId }),
    );

    const pdf = await carregarPedidoParaPdf(pedido.id, sessao.organizacaoId, {
      usuarioId: sessao.usuarioId,
      papel: "ADMIN",
    });

    const texto = JSON.stringify(pdf?.dados.itens);
    expect(texto).toContain("Frasco variável Serigrafado");
    expect(texto).not.toContain("SOROPLAST");
    expect(texto).not.toContain("T-42");
    expect(texto).not.toContain("fornecedorTampa");
    expect(texto).not.toMatch(/maoDeObra|mão de obra/i);
  });
});

describe("proposta", () => {
  it("variável pode entrar sem escolha, e a linha do pedido completa depois", async () => {
    const proposta = await novaProposta();

    const estado = await propostas.adicionarItem(
      proposta.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId }),
    );
    expect(estado.erro).toBeUndefined();

    let destino = "";
    await propostas.converterEmPedido(proposta.id, {}, new FormData()).catch((erro) => {
      destino = (erro as Redirecionou).destino;
    });
    const pedidoId = destino.split("/").pop()!;

    const item = await itemDoPedido(pedidoId);
    expect(item.fornecedorTampaId).toBeNull();
    expect(item.codigoTampa).toBe("T-42");

    await pedidos.atualizarItem(
      pedidoId,
      {},
      formulario({
        itemId: item.id,
        quantidade: "2",
        precoUnitario: "2.150,00",
        fornecedorTampaId: daTampaId,
      }),
    );

    expect((await itemDoPedido(pedidoId)).fornecedorTampaNome).toBe("SOROPLAST");
  });

  it("converter leva a escolha feita na proposta", async () => {
    const proposta = await novaProposta();
    await propostas.adicionarItem(
      proposta.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId, fornecedorTampaId: daTampaId }),
    );

    let destino = "";
    await propostas.converterEmPedido(proposta.id, {}, new FormData()).catch((erro) => {
      destino = (erro as Redirecionou).destino;
    });

    expect(await itemDoPedido(destino.split("/").pop()!)).toMatchObject({
      fornecedorTampaId: daTampaId,
      fornecedorTampaNome: "SOROPLAST",
      codigoTampa: "T-42",
      acabamentoMaoDeObra: true,
    });
  });

  it("a proposta segue a mesma regra do acabamento", async () => {
    const proposta = await novaProposta();

    const recusada = await propostas.adicionarItem(
      proposta.id,
      {},
      formulario({ ...SEM_ESCOLHA, produtoId: produtoVariavelId }),
    );
    expect(recusada.campo).toBe("acabamentoMaoDeObra");

    const estado = await propostas.adicionarItem(
      proposta.id,
      {},
      formulario({ ...LINHA, produtoId: produtoVariavelId }),
    );
    expect(estado.erro).toBeUndefined();

    const item = await admin.orcamentoItem.findFirstOrThrow({ where: { orcamentoId: proposta.id } });
    expect(item.precoUnitario.toString()).toBe("2150");
    expect(item.descricao).toBe("Frasco variável Serigrafado");
  });

  /** O que `ContaItem` envia para um conjunto com acabamento. */
  const CONTA = {
    ...CONJUNTO,
    ...LINHA,
    descricao: "Frasco 500mL PEAD Rotulado Adesivo + Tampa 28mm",
    acabamento: "Rotulado Adesivo",
    acabamentoMaoDeObra: "SEM",
    acabamentoValorCom: "150,00",
    acabamentoValorSem: "90,00",
  };

  const itemDaProposta = (orcamentoId: string) =>
    admin.orcamentoItem.findFirstOrThrow({ where: { orcamentoId } });

  it("a conta soma o acabamento e guarda o fornecedor escolhido", async () => {
    const proposta = await novaProposta(null);

    const estado = await propostas.adicionarItemPorConta(
      proposta.id,
      {},
      formulario({ ...CONTA, fornecedorTampaVariavel: "1", fornecedorTampaId: daTampaId }),
    );
    expect(estado.erro).toBeUndefined();

    const item = await itemDaProposta(proposta.id);
    expect(item.precoUnitario.toString()).toBe("2090");
    expect(item).toMatchObject({
      fornecedorTampaId: daTampaId,
      fornecedorTampaNome: "SOROPLAST",
      acabamentoMaoDeObra: false,
    });
  });

  it("cadastrar a conta como produto leva acabamento e o fornecedor variável", async () => {
    const proposta = await novaProposta(null);
    await propostas.adicionarItemPorConta(
      proposta.id,
      {},
      formulario({ ...CONTA, fornecedorTampaVariavel: "1", fornecedorTampaId: daTampaId }),
    );
    await admin.orcamento.update({ where: { id: proposta.id }, data: { clienteId } });

    const estado = await propostas.cadastrarProdutosDaProposta(proposta.id, {}, new FormData());
    expect(estado.erro).toBeUndefined();

    const item = await admin.orcamentoItem.findFirstOrThrow({
      where: { orcamentoId: proposta.id },
      include: { produto: true },
    });

    expect(item.produto).toMatchObject({
      acabamento: "Rotulado Adesivo",
      fornecedorTampaVariavel: true,
      fornecedorTampaId: null,
    });
    // As escolhas da proposta continuam na linha.
    expect(item.fornecedorTampaId).toBe(daTampaId);
    expect(item.acabamentoMaoDeObra).toBe(false);
  });

  it("a conta com indústria fixa que sumiu é recusada com frase clara", async () => {
    const some = await admin.fornecedor.create({
      data: { organizacaoId: sessao.organizacaoId, nome: "VAI SUMIR" },
    });
    const proposta = await novaProposta(null);
    await propostas.adicionarItemPorConta(
      proposta.id,
      {},
      formulario({ ...CONTA, fornecedorTampaId: some.id }),
    );
    await admin.fornecedor.delete({ where: { id: some.id } });
    await admin.orcamento.update({ where: { id: proposta.id }, data: { clienteId } });

    const estado = await propostas.cadastrarProdutosDaProposta(proposta.id, {}, new FormData());

    expect(estado.erro).toMatch(/fornecedor da tampa/);
    expect((await itemDaProposta(proposta.id)).fornecedorTampaNome).toBe("VAI SUMIR");
  });

  it("o Novo produto da linha grava o fornecedor fixo na linha", async () => {
    const proposta = await novaProposta(null);
    await propostas.adicionarItemPorConta(proposta.id, {}, formulario(CONTA));
    await admin.orcamento.update({ where: { id: proposta.id }, data: { clienteId } });
    const item = await itemDaProposta(proposta.id);

    await expect(
      criarProdutoDoItem(
        item.id,
        {},
        formulario({
          ...CONTA,
          fornecedorId,
          clienteId,
          fornecedorTampaId: daTampaId,
          codigoTampa: "T-7",
        }),
      ),
    ).rejects.toBeInstanceOf(Redirecionou);

    expect(await itemDaProposta(proposta.id)).toMatchObject({
      fornecedorTampaId: daTampaId,
      fornecedorTampaNome: "SOROPLAST",
      codigoTampa: "T-7",
    });
  });
});

describe("excluir indústria", () => {
  it("a que só fornece tampa é recusada, dizendo por quê", async () => {
    const estado = await excluirFornecedor(daTampaId, {}, new FormData());

    expect(estado.erro).toMatch(/produto/);
    expect(await admin.fornecedor.count({ where: { id: daTampaId } })).toBe(1);
  });
});
