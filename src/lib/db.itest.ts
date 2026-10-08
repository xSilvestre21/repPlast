/**
 * Teste de integração do isolamento multi-tenant.
 *
 * Não testa a aplicação: testa o BANCO. A pergunta que ele responde é
 * "se uma query esquecer o filtro de escritório, o Postgres protege?".
 * Enquanto este teste passar, é seguro vender o sistema a vários escritórios.
 *
 * Exige o banco de desenvolvimento rodando:  npx prisma dev --name repplast
 * Rode com:  npm run test:db
 */

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Ator, dbAdministrativo, dbParaOrganizacao } from "./db";
import { soIndustriasMarcadas } from "./industrias-do-ator";

/**
 * No PostgreSQL, superusuário (e qualquer papel com BYPASSRLS) ignora as
 * policies, inclusive com FORCE ROW LEVEL SECURITY. Se a aplicação rodar assim,
 * estes testes passariam a medir nada.
 *
 * O papel que importa não é o da connection string — é o papel EFETIVO, depois
 * do `SET LOCAL ROLE` que `dbParaOrganizacao` aplica (APP_DB_ROLE). Sem um papel
 * restrito disponível, o isolamento não pode ser verificado neste ambiente e os
 * testes se pulam com aviso, em vez de reportar falha que não é do código.
 */
