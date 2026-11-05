/**
 * Teste de integração do filtro por preposto das listas.
 *
 * O que se protege: cada lista filtra pelo que a própria linha mostra — quem
 * atende o cliente; o preposto do pedido, e quem digitou só quando o pedido não
 * paga preposto; quem fez a proposta. O filtro soma com a busca e com o status
 * (em pedidos, os dois são `OR`, e um pode apagar o outro em silêncio). E o
 * preposto logado não enxerga a carteira do colega.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts filtro-preposto
 */

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { filtroDePreposto, opcoesDeCarteira } from "@/app/(app)/clientes/carteira";
import { buscarClientes } from "@/app/(app)/clientes/consulta";
import { buscarOrcamentos } from "@/app/(app)/orcamentos/consulta";
import { buscarPedidos } from "@/app/(app)/pedidos/consulta";

import { nomeDeTeste } from "../../test/nome-de-teste";
import { dbAdministrativo, dbParaOrganizacao } from "./db";

const admin = dbAdministrativo();

let org = "";
let donoId = "";
let anaId = "";
let brunoId = "";

beforeAll(async () => {
  org = (await admin.organizacao.create({ data: { nome: nomeDeTeste("Filtro por preposto"), plano: "PLUS" } })).id;

  const usuario = (nome: string, dados: { papel?: "REPRESENTANTE"; ativo?: boolean } = {}) =>
    admin.usuario.create({
      data: { organizacaoId: org, nome, email: `${nome}-${org}@teste.local`, senhaHash: "x", ...dados },
    });

  const [dono, ana, bruno, fornecedor] = await Promise.all([
    usuario("Dono"),
    usuario("Ana", { papel: "REPRESENTANTE" }),
    usuario("Bruno", { papel: "REPRESENTANTE" }),
    admin.fornecedor.create({ data: { organizacaoId: org, nome: "QUALYPLAST" } }),
    // Sem acesso: o histórico continua dele, e o filtro precisa alcançá-lo.
    usuario("Caio", { papel: "REPRESENTANTE", ativo: false }),
  ]);
  donoId = dono.id;
  anaId = ana.id;
  brunoId = bruno.id;

  const cliente = (apelido: string, ativo = true) =>
    admin.cliente.create({ data: { organizacaoId: org, apelido, razaoSocial: `${apelido} LTDA`, ativo } });

  const [soAna, soBruno, dosDois, deNinguem, paradoDaAna] = await Promise.all([
    cliente("SO ANA"),
    cliente("SO BRUNO"),
    cliente("DOS DOIS"),
    cliente("DE NINGUEM"),
    cliente("PARADO DA ANA", false),
  ]);

  await admin.clientePreposto.createMany({
    data: [
      { clienteId: soAna.id, usuarioId: anaId },
      { clienteId: dosDois.id, usuarioId: anaId },
      { clienteId: paradoDaAna.id, usuarioId: anaId },
      { clienteId: soBruno.id, usuarioId: brunoId },
      { clienteId: dosDois.id, usuarioId: brunoId },
    ],
  });

  const pedido = { organizacaoId: org, fornecedorId: fornecedor.id, clienteId: deNinguem.id };
  await admin.pedido.createMany({
    data: [
      { ...pedido, numero: 1, representanteId: anaId, pedidoDoCliente: "ALVO-1" },
      // Sem preposto na comissão: a linha mostra quem digitou.
      { ...pedido, numero: 2, criadoPorId: anaId },
      // Ana digitou, a comissão é do Bruno: a linha mostra o Bruno.
      { ...pedido, numero: 3, criadoPorId: anaId, representanteId: brunoId, pedidoDoCliente: "ALVO-3" },
      { ...pedido, numero: 4 },
      { ...pedido, numero: 5, representanteId: anaId, status: "CANCELADO" },
    ],
  });

  const orcamento = { organizacaoId: org, fornecedorId: fornecedor.id };
  await admin.orcamento.createMany({
    data: [
      { ...orcamento, numero: 1, criadoPorId: anaId, clienteAvulsoNome: "Proposta Alfa" },
      // O escritório montou para um cliente da Ana: é do escritório.
      { ...orcamento, numero: 2, criadoPorId: donoId, representanteId: anaId, clienteAvulsoNome: "Proposta Gama" },
      { ...orcamento, numero: 3, criadoPorId: brunoId, clienteAvulsoNome: "Proposta Beta" },
    ],
  });
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: org } });
});

const comoDono = () => dbParaOrganizacao(org, { usuarioId: donoId, papel: "ADMIN" });
const comoBruno = () => dbParaOrganizacao(org, { usuarioId: brunoId, papel: "REPRESENTANTE" });
const numeros = (fatia: { linhas: { numero: number }[] }) => fatia.linhas.map((l) => l.numero).sort();

