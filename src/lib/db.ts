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
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

import { comSegundaTentativa } from "./erro-de-conexao";

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

  // O papel viaja como parâmetro (ver `comContexto`), então a validação não é
  // mais o que impede injeção — é o que faz um nome errado falhar AQUI, na
  // subida, em vez de em toda query como um erro de papel inexistente.
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

  /*
   * O pool é criado aqui, e não pelo adaptador, por causa do Vercel.
   *
   * Lá a instância é SUSPENSA entre uma requisição e outra, com as conexões
   * ociosas ainda abertas — o relógio que as fecharia não corre com ela
   * parada. O banco as derruba do lado dele, e a requisição seguinte pegava um
   * soquete morto: a tela caía em "Esta tela não carregou" e abria no "Tentar
   * de novo", que já usava conexão nova. `attachDatabasePool` segura a
   * instância acordada só até as ociosas fecharem — por isso o prazo curto lá.
   * Fora do Vercel (a AWS, um processo que não dorme) ele não faz nada, e o
   * prazo fica no padrão do `pg`.
   *
   * `keepAlive` faz o sistema operacional notar a conexão que caiu sem aviso;
   * o limite para conectar troca uma espera sem fim por um erro que a segunda
   * tentativa (`comContexto`) resolve.
   */
  const noVercel = Boolean(process.env.VERCEL);
  const pool = new Pool({
    connectionString,
    keepAlive: true,
    connectionTimeoutMillis: 10_000,
    ...(noVercel ? { idleTimeoutMillis: 5_000 } : {}),
  });

  // Conexão ociosa que cai emite "error" no pool; sem ouvinte, o Node trata
  // como exceção não capturada e derruba o processo. O pool já a descarta.
  pool.on("error", (erro) => {
    console.warn("Conexão ociosa com o banco caiu:", erro.message);
  });

  if (noVercel) attachDatabasePool(pool);

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    // Toda query passa por uma transação (é como o contexto de tenant é
    // aplicado — ver `comContexto`), então são 4 idas ao banco por operação.
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
/**
 * Quem está pedindo. É o que o RLS usa para separar preposto de preposto dentro
 * do mesmo escritório (ver migration `planos_papeis_e_representante`).
 */
export interface Ator {
  usuarioId: string;
  papel: "ADMIN" | "REPRESENTANTE";
}

function comContexto(opcoes: {
  chave: string;
  valor: string;
  trocarPapel: boolean;
  ator?: Ator;
}) {
  return {
    query: {
      $allModels: {
        async $allOperations({
          operation,
          args,
          query,
        }: {
          operation: string;
          args: unknown;
          query: (a: unknown) => Promise<unknown>;
        }) {
          /*
           * O preâmbulo é UMA instrução, e isso é medida de desempenho.
           *
           * `SET LOCAL ROLE x` e `SELECT set_config('role', x, TRUE)` fazem a
           * mesma coisa — o papel é um GUC como outro qualquer, e volta ao
           * original no fim da transação do mesmo jeito. A diferença é que a
           * segunda forma cabe na MESMA instrução do contexto de tenant.
           *
           * Com o banco em outra região isso não é detalhe: cada instrução é
           * uma travessia de ~125ms. Duas viravam uma, e a operação inteira
           * caiu de cinco idas para quatro.
           *
           * Os dois valores viajam como parâmetro, não interpolados — então
           * nem o papel nem o id do escritório podem carregar SQL junto.
           */
          const usuarioId = opcoes.ator?.usuarioId ?? "";
          const papel = opcoes.ator?.papel ?? "";

          // Função, e não valor: a segunda tentativa monta a transação de novo,
          // do preâmbulo à consulta.
          const executar = async () => {
            const preparo =
              opcoes.trocarPapel && PAPEL_APP
                ? prismaBase.$executeRaw`SELECT set_config('role', ${PAPEL_APP}, TRUE), set_config(${opcoes.chave}, ${opcoes.valor}, TRUE), set_config('app.usuario_id', ${usuarioId}, TRUE), set_config('app.papel', ${papel}, TRUE)`
                : prismaBase.$executeRaw`SELECT set_config(${opcoes.chave}, ${opcoes.valor}, TRUE)`;

            const resultados = await prismaBase.$transaction([preparo, query(args) as never]);

            return resultados[resultados.length - 1];
          };

          // Leitura que pegou uma conexão morta tenta mais uma vez; escrita,
          // nunca (`comSegundaTentativa`, em `erro-de-conexao.ts`).
          return comSegundaTentativa(operation, executar);
        },
      },
    },
  };
}

/**
 * Cliente amarrado a um escritório E a quem está pedindo. É este que a
 * aplicação deve usar.
 *
 * O `ator` é obrigatório de propósito. Ele poderia ter um padrão — "se não
 * disserem quem é, trate como administrador" —, e aí um ponto do código que
 * esquecesse de passá-lo mostraria a carteira inteira ao preposto, sem erro
 * nenhum. Exigindo o parâmetro, esse esquecimento vira erro de compilação.
 */
export function dbParaOrganizacao(organizacaoId: string, ator: Ator) {
  return prismaBase.$extends(
    comContexto({
      chave: "app.organizacao_id",
      valor: organizacaoId,
      trocarPapel: true,
      ator,
    }),
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
