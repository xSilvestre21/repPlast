import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pedidosDaCompetencia, prepostoDoPedido } from "./comissao-consulta";
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
