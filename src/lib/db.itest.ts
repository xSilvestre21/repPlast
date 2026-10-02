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

    const criarCliente = async (apelido: string, representanteId: string | null) => {
      const c = await admin.cliente.create({
        data: {
          organizacaoId: escritorio,
          apelido,
          razaoSocial: `${apelido} LTDA`,
          representanteId,
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

  it("o preposto vê a própria carteira e a do escritório, não a do colega", async () => {
    const apelidos = (
      await dbParaOrganizacao(escritorio, ana).cliente.findMany({ orderBy: { apelido: "asc" } })
    ).map((c) => c.apelido);

    expect(apelidos).toEqual(["DA-ANA", "DA-CASA"]);
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

  it("não deixa carimbar um cliente novo com o nome do colega", async () => {
    await expect(
      dbParaOrganizacao(escritorio, ana).cliente.create({
        data: {
          organizacaoId: escritorio,
          apelido: "INVASOR",
          razaoSocial: "Invasor LTDA",
          representanteId: bruno.usuarioId,
        },
      }),
    ).rejects.toThrow();
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

  it("o histórico de envios da proposta herda o corte do orçamento", async () => {
    const { fornecedorId } = await admin.pedido.findUniqueOrThrow({ where: { id: pedidoDaAna } });
    const proposta = await admin.orcamento.create({
      data: {
        organizacaoId: escritorio,
        fornecedorId,
        clienteId: clienteDaAna,
        numero: 1,
        representanteId: ana.usuarioId,
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

  it("indústria sem permissão cadastrada é de todos", async () => {
    const nomes = (await dbParaOrganizacao(escritorio, bruno).fornecedor.findMany()).map(
      (f) => f.nome,
    );

    expect(nomes).toEqual(["Indústria Plus"]);
  });

  it("cadastrar permissão fecha a indústria para quem ficou de fora", async () => {
    const industria = await admin.fornecedor.findFirst({
      where: { organizacaoId: escritorio },
      select: { id: true },
    });

    await admin.fornecedorPreposto.create({
      data: { fornecedorId: industria!.id, usuarioId: ana.usuarioId },
    });

    expect(await dbParaOrganizacao(escritorio, ana).fornecedor.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, bruno).fornecedor.findMany()).toHaveLength(0);
    // O administrador não depende de permissão nenhuma.
    expect(await dbParaOrganizacao(escritorio, dono).fornecedor.findMany()).toHaveLength(1);

    await admin.fornecedorPreposto.deleteMany({ where: { fornecedorId: industria!.id } });
  });

  it("o produto segue a permissão da indústria", async () => {
    const industria = await admin.fornecedor.findFirst({
      where: { organizacaoId: escritorio },
      select: { id: true },
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

    await admin.fornecedorPreposto.create({
      data: { fornecedorId: industria!.id, usuarioId: ana.usuarioId },
    });

    expect(await dbParaOrganizacao(escritorio, ana).produto.findMany()).toHaveLength(1);
    expect(await dbParaOrganizacao(escritorio, bruno).produto.findMany()).toHaveLength(0);

    await admin.fornecedorPreposto.deleteMany({ where: { fornecedorId: industria!.id } });
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
