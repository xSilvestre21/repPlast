/**
 * Acesso ao banco, sempre com escopo de escritório.
 *
 * Regra de ouro deste arquivo: NENHUM código de aplicação deve importar o
 * cliente cru. Use `dbParaOrganizacao(id)`, que injeta o tenant no contexto da
 * sessão Postgres antes de cada query. As policies de RLS (migration
 * `rls_e_checks`) leem esse contexto e recusam linhas de outro escritório.
 *
 * SÃO DUAS CAMADAS, e as duas são obrigatórias:
 *
 *   1. O código da aplicação filtra explicitamente por `organizacaoId`.
 *   2. O RLS barra o que escapar da camada 1.
 *
 * Escrever a query contando só com o RLS é arriscado por um motivo prático: em
 * alguns ambientes de desenvolvimento a conexão é superusuário, e superusuário
 * ignora RLS. Um vazamento entre escritórios passaria despercebido ali e só
 * apareceria em produção.
 */

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalParaPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

/**
 * Papel restrito que a aplicação assume a cada transação.
 *
 * Existe porque o usuário da connection string costuma ser o dono do banco — e
 * no PostgreSQL o superusuário ignora Row Level Security, inclusive com
 * FORCE ROW LEVEL SECURITY. Trocar para um papel comum é o que faz as policies
 * de isolamento realmente valerem.
 *
 * Deixe `APP_DB_ROLE` vazio apenas em ambientes onde o papel não existe; nesse
 * caso o isolamento passa a depender só do filtro da aplicação.
 */
const PAPEL_APP = (() => {
  const papel = process.env.APP_DB_ROLE?.trim();
  if (!papel) return null;

  // Identificador não aceita bind parameter em comando utilitário, então o
  // valor é interpolado — e por isso precisa ser validado.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(papel)) {
    throw new Error(`APP_DB_ROLE inválido: ${papel}`);
  }
  return papel;
})();

function criarCliente() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Confira o .env — veja o README para provisionar um banco.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    // Toda query passa por uma transação (é como o contexto de tenant é
    // aplicado — ver `comContexto`), então são 3 idas ao banco por operação.
    // Com o banco em outra região os limites padrão do Prisma (2s para obter a
    // transação, 5s de duração) ficam curtos e estouram P2028.
    transactionOptions: {
      maxWait: 15_000,
      timeout: 30_000,
    },
  });
}

/**
 * Cliente cru, SEM escopo de tenant. Só existe para ser estendido pelas funções
 * abaixo. Em desenvolvimento é reaproveitado entre recargas do Next para não
 * estourar o limite de conexões.
 */
const prismaBase = globalParaPrisma.prismaBase ?? criarCliente();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prismaBase = prismaBase;
}

/**
 * Monta a extensão que prepara o contexto antes de cada query.
 *
 * `SET LOCAL` e `set_config(..., TRUE)` valem só dentro da transação corrente —
 * é justamente por isso que a query precisa viajar no mesmo `$transaction`.
 * Fora dela o contexto se perderia antes de a policy ser avaliada.
 */
function comContexto(opcoes: { chave: string; valor: string; trocarPapel: boolean }) {
  return {
    query: {
      $allModels: {
        async $allOperations({
          args,
          query,
        }: {
          args: unknown;
          query: (a: unknown) => Promise<unknown>;
        }) {
          const preparo = [];

          if (opcoes.trocarPapel && PAPEL_APP) {
            preparo.push(prismaBase.$executeRawUnsafe(`SET LOCAL ROLE ${PAPEL_APP}`));
          }

          preparo.push(
            prismaBase.$executeRaw`SELECT set_config(${opcoes.chave}, ${opcoes.valor}, TRUE)`,
          );

          const resultados = await prismaBase.$transaction([
            ...preparo,
            query(args) as never,
          ]);

          return resultados[resultados.length - 1];
        },
      },
    },
  };
}

/**
 * Cliente amarrado a um escritório. É este que a aplicação deve usar.
 */
export function dbParaOrganizacao(organizacaoId: string) {
  return prismaBase.$extends(
    comContexto({ chave: "app.organizacao_id", valor: organizacaoId, trocarPapel: true }),
  );
}

/**
 * Cliente que ignora o RLS. Serve para seed, migrations de dados e criação de
 * uma organização nova — o único momento em que ainda não existe tenant.
 *
 * Roda como o dono do banco de propósito, sem trocar de papel.
 * NUNCA use isto para atender uma requisição de usuário.
 */
export function dbAdministrativo() {
  return prismaBase.$extends(
    comContexto({ chave: "app.bypass_rls", valor: "on", trocarPapel: false }),
  );
}

export type DbOrganizacao = ReturnType<typeof dbParaOrganizacao>;
