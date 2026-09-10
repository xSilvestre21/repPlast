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

import { dbAdministrativo, dbParaOrganizacao } from "./db";

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
    const db = dbParaOrganizacao(orgA);

    // Repare: nenhum `where` de organização. Quem filtra é o Postgres.
    const clientes = await db.cliente.findMany();

    expect(clientes).toHaveLength(1);
    expect(clientes[0].apelido).toBe("CLIENTE-A");
  });

  it("buscar pelo id de um cliente de outro escritório não devolve nada", async () => {
    const db = dbParaOrganizacao(orgA);

    const alheio = await db.cliente.findUnique({ where: { id: clienteDeB } });

    expect(alheio).toBeNull();
  });

  it("não deixa gravar registro carimbado com outro escritório", async () => {
    const db = dbParaOrganizacao(orgA);

    await expect(
      db.cliente.create({
        data: { organizacaoId: orgB, apelido: "INVASOR", razaoSocial: "Invasor LTDA" },
      }),
    ).rejects.toThrow();
  });

  it("não deixa alterar registro de outro escritório", async () => {
    const db = dbParaOrganizacao(orgA);

    const alterados = await db.cliente.updateMany({
      where: { id: clienteDeB },
      data: { apelido: "SEQUESTRADO" },
    });

    expect(alterados.count).toBe(0);

    const intacto = await admin.cliente.findUnique({ where: { id: clienteDeB } });
    expect(intacto?.apelido).toBe("CLIENTE-B");
  });

  it("cada escritório enxerga a própria organização, e só ela", async () => {
    const organizacoes = await dbParaOrganizacao(orgA).organizacao.findMany();

    expect(organizacoes).toHaveLength(1);
    expect(organizacoes[0].id).toBe(orgA);
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
