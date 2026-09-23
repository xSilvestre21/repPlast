import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  canceladosDaCompetencia,
  pedidosDaCompetencia,
  prepostoDoPedido,
  resumirComissao,
} from "./comissao-consulta";
import { type Ator, dbAdministrativo, dbParaOrganizacao } from "./db";

const admin = dbAdministrativo();
const DONO: Ator = { usuarioId: "00000000-0000-0000-0000-000000000000", papel: "ADMIN" };

let org = "";
let prepostoId = "";

beforeAll(async () => {
  const o = await admin.organizacao.create({
    data: { nome: "Escritório da Comissão", plano: "PLUS" },
  });
  org = o.id;

  const preposto = await admin.usuario.create({
    data: {
      organizacaoId: org,
      nome: "Preposto de Teste",
      email: `preposto-${org}@exemplo.test`,
      senhaHash: "x",
      papel: "REPRESENTANTE",
    },
  });
  prepostoId = preposto.id;

  const cliente = await admin.cliente.create({
    data: { organizacaoId: org, apelido: "CLI", razaoSocial: "Cliente LTDA" },
  });

  const fornecedor = await admin.fornecedor.create({
    data: { organizacaoId: org, nome: "INDUSTRIA", comissaoPercentual: "5" },
  });

  const base = {
    organizacaoId: org,
    fornecedorId: fornecedor.id,
    clienteId: cliente.id,
    status: "ENVIADO" as const,
    prazoEntrega: new Date("2026-09-15T00:00:00.000Z"),
    subtotalSemIpi: "1000",
  };

  await admin.pedido.create({ data: { ...base, numero: 1, representanteId: prepostoId } });
  await admin.pedido.create({ data: { ...base, numero: 2 } });

  // O cancelado da mesma competência, com a mesma base dos outros dois: se ele
  // vazasse para a soma, o total saltaria de 2000 para 3000 e o teste acusaria.
  await admin.pedido.create({
    data: {
      ...base,
      numero: 3,
      status: "CANCELADO",
      canceladoEm: new Date(),
      motivoCancelamento: "Cliente desistiu da compra",
    },
  });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

describe("pedidosDaCompetencia resolve o preposto", () => {
  it("traz o representante do pedido que tem um, e null no pedido da casa", async () => {
    const db = dbParaOrganizacao(org, DONO);

    const pedidos = await pedidosDaCompetencia(db, org, "2026-09");

    expect(pedidos).toHaveLength(2);

    const comPreposto = pedidos.find((p) => p.numero === 1)!;
    const daCasa = pedidos.find((p) => p.numero === 2)!;

    expect(comPreposto.representante).toEqual({
      id: prepostoId,
      nome: "Preposto de Teste",
      papel: "REPRESENTANTE",
    });
    expect(prepostoDoPedido(comPreposto)?.nome).toBe("Preposto de Teste");

    expect(daCasa.representante).toBeNull();
    expect(prepostoDoPedido(daCasa)).toBeNull();
  });

  /*
   * A policy de `usuario` deixa o preposto ver só a própria linha. Como o
   * representante passou a vir de uma consulta à parte, é aqui que se confirma
   * que ele continua enxergando o próprio nome — e não um pedido órfão de dono.
   */
  it("o próprio preposto enxerga o representante do seu pedido", async () => {
    const db = dbParaOrganizacao(org, { usuarioId: prepostoId, papel: "REPRESENTANTE" });

    const pedidos = await pedidosDaCompetencia(db, org, "2026-09", prepostoId);

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].representante?.nome).toBe("Preposto de Teste");
  });
});

describe("o cancelado aparece, mas não soma", () => {
  it("fica FORA de `pedidosDaCompetencia`", async () => {
    const db = dbParaOrganizacao(org, DONO);
    const enviados = await pedidosDaCompetencia(db, org, "2026-09");

    // É esta consulta que alimenta a soma, os gráficos, o CSV e o painel.
    expect(enviados.map((p) => p.numero).sort()).toEqual([1, 2]);
  });

  it("a soma da competência ignora o cancelado", async () => {
    const db = dbParaOrganizacao(org, DONO);
    const total = resumirComissao(await pedidosDaCompetencia(db, org, "2026-09"));

    // Dois pedidos de R$ 1.000 a 5% — e não três. `Decimal`, por ser dinheiro.
    expect(total.base.toString()).toBe("2000");
    expect(total.valor.toString()).toBe("100");
  });

  it("mas aparece em `canceladosDaCompetencia`", async () => {
    const db = dbParaOrganizacao(org, DONO);
    const cancelados = await canceladosDaCompetencia(db, org, "2026-09");

    expect(cancelados.map((p) => p.numero)).toEqual([3]);
    expect(cancelados[0].status).toBe("CANCELADO");
  });

  it("traz o motivo junto — é o que explica a linha zerada", async () => {
    const db = dbParaOrganizacao(org, DONO);
    const [cancelado] = await canceladosDaCompetencia(db, org, "2026-09");

    expect(cancelado.motivoCancelamento).toBe("Cliente desistiu da compra");
  });

  it("cai na competência do pedido, não na do cancelamento", async () => {
    const db = dbParaOrganizacao(org, DONO);

    // Foi cancelado hoje, mas a entrega era de setembro de 2026 — é no mês
    // dele que ele tem de aparecer. "O que perdi neste mês" é outra pergunta,
    // e quem responde é o gráfico de cancelados, que filtra por `canceladoEm`.
    await expect(canceladosDaCompetencia(db, org, "2026-10")).resolves.toEqual([]);
  });
});