describe("clientes do preposto", () => {
  const buscar = (filtro: { busca?: string; situacao?: "ativos" | "inativos" | "todos"; preposto?: string }) =>
    buscarClientes(comoDono(), org, { busca: "", situacao: "ativos", pagina: 0, ...filtro });
  const apelidos = async (filtro: Parameters<typeof buscar>[0]) =>
    (await buscar(filtro)).linhas.map((l) => l.apelido);

  it("traz quem ele atende, inclusive o cliente dividido com outro preposto", async () => {
    const fatia = await buscar({ preposto: anaId });

    expect(fatia.linhas.map((l) => l.apelido)).toEqual(["DOS DOIS", "SO ANA"]);
    expect(fatia.quantos).toBe(2);
    expect(await apelidos({ preposto: brunoId })).toEqual(["DOS DOIS", "SO BRUNO"]);
  });

  it("sem preposto escolhido, a lista continua a de todos", async () => {
    expect(await apelidos({})).toEqual(["DE NINGUEM", "DOS DOIS", "SO ANA", "SO BRUNO"]);
    expect(await apelidos({ preposto: "" })).toEqual(["DE NINGUEM", "DOS DOIS", "SO ANA", "SO BRUNO"]);
  });

  it("soma com a situação e com a busca", async () => {
    expect(await apelidos({ preposto: anaId, situacao: "inativos" })).toEqual(["PARADO DA ANA"]);
    expect(await apelidos({ preposto: anaId, situacao: "todos" })).toEqual(["DOS DOIS", "PARADO DA ANA", "SO ANA"]);
    expect(await apelidos({ preposto: anaId, busca: "dois" })).toEqual(["DOS DOIS"]);
    expect(await apelidos({ preposto: anaId, busca: "bruno" })).toEqual([]);
  });

  it("logado como preposto, filtrar pelo colega não revela a carteira dele", async () => {
    const buscarComoBruno = (preposto?: string) =>
      buscarClientes(comoBruno(), org, { busca: "", situacao: "todos", preposto, pagina: 0 });

    // "DE NINGUEM" é a exceção de leitura do RLS: o cliente de um pedido que ele vê.
    expect((await buscarComoBruno()).linhas.map((l) => l.apelido)).toEqual([
      "DE NINGUEM",
      "DOS DOIS",
      "SO BRUNO",
    ]);
    // "DOS DOIS" também é da Ana, mas o vínculo dela não existe para o Bruno.
    expect((await buscarComoBruno(anaId)).linhas).toEqual([]);
  });
});

describe("pedidos do preposto", () => {
  const buscar = (filtro: { busca?: string; status?: "todos" | "aberto" | "cancelado"; preposto: string }) =>
    buscarPedidos(comoDono(), org, true, { busca: "", status: "todos", pagina: 0, ...filtro });

  it("filtra por quem a linha mostra: o da comissão, ou quem digitou se não houver", async () => {
    const daAna = await buscar({ preposto: anaId });

    expect(numeros(daAna)).toEqual([1, 2, 5]);
    expect(daAna.quantos).toBe(3);
    expect(daAna.linhas.every((l) => l.preposto?.nome === "Ana")).toBe(true);

    const doBruno = await buscar({ preposto: brunoId });

    expect(numeros(doBruno)).toEqual([3]);
    expect(doBruno.linhas[0].preposto?.nome).toBe("Bruno");
  });

  it("soma com o status", async () => {
    expect(numeros(await buscar({ preposto: anaId, status: "aberto" }))).toEqual([1, 2]);
    expect(numeros(await buscar({ preposto: anaId, status: "cancelado" }))).toEqual([5]);
  });

  it("soma com a busca, nos dois sentidos", async () => {
    // Se a busca apagasse o filtro, o ALVO-3 (do Bruno) viria para a Ana. Se o
    // filtro apagasse a busca, viriam todos os dela.
    expect(numeros(await buscar({ preposto: anaId, busca: "ALVO-1" }))).toEqual([1]);
    expect(numeros(await buscar({ preposto: anaId, busca: "ALVO-3" }))).toEqual([]);
  });
});

describe("orçamentos do preposto", () => {
  const buscar = (preposto: string, busca = "") =>
    buscarOrcamentos(comoDono(), org, true, { busca, status: "todos", preposto, pagina: 0 });

  it("filtra por quem fez, e não pelo dono da carteira", async () => {
    const daAna = await buscar(anaId);

    expect(numeros(daAna)).toEqual([1]);
    expect(daAna.quantos).toBe(1);
    expect(daAna.linhas[0].preposto?.nome).toBe("Ana");
    expect(numeros(await buscar(brunoId))).toEqual([3]);
  });

  it("soma com a busca", async () => {
    expect(numeros(await buscar(anaId, "Alfa"))).toEqual([1]);
    expect(numeros(await buscar(anaId, "Beta"))).toEqual([]);
  });
});

describe("as opções do filtro", () => {
  const escopo = (dados: { ehAdmin?: boolean; plano?: string } = {}) => ({
    db: comoDono(),
    organizacaoId: org,
    ehAdmin: true,
    plano: "PLUS",
    ...dados,
  });

  it("incluem quem está sem acesso, em ordem de nome", async () => {
    const { prepostos } = await filtroDePreposto(escopo(), undefined);

    expect(prepostos.map((p) => p.nome)).toEqual(["Ana", "Bruno", "Caio (sem acesso)"]);
  });

  it("o campo do cadastro continua sem quem está sem acesso", async () => {
    const opcoes = await opcoesDeCarteira(escopo());

    expect(opcoes?.map((p) => p.nome)).toEqual(["Ana", "Bruno"]);
  });

  it("escolhem só entre as opções", async () => {
    expect((await filtroDePreposto(escopo(), anaId)).preposto).toBe(anaId);
    // Texto solto na URL, preposto de outro escritório, lista no lugar de texto.
    expect((await filtroDePreposto(escopo(), "abc")).preposto).toBe("");
    expect((await filtroDePreposto(escopo(), randomUUID())).preposto).toBe("");
    expect((await filtroDePreposto(escopo(), [anaId])).preposto).toBe("");
  });

  it("não existem para o preposto nem fora do Plus", async () => {
    const vazio = { prepostos: [], preposto: "" };

    expect(await filtroDePreposto(escopo({ ehAdmin: false }), anaId)).toEqual(vazio);
    expect(await filtroDePreposto(escopo({ plano: "PADRAO" }), anaId)).toEqual(vazio);
  });
});
