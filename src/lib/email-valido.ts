/**
 * O e-mail do cadastro tem de ser um endereço que recebe mensagem: é com ele
 * que a pessoa entra, recupera a senha e recebe a cobrança.
 *
 * Duas camadas. Aqui, a forma — sem banco nem rede, testável: o que o "tem @ e
 * ponto" de antes deixava passar ("ana@gmail..com", "ana@gmail.c", "ana@-x.com")
 * e o erro de digitação dos provedores comuns ("gmial.com", "hotmail.con"), que
 * tem dono e por isso não seria pego pela segunda camada. A segunda,
 * `dominio-email.ts`, pergunta ao DNS se o domínio recebe e-mail.
 */

/** O limite de um endereço (RFC 5321): 64 antes do @, 254 no total. */
const MAXIMO_LOCAL = 64;
const MAXIMO_TOTAL = 254;

const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const ROTULO_DOMINIO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const TERMINACAO = /^[a-z]{2,}$/;

/** Os provedores que quase todo mundo usa — onde um erro de digitação é mais provável. */
const PROVEDORES_COMUNS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
];

/**
 * Domínios de verdade a uma ou duas letras de um provedor comum. Sem esta
 * lista, quem usa o "ymail.com" do Yahoo ouviria "não seria @gmail.com?".
 */
const PARECIDOS_LEGITIMOS = new Set([
  "ymail.com",
  "mail.com",
  "email.com",
  "gmx.com",
  "msn.com",
  "aol.com",
  "me.com",
  "mac.com",
  "live.com.br",
  "ig.com.br",
  "oi.com.br",
  "globo.com",
  "zipmail.com.br",
]);

/**
 * Quantas letras é preciso trocar, pôr ou tirar para ir de um texto ao outro —
 * e duas vizinhas invertidas ("gmial") contam como UM erro, que é como
 * acontecem no teclado.
 */
function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** "gmial.com" → "gmail.com"; `null` quando o domínio não parece um provedor comum digitado errado. */
export function provedorParecido(dominio: string): string | null {
  if (PROVEDORES_COMUNS.includes(dominio) || PARECIDOS_LEGITIMOS.has(dominio)) return null;
  // Duas letras de folga só em domínio comprido: em "bol.com.br", duas letras
  // já levam a domínios que existem e não são erro de ninguém.
  const parecido = PROVEDORES_COMUNS.find(
    (provedor) => distancia(dominio, provedor) <= (provedor.length >= 10 ? 2 : 1),
  );
  return parecido ?? null;
}

/**
 * O problema da FORMA do e-mail, em português de gente, ou `null`.
 * Recebe já em minúsculas e sem espaços nas pontas (`lerEmail`).
 */
export function problemaNoEmail(email: string): string | null {
  const exemplo = "como voce@escritorio.com.br";
  if (/\s/.test(email)) return `O e-mail não pode ter espaços. Confira e digite de novo, ${exemplo}.`;

  const partes = email.split("@");
  if (partes.length !== 2) {
    return `O e-mail precisa de um @ — e só um —, ${exemplo}.`;
  }

  const [local, dominio] = partes;
  if (!local) return `Falta o começo do e-mail, antes do @, ${exemplo}.`;
  if (!dominio) return `Falta o final do e-mail, depois do @, ${exemplo}.`;
  if (local.length > MAXIMO_LOCAL || email.length > MAXIMO_TOTAL) {
    return "Este e-mail é comprido demais para ser de verdade. Confira se colou o texto certo.";
  }
  if (!LOCAL.test(local)) {
    return (
      "O começo do e-mail, antes do @, tem um caractere que não vale — ou um ponto no começo, no " +
      `fim ou dois seguidos. Confira, ${exemplo}.`
    );
  }

  const rotulos = dominio.split(".");
  const terminacao = rotulos[rotulos.length - 1];
  if (rotulos.length < 2 || !rotulos.every((r) => ROTULO_DOMINIO.test(r)) || !TERMINACAO.test(terminacao)) {
    return `O final do e-mail, depois do @, está incompleto ou com algo errado. Confira, ${exemplo}.`;
  }

  const sugestao = provedorParecido(dominio);
  if (sugestao) return `Confira o final do e-mail: não seria @${sugestao}?`;

  return null;
}