async function papelIgnoraRls() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const papelApp = process.env.APP_DB_ROLE?.trim();

    const { rows } = await client.query(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles
       WHERE rolname = COALESCE($1, current_user)`,
      [papelApp || null],
    );

    const papel = rows[0];

    if (!papel) {
      console.warn(`\n[isolamento] Papel "${papelApp}" não existe neste banco.\n`);
      return true;
    }

    if (papel.rolsuper || papel.rolbypassrls) {
      console.warn(
        `\n[isolamento] O papel efetivo "${papel.rolname}" ignora RLS ` +
          `(superuser=${papel.rolsuper}, bypassrls=${papel.rolbypassrls}).\n` +
          `[isolamento] Defina APP_DB_ROLE com um papel restrito e rode: npm run db:setup\n`,
      );
      return true;
    }

    return false;
  } finally {
    await client.end();
  }
}

const ignoraRls = await papelIgnoraRls();

const admin = dbAdministrativo();

/** Ator genérico: quem só mede o isolamento ENTRE escritórios entra como dono. */
const DONO: Ator = { usuarioId: "00000000-0000-0000-0000-000000000000", papel: "ADMIN" };

let orgA = "";
let orgB = "";
let clienteDeB = "";

beforeAll(async () => {
  const a = await admin.organizacao.create({ data: { nome: "Escritório A" } });
  const b = await admin.organizacao.create({ data: { nome: "Escritório B" } });
  orgA = a.id;
  orgB = b.id;

  await admin.cliente.create({
    data: { organizacaoId: orgA, apelido: "CLIENTE-A", razaoSocial: "Cliente da A LTDA" },
  });

  const cb = await admin.cliente.create({
    data: { organizacaoId: orgB, apelido: "CLIENTE-B", razaoSocial: "Cliente da B LTDA" },
  });
  clienteDeB = cb.id;
});

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: { in: [orgA, orgB] } } });
});

describe.skipIf(ignoraRls)("isolamento entre escritórios", () => {
  it("uma listagem sem filtro só enxerga o próprio escritório", async () => {
    const db = dbParaOrganizacao(orgA, DONO);

    // Repare: nenhum `where` de organização. Quem filtra é o Postgres.
    const clientes = await db.cliente.findMany();

    expect(clientes).toHaveLength(1);
    expect(clientes[0].apelido).toBe("CLIENTE-A");
  });

  it("buscar pelo id de um cliente de outro escritório não devolve nada", async () => {
    const db = dbParaOrganizacao(orgA, DONO);

    const alheio = await db.cliente.findUnique({ where: { id: clienteDeB } });

    expect(alheio).toBeNull();
  });

  it("não deixa gravar registro carimbado com outro escritório", async () => {
    const db = dbParaOrganizacao(orgA, DONO);

    await expect(
      db.cliente.create({
        data: { organizacaoId: orgB, apelido: "INVASOR", razaoSocial: "Invasor LTDA" },
      }),
    ).rejects.toThrow();
  });

  it("não deixa alterar registro de outro escritório", async () => {
    const db = dbParaOrganizacao(orgA, DONO);

    const alterados = await db.cliente.updateMany({
      where: { id: clienteDeB },
      data: { apelido: "SEQUESTRADO" },
    });

    expect(alterados.count).toBe(0);

    const intacto = await admin.cliente.findUnique({ where: { id: clienteDeB } });
    expect(intacto?.apelido).toBe("CLIENTE-B");
  });

  it("cada escritório enxerga a própria organização, e só ela", async () => {
    const organizacoes = await dbParaOrganizacao(orgA, DONO).organizacao.findMany();

    expect(organizacoes).toHaveLength(1);
    expect(organizacoes[0].id).toBe(orgA);
  });
});

/**
 * A segunda dimensão do isolamento.
 *
 * O teste acima responde "um escritório vê o outro?". Este responde a pergunta
 * que o plano Plus criou: DENTRO do mesmo escritório, um preposto vê a carteira
 * do outro? A resposta tem de vir do banco, não da aplicação — é o que permite
 * dar acesso a gente que não é o dono da operação.
 */
describe.skipIf(ignoraRls)("isolamento entre prepostos do mesmo escritório", () => {
  let escritorio = "";
  let dono: Ator;
  let ana: Ator;
  let bruno: Ator;
  let clienteDaAna = "";
  let clienteDoBruno = "";
  let pedidoDaAna = "";

  beforeAll(async () => {
    const org = await admin.organizacao.create({
      data: { nome: "Escritório Plus", plano: "PLUS" },
    });
    escritorio = org.id;

    const criarUsuario = async (nome: string, papel: "ADMIN" | "REPRESENTANTE") => {
      const u = await admin.usuario.create({
        data: {
          organizacaoId: escritorio,
          nome,
          email: `${nome.toLowerCase()}-${escritorio}@teste.local`,
          senhaHash: "x",
          papel,
        },
      });
      return { usuarioId: u.id, papel } satisfies Ator;
    };

    dono = await criarUsuario("Dono", "ADMIN");
    ana = await criarUsuario("Ana", "REPRESENTANTE");
    bruno = await criarUsuario("Bruno", "REPRESENTANTE");

    // Quem atende o cliente é a tabela `cliente_preposto`; nenhum é do escritório.
    const criarCliente = async (apelido: string, prepostoId: string | null) => {
      const c = await admin.cliente.create({
        data: {
          organizacaoId: escritorio,
          apelido,
          razaoSocial: `${apelido} LTDA`,
          ...(prepostoId ? { prepostos: { create: { usuarioId: prepostoId } } } : {}),
        },
      });
      return c.id;
    };

    clienteDaAna = await criarCliente("DA-ANA", ana.usuarioId);
    clienteDoBruno = await criarCliente("DO-BRUNO", bruno.usuarioId);
    // Sem dono: é do escritório, e aparece para todo mundo.
    await criarCliente("DA-CASA", null);

    const fornecedor = await admin.fornecedor.create({
      data: { organizacaoId: escritorio, nome: "Indústria Plus" },
    });
    // Os dois trabalham com ela: o preposto só vê a indústria marcada para ele.
    await admin.fornecedorPreposto.createMany({
      data: [ana, bruno].map((a) => ({ fornecedorId: fornecedor.id, usuarioId: a.usuarioId })),
    });

    const p = await admin.pedido.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId: fornecedor.id,
        clienteId: clienteDaAna,
        numero: 1,
        representanteId: ana.usuarioId,
      },
    });
    pedidoDaAna = p.id;
  });

  afterAll(async () => {
    await admin.organizacao.deleteMany({ where: { id: escritorio } });
  });

  it("o preposto vê só a própria carteira — nem a do escritório, nem a do colega", async () => {
    const apelidos = (
      await dbParaOrganizacao(escritorio, ana).cliente.findMany({ orderBy: { apelido: "asc" } })
    ).map((c) => c.apelido);

    expect(apelidos).toEqual(["DA-ANA"]);
  });

  it("o administrador vê a carteira inteira", async () => {
    const apelidos = (
      await dbParaOrganizacao(escritorio, dono).cliente.findMany({ orderBy: { apelido: "asc" } })
    ).map((c) => c.apelido);

    expect(apelidos).toEqual(["DA-ANA", "DA-CASA", "DO-BRUNO"]);
  });

  it("buscar pelo id do cliente do colega não devolve nada", async () => {
    const db = dbParaOrganizacao(escritorio, ana);

    expect(await db.cliente.findUnique({ where: { id: clienteDoBruno } })).toBeNull();
  });

  it("não deixa alterar o cliente do colega", async () => {
    const { count } = await dbParaOrganizacao(escritorio, ana).cliente.updateMany({
      where: { id: clienteDoBruno },
      data: { apelido: "SEQUESTRADO" },
    });

    expect(count).toBe(0);

    const intacto = await admin.cliente.findUnique({ where: { id: clienteDoBruno } });
    expect(intacto?.apelido).toBe("DO-BRUNO");
  });

  it("não deixa cadastrar cliente em nome do colega", async () => {
    await expect(
      dbParaOrganizacao(escritorio, ana).cliente.createMany({
        data: [
          {
            organizacaoId: escritorio,
            apelido: "INVASOR",
            razaoSocial: "Invasor LTDA",
            criadoPorId: bruno.usuarioId,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  /*
   * Cadastro é do escritório: o preposto consulta cliente, produto e indústria,
   * e lança pedido em cima deles, mas não cria, altera nem exclui. A única
   * coisa que ele move na indústria é o contador de número de pedido — é ele
   * lançando pedido que o empurra.
   */
  it("cadastro é só do administrador — o preposto só move o contador da indústria", async () => {
    const comoAna = dbParaOrganizacao(escritorio, ana);
    const industria = await admin.fornecedor.findFirstOrThrow({
      where: { organizacaoId: escritorio },
      select: { id: true, nome: true, proximoNumeroPedido: true },
    });

    // Cliente: nem cadastrar em nome próprio, nem se vincular, nem alterar o
    // que ela atende, nem inativar.
    await expect(
      comoAna.cliente.createMany({
        data: [{ organizacaoId: escritorio, apelido: "NOVO", razaoSocial: "Novo LTDA", criadoPorId: ana.usuarioId }],
      }),
    ).rejects.toThrow();
    const casa = await admin.cliente.findFirstOrThrow({
      where: { organizacaoId: escritorio, apelido: "DA-CASA" },
    });
    await expect(
      comoAna.clientePreposto.create({ data: { clienteId: casa.id, usuarioId: ana.usuarioId } }),
    ).rejects.toThrow();
    for (const data of [{ apelido: "EDITADO" }, { ativo: false }]) {
      const { count } = await comoAna.cliente.updateMany({ where: { id: clienteDaAna }, data });
      expect(count).toBe(0);
    }
    expect((await comoAna.cliente.deleteMany({ where: { id: clienteDaAna } })).count).toBe(0);
    expect((await admin.cliente.findUniqueOrThrow({ where: { id: clienteDaAna } })).apelido).toBe(
      "DA-ANA",
    );

    // Produto, nem para o cliente que ela atende.
    await expect(
      comoAna.produto.create({
        data: {
          organizacaoId: escritorio,
          fornecedorId: industria.id,
          clienteId: clienteDaAna,
          familia: "STRETCH",
          descricao: "dela",
          precoKg: "10",
        },
      }),
    ).rejects.toThrow();
    const produto = await admin.produto.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId: industria.id,
        clienteId: clienteDaAna,
        familia: "STRETCH",
        descricao: "do escritório",
        precoKg: "10",
      },
    });
    expect(
      (await comoAna.produto.updateMany({ where: { id: produto.id }, data: { precoKg: "1" } }))
        .count,
    ).toBe(0);

    // Indústria: nem cadastrar, nem mexer no cadastro, nem marcar-se em outra,
    // nem lançar contato ou aditivo.
    await expect(
      comoAna.fornecedor.create({ data: { organizacaoId: escritorio, nome: "Dela" } }),
    ).rejects.toThrow();
    await expect(
      comoAna.fornecedor.update({ where: { id: industria.id }, data: { comissaoPercentual: "99" } }),
    ).rejects.toThrow();
    await expect(
      comoAna.contatoFornecedor.create({
        data: { fornecedorId: industria.id, email: "x@industria.test", ordem: 0 },
      }),
    ).rejects.toThrow();
    await expect(
      comoAna.aditivo.create({
        data: { fornecedorId: industria.id, nome: "UV", sufixoDescricao: "UV", tipo: "POR_KG", valor: "5" },
      }),
    ).rejects.toThrow();

    // O contador, sim: é o que lançar pedido faz.
    const contador = await comoAna.fornecedor.update({
      where: { id: industria.id },
      data: { proximoNumeroPedido: { increment: 1 } },
      select: { proximoNumeroPedido: true },
    });
    expect(contador.proximoNumeroPedido).toBe(industria.proximoNumeroPedido + 1);

    // E o administrador faz tudo isso.
    const comoDono = dbParaOrganizacao(escritorio, dono);
    await comoDono.fornecedor.update({ where: { id: industria.id }, data: { telefone: "1" } });
    await comoDono.produto.update({ where: { id: produto.id }, data: { precoKg: "11" } });

    await admin.produto.delete({ where: { id: produto.id } });
    await admin.fornecedor.update({
      where: { id: industria.id },
      data: { proximoNumeroPedido: industria.proximoNumeroPedido, telefone: null },
    });
  });

  it("um cliente pode ser atendido por mais de um preposto", async () => {
    const id = (
      await admin.cliente.create({
        data: {
          organizacaoId: escritorio,
          apelido: "DOS-DOIS",
          razaoSocial: "Dos Dois LTDA",
          prepostos: { create: [{ usuarioId: ana.usuarioId }, { usuarioId: bruno.usuarioId }] },
        },
      })
    ).id;

    for (const ator of [ana, bruno]) {
      expect(await dbParaOrganizacao(escritorio, ator).cliente.findUnique({ where: { id } })).not.toBeNull();
    }
    // Cada um lê só o próprio vínculo; quem mais atende é assunto do escritório.
    expect(
      await dbParaOrganizacao(escritorio, ana).clientePreposto.findMany({ where: { clienteId: id } }),
    ).toHaveLength(1);
    expect(
      await dbParaOrganizacao(escritorio, dono).clientePreposto.findMany({ where: { clienteId: id } }),
    ).toHaveLength(2);

    await admin.cliente.delete({ where: { id } });
  });

  it("o pedido segue o mesmo corte", async () => {
    expect(await dbParaOrganizacao(escritorio, bruno).pedido.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, ana).pedido.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, dono).pedido.findMany()).toHaveLength(1);
  });

  it("o item do pedido herda o corte do pedido", async () => {
    await admin.pedidoItem.create({
      data: {
        pedidoId: pedidoDaAna,
        ordem: 1,
        familia: "SACO",
        descricao: "item da ana",
        unidade: "MIL",
        quantidade: "1",
        precoUnitario: "1",
        totalSemIpi: "1",
        valorIpi: "0",
        total: "1",
      },
    });

    expect(await dbParaOrganizacao(escritorio, bruno).pedidoItem.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, ana).pedidoItem.findMany()).toHaveLength(1);
  });

  it("o histórico de envios herda o corte do pedido", async () => {
    await admin.envioPedido.create({
      data: {
        pedidoId: pedidoDaAna,
        usuarioId: ana.usuarioId,
        de: "ana@teste.local",
        para: ["pcp@industria.local"],
        assunto: "Pedido 1",
        corpo: "",
      },
    });

    expect(await dbParaOrganizacao(escritorio, bruno).envioPedido.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, ana).envioPedido.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, dono).envioPedido.findMany()).toHaveLength(1);
  });

  it("as parcelas do recebimento herdam o corte do pedido", async () => {
    await admin.parcelaRecebimento.create({
      data: {
        pedidoId: pedidoDaAna,
        numero: 1,
        vencimento: new Date("2026-10-10T00:00:00Z"),
        base: "100",
      },
    });

    expect(await dbParaOrganizacao(escritorio, bruno).parcelaRecebimento.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, ana).parcelaRecebimento.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, dono).parcelaRecebimento.findMany()).toHaveLength(1);

    // Nem lançar acerto, nem parcelar o pedido do colega.
    const { count } = await dbParaOrganizacao(escritorio, bruno).parcelaRecebimento.updateMany({
      data: { valorRecebido: "1", comissaoPercentualRecebido: "1" },
    });
    expect(count).toBe(0);

    await expect(
      dbParaOrganizacao(escritorio, bruno).parcelaRecebimento.create({
        data: {
          pedidoId: pedidoDaAna,
          numero: 2,
          vencimento: new Date("2026-10-30T00:00:00Z"),
          base: "1",
        },
      }),
    ).rejects.toThrow();
  });

  /*
   * A comissão do preposto é de leitura: o pedido é dele, mas o acerto (o que
   * a indústria pagou, a entrega, as parcelas) é do escritório.
   */
  it("o preposto lê o acerto do próprio pedido, mas não o lança", async () => {
    const comoAna = dbParaOrganizacao(escritorio, ana);

    expect(await comoAna.parcelaRecebimento.findMany({ where: { pedidoId: pedidoDaAna } })).toHaveLength(1);

    await expect(
      comoAna.pedido.update({ where: { id: pedidoDaAna }, data: { valorRecebido: "10" } }),
    ).rejects.toThrow();
    await expect(
      comoAna.pedido.update({
        where: { id: pedidoDaAna },
        data: { entregueEm: new Date("2026-10-05T00:00:00Z") },
      }),
    ).rejects.toThrow();
    const { count } = await comoAna.parcelaRecebimento.updateMany({
      where: { pedidoId: pedidoDaAna },
      data: { valorRecebido: "1" },
    });
    expect(count).toBe(0);

    // O resto do pedido continua dela para editar.
    await comoAna.pedido.update({ where: { id: pedidoDaAna }, data: { transportadora: "TESTE" } });

    // E o administrador acerta normalmente.
    await dbParaOrganizacao(escritorio, dono).pedido.update({
      where: { id: pedidoDaAna },
      data: { valorRecebido: "10" },
    });
    await admin.pedido.update({ where: { id: pedidoDaAna }, data: { valorRecebido: null, transportadora: null } });
  });

  it("o histórico de envios da proposta herda o corte do orçamento", async () => {
    const { fornecedorId } = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoDaAna } });
    const proposta = await admin.orcamento.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId,
        clienteId: clienteDaAna,
        numero: 1,
        representanteId: ana.usuarioId,
        criadoPorId: ana.usuarioId,
      },
    });
    await admin.envioOrcamento.create({
      data: {
        orcamentoId: proposta.id,
        usuarioId: ana.usuarioId,
        de: "ana@teste.local",
        para: ["compras@cliente.local"],
        assunto: "Proposta 1",
        corpo: "",
      },
    });

    expect(await dbParaOrganizacao(escritorio, bruno).envioOrcamento.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, ana).envioOrcamento.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, dono).envioOrcamento.findMany()).toHaveLength(1);
  });

  it("o histórico de edições herda o corte do pedido", async () => {
    await admin.pedidoEdicao.create({ data: { pedidoId: pedidoDaAna, usuarioId: ana.usuarioId } });

    expect(await dbParaOrganizacao(escritorio, bruno).pedidoEdicao.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, ana).pedidoEdicao.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, dono).pedidoEdicao.findMany()).toHaveLength(1);
  });

  /*
   * O preposto vê o pedido que digitou e o que lhe paga comissão — e não o do
   * escritório. A proposta, só a que ele digitou: a que o escritório monta para
   * um cliente dele não aparece.
   */
  it("pedido: o que ele digitou e o que lhe paga, nunca o do escritório", async () => {
    const { fornecedorId } = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoDaAna } });
    const casa = await admin.cliente.findFirstOrThrow({
      where: { organizacaoId: escritorio, apelido: "DA-CASA" },
    });
    const criar = (
      numero: number,
      dados: { representanteId?: string; criadoPorId?: string; clienteId: string },
    ) => admin.pedido.create({ data: { organizacaoId: escritorio, fornecedorId, numero, ...dados } });

    const doEscritorio = await criar(101, { clienteId: casa.id });
    const digitadoPelaAna = await criar(102, { clienteId: clienteDaAna, criadoPorId: ana.usuarioId });

    const daAna = (await dbParaOrganizacao(escritorio, ana).pedido.findMany()).map((p) => p.id);
    // `pedidoDaAna` paga a Ana: lançado para a carteira dela, sem autor.
    expect(daAna.sort()).toEqual([pedidoDaAna, digitadoPelaAna.id].sort());
    expect(await dbParaOrganizacao(escritorio, bruno).pedido.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, dono).pedido.findMany()).toHaveLength(3);

    await admin.pedido.deleteMany({ where: { id: { in: [doEscritorio.id, digitadoPelaAna.id] } } });
  });

  it("orçamento: só o que ele digitou", async () => {
    const { fornecedorId } = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoDaAna } });
    const criar = (numero: number, criadoPorId: string) =>
      admin.orcamento.create({
        data: {
          organizacaoId: escritorio,
          fornecedorId,
          clienteId: clienteDaAna,
          numero,
          representanteId: ana.usuarioId,
          criadoPorId,
        },
      });

    const doEscritorioParaAna = await criar(201, dono.usuarioId);
    const daAna = await criar(202, ana.usuarioId);

    const vistos = (await dbParaOrganizacao(escritorio, ana).orcamento.findMany()).map((o) => o.id);
    expect(vistos).toContain(daAna.id);
    expect(vistos).not.toContain(doEscritorioParaAna.id);

    // O item segue o orçamento.
    await admin.orcamentoItem.create({
      data: {
        orcamentoId: doEscritorioParaAna.id,
        ordem: 1,
        familia: "SACO",
        descricao: "item do escritório",
        unidade: "MIL",
        quantidade: "1",
        precoUnitario: "1",
        totalSemIpi: "1",
        valorIpi: "0",
        total: "1",
      },
    });
    expect(
      await dbParaOrganizacao(escritorio, ana).orcamentoItem.findMany({
        where: { orcamentoId: doEscritorioParaAna.id },
      }),
    ).toHaveLength(0);

    await admin.orcamento.deleteMany({ where: { id: { in: [doEscritorioParaAna.id, daAna.id] } } });
  });

  it("ninguém cria pedido ou orçamento em nome de outro", async () => {
    const { fornecedorId } = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoDaAna } });
    const comoAna = dbParaOrganizacao(escritorio, ana);

    await expect(
      comoAna.pedido.create({
        data: {
          organizacaoId: escritorio,
          fornecedorId,
          clienteId: clienteDaAna,
          numero: 301,
          representanteId: ana.usuarioId,
          criadoPorId: dono.usuarioId,
        },
      }),
    ).rejects.toThrow();
    await expect(
      comoAna.orcamento.create({
        data: { organizacaoId: escritorio, fornecedorId, numero: 301, criadoPorId: bruno.usuarioId },
      }),
    ).rejects.toThrow();
  });

  /*
   * O cliente que mudou de carteira continua com nome no pedido antigo de quem
   * o digitou — mas o cadastro já não é dele para alterar.
   */
  it("cliente de pedido que ele vê continua legível, mas não alterável", async () => {
    const { fornecedorId } = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoDaAna } });
    const cliente = await admin.cliente.create({
      data: {
        organizacaoId: escritorio,
        apelido: "MUDOU",
        razaoSocial: "Mudou LTDA",
        prepostos: { create: { usuarioId: ana.usuarioId } },
      },
    });
    const pedido = await admin.pedido.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId,
        clienteId: cliente.id,
        numero: 401,
        representanteId: ana.usuarioId,
        criadoPorId: ana.usuarioId,
      },
    });
    // Passa da Ana para o Bruno.
    await admin.clientePreposto.deleteMany({ where: { clienteId: cliente.id } });
    await admin.clientePreposto.create({ data: { clienteId: cliente.id, usuarioId: bruno.usuarioId } });

    const comoAna = dbParaOrganizacao(escritorio, ana);
    const lido = await comoAna.pedido.findUniqueOrThrow({
      where: { id: pedido.id },
      select: { cliente: { select: { apelido: true } } },
    });
    expect(lido.cliente?.apelido).toBe("MUDOU");

    // Ler pela exceção não deixa editar o cadastro.
    const { count } = await comoAna.cliente.updateMany({
      where: { id: cliente.id },
      data: { apelido: "EDITADO" },
    });
    expect(count).toBe(0);

    await admin.pedido.delete({ where: { id: pedido.id } });
    await admin.cliente.delete({ where: { id: cliente.id } });
  });

  /*
   * A única tabela em que o administrador NÃO vê tudo: a caixa de e-mail é da
   * pessoa, e mandar por ela é falar em nome dela.
   */
  it("a caixa de e-mail só existe para a própria dona — nem o administrador a vê", async () => {
    await dbParaOrganizacao(escritorio, ana).contaEmail.create({
      data: {
        organizacaoId: escritorio,
        usuarioId: ana.usuarioId,
        provedor: "GMAIL",
        email: "ana@gmail.com",
        nomeExibicao: "Ana",
        host: "smtp.gmail.com",
        porta: 465,
        tlsDireto: true,
        usuarioSmtp: "ana@gmail.com",
        senhaCifrada: "v1:x:x:x",
      },
    });

    expect(await dbParaOrganizacao(escritorio, ana).contaEmail.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, bruno).contaEmail.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, dono).contaEmail.findMany()).toHaveLength(0);

    const { count } = await dbParaOrganizacao(escritorio, dono).contaEmail.updateMany({
      data: { host: "smtp.sequestro.local" },
    });
    expect(count).toBe(0);
  });

  it("não deixa cadastrar caixa de e-mail em nome do colega", async () => {
    await expect(
      dbParaOrganizacao(escritorio, bruno).contaEmail.create({
        data: {
          organizacaoId: escritorio,
          usuarioId: ana.usuarioId,
          provedor: "OUTRO",
          email: "falsa@teste.local",
          nomeExibicao: "Ana",
          host: "smtp.teste.local",
          porta: 587,
          tlsDireto: false,
          usuarioSmtp: "falsa@teste.local",
          senhaCifrada: "v1:x:x:x",
        },
      }),
    ).rejects.toThrow();
  });

  /*
   * Mesmo corte da caixa de e-mail: a meta é o objetivo pessoal de cada um, e
   * o dono mede a dele contra a comissão do escritório — a do preposto não é
   * assunto dele, nem para ler, nem para trocar.
   */
  it("a meta só existe para a própria dona — nem o administrador a vê", async () => {
    await dbParaOrganizacao(escritorio, ana).metaComissao.create({
      data: { organizacaoId: escritorio, usuarioId: ana.usuarioId, competencia: "2026-10", valor: "1000" },
    });

    expect(await dbParaOrganizacao(escritorio, ana).metaComissao.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, bruno).metaComissao.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(escritorio, dono).metaComissao.findMany()).toHaveLength(0);

    const { count } = await dbParaOrganizacao(escritorio, dono).metaComissao.updateMany({
      data: { valor: "1" },
    });
    expect(count).toBe(0);
  });

  it("não deixa definir meta em nome do colega", async () => {
    await expect(
      dbParaOrganizacao(escritorio, bruno).metaComissao.create({
        data: { organizacaoId: escritorio, usuarioId: ana.usuarioId, competencia: "2026-11", valor: "1" },
      }),
    ).rejects.toThrow();
  });

  /*
   * O repasse é o pagamento do escritório ao preposto: o administrador vê e
   * lança todos, o preposto só LÊ os próprios — e não lança nem o dele, porque
   * um "recebi" lançado por ele apagaria a própria dívida.
   */
  it("o repasse aparece para o administrador e para o próprio preposto, não para o colega", async () => {
    await dbParaOrganizacao(escritorio, dono).repassePreposto.create({
      data: {
        organizacaoId: escritorio,
        prepostoId: ana.usuarioId,
        competencia: "2026-09",
        valor: "150",
        pagoEm: new Date("2026-10-05T00:00:00.000Z"),
      },
    });

    expect(await dbParaOrganizacao(escritorio, dono).repassePreposto.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, ana).repassePreposto.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, bruno).repassePreposto.findMany()).toHaveLength(0);
    expect(await dbParaOrganizacao(orgA, DONO).repassePreposto.findMany()).toHaveLength(0);
  });

  it("o preposto não lança nem altera repasse, nem o próprio", async () => {
    await expect(
      dbParaOrganizacao(escritorio, ana).repassePreposto.create({
        data: {
          organizacaoId: escritorio,
          prepostoId: ana.usuarioId,
          competencia: "2026-09",
          valor: "1000",
          pagoEm: new Date("2026-10-05T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();

    // Vê a linha, mas para escrever ela não existe: nada muda, nada some.
    const alterados = await dbParaOrganizacao(escritorio, ana).repassePreposto.updateMany({
      data: { valor: "1" },
    });
    expect(alterados.count).toBe(0);

    const apagados = await dbParaOrganizacao(escritorio, ana).repassePreposto.deleteMany();
    expect(apagados.count).toBe(0);

    const [repasse] = await dbParaOrganizacao(escritorio, dono).repassePreposto.findMany();
    expect(repasse.valor.toString()).toBe("150");
  });

  /*
   * O compromisso é de quem marcou: o pessoal ninguém mais vê — nem o
   * administrador —, o compartilhado o escritório inteiro lê, e só o autor
   * altera ou apaga, mesmo o compartilhado.
   */
  it("compromisso pessoal só para o autor; compartilhado para o escritório", async () => {
    const dia = new Date("2026-10-20T00:00:00.000Z");
    const ana$ = dbParaOrganizacao(escritorio, ana);

    await ana$.compromisso.create({
      data: { organizacaoId: escritorio, autorId: ana.usuarioId, titulo: "Pessoal da Ana", data: dia },
    });
    await ana$.compromisso.create({
      data: {
        organizacaoId: escritorio,
        autorId: ana.usuarioId,
        titulo: "Reunião do escritório",
        data: dia,
        compartilhado: true,
      },
    });

    const titulos = async (quem: Ator) =>
      (await dbParaOrganizacao(escritorio, quem).compromisso.findMany({ orderBy: { titulo: "asc" } })).map(
        (c) => c.titulo,
      );

    expect(await titulos(ana)).toEqual(["Pessoal da Ana", "Reunião do escritório"]);
    expect(await titulos(bruno)).toEqual(["Reunião do escritório"]);
    expect(await titulos(dono)).toEqual(["Reunião do escritório"]);
    expect(await dbParaOrganizacao(orgA, DONO).compromisso.findMany()).toHaveLength(0);
  });

  it("só o autor altera ou apaga, mesmo o compromisso compartilhado", async () => {
    const dono$ = dbParaOrganizacao(escritorio, dono);

    const alterados = await dono$.compromisso.updateMany({ data: { titulo: "Invadido" } });
    expect(alterados.count).toBe(0);

    const apagados = await dono$.compromisso.deleteMany();
    expect(apagados.count).toBe(0);

    await expect(
      dbParaOrganizacao(escritorio, bruno).compromisso.create({
        data: {
          organizacaoId: escritorio,
          autorId: ana.usuarioId,
          titulo: "Em nome da Ana",
          data: new Date("2026-10-21T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();

    expect(
      (await dbParaOrganizacao(escritorio, ana).compromisso.findMany()).map((c) => c.titulo).sort(),
    ).toEqual(["Pessoal da Ana", "Reunião do escritório"]);
  });

  it("o lembrar depois é de cada um", async () => {
    const [compartilhado] = await dbParaOrganizacao(escritorio, bruno).compromisso.findMany();
    const ate = new Date(Date.now() + 60_000);

    // Bruno adia o aviso do compromisso compartilhado da Ana — só para ele.
    await dbParaOrganizacao(escritorio, bruno).avisoAdiado.create({
      data: { usuarioId: bruno.usuarioId, compromissoId: compartilhado.id, ate },
    });

    expect(await dbParaOrganizacao(escritorio, bruno).avisoAdiado.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, ana).avisoAdiado.findMany()).toHaveLength(0);

    await expect(
      dbParaOrganizacao(escritorio, bruno).avisoAdiado.create({
        data: { usuarioId: ana.usuarioId, compromissoId: compartilhado.id, ate },
      }),
    ).rejects.toThrow();
  });

  it("os contatos da indústria não vazam para outro escritório", async () => {
    const industria = await admin.fornecedor.findFirstOrThrow({
      where: { organizacaoId: escritorio },
    });
    await admin.contatoFornecedor.create({
      data: { fornecedorId: industria.id, email: "pcp@industria.local" },
    });

    expect(await dbParaOrganizacao(escritorio, bruno).contatoFornecedor.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(orgA, DONO).contatoFornecedor.findMany()).toHaveLength(0);
    await expect(
      dbParaOrganizacao(orgA, DONO).contatoFornecedor.create({
        data: { fornecedorId: industria.id, email: "invasor@teste.local" },
      }),
    ).rejects.toThrow();
  });

  it("o preposto vê a indústria marcada para ele", async () => {
    const nomes = (await dbParaOrganizacao(escritorio, bruno).fornecedor.findMany()).map(
      (f) => f.nome,
    );

    expect(nomes).toEqual(["Indústria Plus"]);
  });

  it("indústria sem marca para o preposto não aparece para ele — nem sem marca nenhuma", async () => {
    const industria = await admin.fornecedor.findFirstOrThrow({
      where: { organizacaoId: escritorio },
      select: { id: true },
    });

    await admin.fornecedorPreposto.delete({
      where: { fornecedorId_usuarioId: { fornecedorId: industria.id, usuarioId: bruno.usuarioId } },
    });

    expect(await dbParaOrganizacao(escritorio, ana).fornecedor.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, bruno).fornecedor.findMany()).toHaveLength(0);

    // Sem linha nenhuma, ninguém vê — a ausência não abre para o escritório.
    // (Uma indústria nova: a desta suíte tem pedido da Ana, e isso a deixa legível.)
    const outra = await admin.fornecedor.create({
      data: { organizacaoId: escritorio, nome: "Indústria sem marca" },
    });
    const nomesDe = async (ator: Ator) =>
      (await dbParaOrganizacao(escritorio, ator).fornecedor.findMany()).map((f) => f.nome);
    expect(await nomesDe(ana)).not.toContain("Indústria sem marca");
    // O administrador não depende de marca nenhuma.
    expect(await nomesDe(dono)).toContain("Indústria sem marca");

    await admin.fornecedor.delete({ where: { id: outra.id } });
    await admin.fornecedorPreposto.create({
      data: { fornecedorId: industria.id, usuarioId: bruno.usuarioId },
    });
  });

  /*
   * Desmarcar uma indústria não pode deixar o pedido do preposto sem nome:
   * ele continua lendo a indústria dos pedidos que vê — mas não o catálogo
   * dela, não a recebe para escolher, e não lança pedido novo nela.
   */
  it("a indústria desmarcada continua legível no pedido do preposto, e só nele", async () => {
    const industria = await admin.fornecedor.findFirstOrThrow({
      where: { organizacaoId: escritorio },
      select: { id: true },
    });
    await admin.produto.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId: industria.id,
        familia: "STRETCH",
        descricao: "do catálogo",
        precoKg: "10",
      },
    });
    await admin.fornecedorPreposto.delete({
      where: { fornecedorId_usuarioId: { fornecedorId: industria.id, usuarioId: ana.usuarioId } },
    });

    const comoAna = dbParaOrganizacao(escritorio, ana);

    const pedido = await comoAna.pedido.findUniqueOrThrow({
      where: { id: pedidoDaAna },
      select: { fornecedor: { select: { nome: true } } },
    });
    expect(pedido.fornecedor?.nome).toBe("Indústria Plus");

    expect(await comoAna.produto.findMany()).toHaveLength(0);
    expect(
      await comoAna.fornecedor.findMany({
        where: soIndustriasMarcadas({ ehAdmin: false, usuarioId: ana.usuarioId }),
      }),
    ).toHaveLength(0);
    await expect(
      comoAna.pedido.create({
        data: {
          organizacaoId: escritorio,
          fornecedorId: industria.id,
          clienteId: clienteDaAna,
          numero: 2,
          representanteId: ana.usuarioId,
          criadoPorId: ana.usuarioId,
        },
      }),
    ).rejects.toThrow();
    await expect(
      comoAna.orcamento.create({
        data: {
          organizacaoId: escritorio,
          fornecedorId: industria.id,
          numero: 1,
          representanteId: ana.usuarioId,
          criadoPorId: ana.usuarioId,
        },
      }),
    ).rejects.toThrow();

    // Bruno não vê o pedido da Ana — e por ele, continua lendo só pela marca.
    expect(
      await dbParaOrganizacao(escritorio, bruno).fornecedor.findMany({
        where: soIndustriasMarcadas({ ehAdmin: false, usuarioId: bruno.usuarioId }),
      }),
    ).toHaveLength(1);

    await admin.fornecedorPreposto.create({
      data: { fornecedorId: industria.id, usuarioId: ana.usuarioId },
    });
    await admin.produto.deleteMany({ where: { organizacaoId: escritorio } });
  });

  it("com a indústria marcada, o preposto lança pedido nela", async () => {
    const industria = await admin.fornecedor.findFirstOrThrow({
      where: { organizacaoId: escritorio },
      select: { id: true },
    });

    const novo = await dbParaOrganizacao(escritorio, ana).pedido.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId: industria.id,
        clienteId: clienteDaAna,
        numero: 3,
        representanteId: ana.usuarioId,
        criadoPorId: ana.usuarioId,
      },
    });

    await admin.pedido.delete({ where: { id: novo.id } });
  });

  it("o produto segue a permissão da indústria", async () => {
    const industria = await admin.fornecedor.findFirst({
      where: { organizacaoId: escritorio },
      select: { id: true },
    });

    await admin.fornecedorPreposto.delete({
      where: { fornecedorId_usuarioId: { fornecedorId: industria!.id, usuarioId: bruno.usuarioId } },
    });

    await admin.produto.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId: industria!.id,
        familia: "STRETCH",
        descricao: "stretch de teste",
        precoKg: "10",
      },
    });

    expect(await dbParaOrganizacao(escritorio, ana).produto.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, bruno).produto.findMany()).toHaveLength(0);

    await admin.fornecedorPreposto.create({
      data: { fornecedorId: industria!.id, usuarioId: bruno.usuarioId },
    });
    await admin.produto.deleteMany({ where: { organizacaoId: escritorio } });
  });

  /*
   * O produto tem CLIENTE, e é o preço daquele cliente que ele carrega.
   *
   * O mesmo saco cotado para dois clientes é dois produtos com preço diferente;
   * deixar o preposto ler o produto de uma carteira alheia entregaria a ele o
   * preço que o colega fez. Por isso o corte é o mesmo dos clientes e dos
   * pedidos, e não só o da indústria.
   */
  it("o produto de um cliente só aparece para quem tem a carteira", async () => {
    const industria = await admin.fornecedor.findFirst({
      where: { organizacaoId: escritorio },
      select: { id: true },
    });

    const criarProduto = async (descricao: string, clienteId: string | null) =>
      admin.produto.create({
        data: {
          organizacaoId: escritorio,
          fornecedorId: industria!.id,
          clienteId,
          familia: "STRETCH",
          descricao,
          precoKg: "10",
        },
      });

    await criarProduto("DA-ANA stretch", clienteDaAna);
    await criarProduto("DO-BRUNO stretch", clienteDoBruno);
    // Sem dono: item de catálogo do escritório, visível a todos.
    await criarProduto("DA-CASA stretch", null);

    const vistosPor = async (ator: Ator) =>
      (
        await dbParaOrganizacao(escritorio, ator).produto.findMany({
          orderBy: { descricao: "asc" },
        })
      ).map((p) => p.descricao);

    expect(await vistosPor(ana)).toEqual(["DA-ANA stretch", "DA-CASA stretch"]);
    expect(await vistosPor(bruno)).toEqual(["DA-CASA stretch", "DO-BRUNO stretch"]);
    expect(await vistosPor(dono)).toEqual([
      "DA-ANA stretch",
      "DA-CASA stretch",
      "DO-BRUNO stretch",
    ]);

    await admin.produto.deleteMany({ where: { organizacaoId: escritorio } });
  });

  it("não deixa cadastrar produto para o cliente do colega", async () => {
    const industria = await admin.fornecedor.findFirst({
      where: { organizacaoId: escritorio },
      select: { id: true },
    });

    await expect(
      dbParaOrganizacao(escritorio, ana).produto.create({
        data: {
          organizacaoId: escritorio,
          fornecedorId: industria!.id,
          clienteId: clienteDoBruno,
          familia: "STRETCH",
          descricao: "invasão",
          precoKg: "10",
        },
      }),
    ).rejects.toThrow();
  });

  it("preposto só existe em escritório Plus", async () => {
    const padrao = await admin.organizacao.create({ data: { nome: "Escritório Padrão" } });

    await expect(
      admin.usuario.create({
        data: {
          organizacaoId: padrao.id,
          nome: "Preposto indevido",
          email: `indevido-${padrao.id}@teste.local`,
          senhaHash: "x",
          papel: "REPRESENTANTE",
        },
      }),
    ).rejects.toThrow();

    await admin.organizacao.delete({ where: { id: padrao.id } });
  });
});

describe("integridade das famílias de produto", () => {
  it("recusa saco sem as medidas que a fórmula exige", async () => {
    const fornecedor = await admin.fornecedor.create({
      data: { organizacaoId: orgA, nome: "Fornecedor de teste" },
    });

    await expect(
      admin.produto.create({
        data: {
          organizacaoId: orgA,
          fornecedorId: fornecedor.id,
          familia: "SACO",
          descricao: "saco sem medidas",
          // sem larguraCm/comprimentoCm/espessuraMm/fatorKg
        },
      }),
    ).rejects.toThrow();

    await admin.fornecedor.delete({ where: { id: fornecedor.id } });
  });
});
