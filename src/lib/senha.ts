/**
 * Guarda e verificação de senha.
 *
 * Usa `scrypt`, que já vem no Node — sem dependência nova para algo tão
 * sensível. O scrypt é deliberadamente caro em CPU e memória, que é o que
 * torna inviável testar bilhões de senhas caso o banco vaze.
 *
 * O hash é guardado como `scrypt$N$r$p$salt$derivada`, com os parâmetros
 * dentro: se um dia eles precisarem ficar mais fortes, as senhas antigas
 * continuam verificáveis com os valores usados na época.
 */

import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

export { TAMANHO_MINIMO_SENHA } from "./senha-regras";

const derivar = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number },
) => Promise<Buffer>;

/** Custo atual. Memória usada ≈ 128 × N × r = 16 MB por verificação. */
const PARAMETROS = { N: 16384, r: 8, p: 1 };
const TAMANHO_CHAVE = 64;
const TAMANHO_SAL = 16;


export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const derivada = await derivar(senha.normalize("NFKC"), sal, TAMANHO_CHAVE, PARAMETROS);

  const { N, r, p } = PARAMETROS;
  return `scrypt$${N}$${r}$${p}$${sal.toString("base64")}$${derivada.toString("base64")}`;
}

/**
 * Confere a senha contra o hash guardado.
 *
 * Nunca lança por hash malformado: devolver `false` evita transformar um dado
 * corrompido no banco em erro 500 na tela de login.
 */
export async function conferirSenha(senha: string, hashGuardado: string): Promise<boolean> {
  try {
    const [algoritmo, n, r, p, sal, derivada] = hashGuardado.split("$");
    if (algoritmo !== "scrypt") return false;

    const esperada = Buffer.from(derivada, "base64");

    const calculada = await derivar(
      senha.normalize("NFKC"),
      Buffer.from(sal, "base64"),
      esperada.length,
      { N: Number(n), r: Number(r), p: Number(p) },
    );

    // Comparação em tempo constante: comparar com `===` vazaria, pelo tempo de
    // resposta, quantos bytes iniciais estavam certos.
    return calculada.length === esperada.length && timingSafeEqual(calculada, esperada);
  } catch {
    return false;
  }
}
