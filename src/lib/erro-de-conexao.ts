/**
 * "A conexão com o banco caiu" — e não "o banco recusou a consulta".
 *
 * A diferença decide se vale tentar de novo. Uma conexão ociosa que o servidor
 * derrubou (o Neon, depois de alguns minutos parado; a instância do Vercel,
 * suspensa entre uma requisição e outra) só é descoberta na hora de usá-la: a
 * consulta falha sem ter chegado ao banco, e a tentativa seguinte abre uma
 * conexão nova e funciona. Era o "Esta tela não carregou" que sumia ao clicar
 * em "Tentar de novo".
 *
 * Já uma recusa do banco (constraint, RLS, sintaxe) falharia igual na segunda
 * vez — repetir só dobraria a espera.
 *
 * O erro chega em formatos diferentes conforme a camada que o apanhou: o código
 * do Prisma (`P1017`), o do adaptador (`kind: "ConnectionClosed"`), o do soquete
 * (`ECONNRESET`) ou só a frase do `pg`. Por isso a busca desce pela cadeia de
 * `cause`.
 */

/** Prisma: P1001 banco inalcançável, P1017 o servidor fechou a conexão. */
const CODIGOS = new Set([
  "P1001",
  "P1017",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  // PostgreSQL: a conexão foi encerrada pelo administrador (o banco reiniciou
  // ou foi suspenso com ela aberta).
  "57P01",
]);

/** O que o adaptador `@prisma/adapter-pg` diz de um soquete que caiu. */
const TIPOS = new Set(["ConnectionClosed", "SocketTimeout"]);

const FRASES =
  /connection terminated|connection closed|server has closed the connection|client has encountered a connection error|socket hang up|ECONNRESET/i;

/** Quantos níveis de `cause` descer — o bastante para as camadas daqui, e nunca um laço. */
const PROFUNDIDADE = 5;

export function erroDeConexao(erro: unknown): boolean {
  let atual = erro;

  for (let nivel = 0; nivel < PROFUNDIDADE && atual && typeof atual === "object"; nivel++) {
    const { code, kind, message, cause } = atual as {
      code?: unknown;
      kind?: unknown;
      message?: unknown;
      cause?: unknown;
    };

    if (typeof code === "string" && CODIGOS.has(code)) return true;
    if (typeof kind === "string" && TIPOS.has(kind)) return true;
    if (typeof message === "string" && FRASES.test(message)) return true;

    atual = cause;
  }
  return false;
}

/**
 * As operações que só leem — as únicas que se repetem.
 *
 * Uma escrita cuja conexão cai no meio do `COMMIT` é ambígua: pode ter gravado
 * ou não, e repetir lançaria o pedido duas vezes. Leitura não tem esse risco.
 */
const LEITURAS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export function operacaoDeLeitura(operacao: string): boolean {
  return LEITURAS.has(operacao);
}

/**
 * Leitura que caiu por conexão morta tenta mais uma vez — e só uma.
 *
 * A conexão ociosa que o banco derrubou só é descoberta ao usá-la; a consulta
 * nem chegou lá, e a próxima sai por conexão nova. Sem isto, quem pagava era a
 * tela inteira: são várias consultas em paralelo por página, e bastava uma
 * delas pegar o soquete morto.
 *
 * `executar` é chamada de novo do zero — por isso recebe a função, e não a
 * promessa já em andamento.
 */
export async function comSegundaTentativa<T>(operacao: string, executar: () => Promise<T>): Promise<T> {
  try {
    return await executar();
  } catch (erro) {
    if (!operacaoDeLeitura(operacao) || !erroDeConexao(erro)) throw erro;
    console.warn(`Conexão com o banco caiu em ${operacao}; tentando de novo.`);
    return await executar();
  }
}
