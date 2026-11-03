import "server-only";

import { dbAdministrativo } from "./db";
import { liberacao } from "./limite-tentativas";

/**
 * O limite do cadastro, contado em `tentativa_cadastro`.
 *
 * Cada tentativa que passa da conferência dos campos custa caro: consulta o
 * CEP e o domínio do e-mail e abre um checkout no Asaas. Duas portas, como o
 * login (`tentativas-login.ts`):
 *
 * - por E-MAIL: 5 na hora. Folga para quem erra o CEP, o cartão recusa e
 *   tenta de novo — e segura quem insiste no mesmo endereço;
 * - por IP: 10 na hora. Um escritório inteiro se cadastrando da mesma rede
 *   cabe; um robô trocando de e-mail a cada tentativa, não.
 */

export const LIMITE_CADASTROS_POR_EMAIL = 5;
export const LIMITE_CADASTROS_POR_IP = 10;
export const JANELA_CADASTROS_MIN = 60;

/** Tentativas mais velhas que isto não servem a limite nenhum: são apagadas de passagem. */
const GUARDAR_HORAS = 24;

/** Até quando o cadastro está fechado para este e-mail ou IP, ou `null`. */
export async function bloqueioDoCadastro({ email, ip }: { email: string; ip: string }): Promise<Date | null> {
  const agora = new Date();
  const desde = new Date(agora.getTime() - JANELA_CADASTROS_MIN * 60 * 1000);
  const db = dbAdministrativo();

  const [doEmail, doIp] = await Promise.all([
    db.tentativaCadastro.findMany({ where: { email, criadaEm: { gt: desde } }, select: { criadaEm: true } }),
    db.tentativaCadastro.findMany({ where: { ip, criadaEm: { gt: desde } }, select: { criadaEm: true } }),
  ]);

  const regra = { janelaMin: JANELA_CADASTROS_MIN, agora };
  const porEmail = liberacao(doEmail.map((t) => t.criadaEm), { ...regra, limite: LIMITE_CADASTROS_POR_EMAIL });
  const porIp = liberacao(doIp.map((t) => t.criadaEm), { ...regra, limite: LIMITE_CADASTROS_POR_IP });

  if (porEmail && porIp) return porEmail > porIp ? porEmail : porIp;
  return porEmail ?? porIp;
}

export async function registrarTentativaDeCadastro({ email, ip }: { email: string; ip: string }): Promise<void> {
  const db = dbAdministrativo();
  await db.tentativaCadastro.create({ data: { email, ip } });
  await db.tentativaCadastro.deleteMany({
    where: { criadaEm: { lt: new Date(Date.now() - GUARDAR_HORAS * 60 * 60 * 1000) } },
  });
}
