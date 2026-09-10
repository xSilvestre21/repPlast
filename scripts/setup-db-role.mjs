/**
 * Prepara e VERIFICA o papel restrito com que a aplicação acessa o banco.
 *
 * Por que isso existe: no PostgreSQL, superusuário ignora Row Level Security —
 * inclusive com FORCE ROW LEVEL SECURITY ligado. A connection string quase
 * sempre é do dono do banco (precisa ser, para rodar migrations). Se a
 * aplicação usasse esse mesmo papel, todas as policies de isolamento entre
 * escritórios virariam decoração.
 *
 * O script é tolerante ao provedor:
 *   - Prisma Postgres já traz `prisma_application` pronto e não permite GRANT;
 *   - Postgres self-hosted / Neon deixam criar o papel e conceder na mão.
 *
 * Em vez de assumir que deu certo, ele termina VERIFICANDO de fato: assume o
 * papel e tenta ler uma tabela.
 *
 * Rode com:  npm run db:setup
 */

import "dotenv/config";
import pg from "pg";

const PAPEL = process.env.APP_DB_ROLE?.trim() || "repplast_app";
const SENHA = process.env.APP_DB_PASSWORD;

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(PAPEL)) {
  console.error(`Nome de papel inválido: ${PAPEL}`);
  process.exit(1);
}

const urlAdmin = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!urlAdmin) {
  console.error("DIRECT_DATABASE_URL (ou DATABASE_URL) não definida.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: urlAdmin });
await client.connect();

/** Executa algo que pode ser proibido pelo provedor sem abortar o script. */
async function tentar(descricao, sql) {
  try {
    await client.query(sql);
    return true;
  } catch (erro) {
    console.log(`  · ${descricao}: ignorado (${erro.message})`);
    return false;
  }
}

try {
  // --- 1. O papel existe? ---
  const existente = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [PAPEL]);

  if (existente.rowCount === 0) {
    try {
      await client.query(`CREATE ROLE ${PAPEL} LOGIN NOSUPERUSER NOBYPASSRLS`);
      console.log(`Papel "${PAPEL}" criado.`);
    } catch (erro) {
      console.error(
        `\nNão foi possível criar o papel "${PAPEL}": ${erro.message}\n` +
          "Crie-o pelo painel do provedor e informe o nome em APP_DB_ROLE no .env.\n",
      );
      process.exit(1);
    }
  } else {
    console.log(`Papel "${PAPEL}" já existe.`);
  }

  // --- 2. Privilégios (alguns provedores gerenciam sozinhos e proíbem GRANT) ---
  console.log("Concedendo privilégios:");

  if (SENHA) {
    // ALTER ROLE é comando utilitário: não aceita bind parameter, então a senha
    // precisa ir escapada como literal.
    await tentar(
      "senha",
      `ALTER ROLE ${PAPEL} WITH LOGIN PASSWORD ${client.escapeLiteral(SENHA)}`,
    );
  }

  await tentar("uso do schema", `GRANT USAGE ON SCHEMA public TO ${PAPEL}`);
  await tentar(
    "tabelas existentes",
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${PAPEL}`,
  );
  await tentar(
    "sequências existentes",
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${PAPEL}`,
  );
  await tentar(
    "tabelas futuras",
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${PAPEL}`,
  );
  await tentar(
    "sequências futuras",
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${PAPEL}`,
  );

  // --- 3. Verificação de verdade ---
  const { rows } = await client.query(
    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1",
    [PAPEL],
  );

  if (rows[0]?.rolsuper || rows[0]?.rolbypassrls) {
    console.error(
      `\nO papel "${PAPEL}" ignora RLS (superuser=${rows[0].rolsuper}, ` +
        `bypassrls=${rows[0].rolbypassrls}).\n` +
        "O isolamento entre escritórios NÃO estaria protegido pelo banco.\n",
    );
    process.exit(1);
  }

  // Assume o papel e tenta ler de fato — é isto que prova que a aplicação
  // conseguirá trabalhar, independente de os GRANTs acima terem passado.
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${PAPEL}`);
    await client.query("SELECT 1 FROM organizacao LIMIT 1");
    console.log(`\nVerificado: "${PAPEL}" lê as tabelas, sem superusuário e sem bypass de RLS.`);
  } catch (erro) {
    console.error(
      `\nO papel "${PAPEL}" não consegue ler as tabelas: ${erro.message}\n` +
        "Rode as migrations antes (npx prisma migrate deploy) ou conceda os privilégios pelo painel do provedor.\n",
    );
    process.exit(1);
  } finally {
    await client.query("ROLLBACK");
  }
} finally {
  await client.end();
}
