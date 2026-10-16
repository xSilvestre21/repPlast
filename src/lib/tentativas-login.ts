import "server-only";

import { headers } from "next/headers";

import { dbAdministrativo } from "./db";
import { liberacao, restantes } from "./limite-tentativas";

/**
 * O limite de tentativas do login.
 *
 * Duas portas, contadas na mesma tabela de falhas (`tentativa_login`):
 *
 * - por E-MAIL: 5 senhas erradas em 15 minutos fecham aquele e-mail por 15
 *   minutos. É o que segura quem testa senhas numa conta. Conta também para
 *   e-mail sem conta — senão o bloqueio denunciaria quais e-mails existem;
 * - por IP: 30 erros em 15 minutos fecham o endereço. É o que segura quem
 *   testa UMA senha comum em muitas contas, que a porta do e-mail não vê.
 *
 * Bloqueado, o login nem confere a senha: senão a senha certa, acertada
 * durante o bloqueio, entraria — e o limite deixaria de valer.
 */

export const LIMITE_POR_EMAIL = 5;
export const LIMITE_POR_IP = 30;
export const JANELA_MIN = 15;

/** Falhas mais velhas que isto não servem a nenhuma conta: são apagadas de passagem. */
const GUARDAR_HORAS = 24;

/**
 * O endereço de quem pede.
 *
 * `x-forwarded-for` só merece confiança atrás de um proxy que o escreva (a
 * hospedagem). Sem proxy, quem ataca pode inventá-lo a cada pedido e escapar
 * da porta do IP — a do e-mail continua valendo, porque o e-mail não se
 * inventa sem trocar de alvo.
 */
export async function ipDaRequisicao(): Promise<string> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  return encaminhado || cabecalhos.get("x-real-ip")?.trim() || "desconhecido";
}

/** As falhas dentro da janela, das duas portas. */
async function falhasRecentes({ email, ip }: { email: string; ip: string }, agora: Date) {
  const desde = new Date(agora.getTime() - JANELA_MIN * 60 * 1000);
  const db = dbAdministrativo();

  const [doEmail, doIp] = await Promise.all([
    db.tentativaLogin.findMany({ where: { email, criadaEm: { gt: desde } }, select: { criadaEm: true } }),
    db.tentativaLogin.findMany({ where: { ip, criadaEm: { gt: desde } }, select: { criadaEm: true } }),
  ]);
  return { doEmail: doEmail.map((t) => t.criadaEm), doIp: doIp.map((t) => t.criadaEm) };
}

/** Até quando o login está fechado para este e-mail ou este IP, ou `null`. */
export async function bloqueioDoLogin(quem: { email: string; ip: string }): Promise<Date | null> {
  const agora = new Date();
  const { doEmail, doIp } = await falhasRecentes(quem, agora);

  const porEmail = liberacao(doEmail, { limite: LIMITE_POR_EMAIL, janelaMin: JANELA_MIN, agora });
  const porIp = liberacao(doIp, { limite: LIMITE_POR_IP, janelaMin: JANELA_MIN, agora });

  // As duas fechadas: vale a que demora mais.
  if (porEmail && porIp) return porEmail > porIp ? porEmail : porIp;
  return porEmail ?? porIp;
}

/**
 * Quantas senhas erradas ainda cabem antes do bloqueio: a porta que estiver
 * mais perto de fechar. Conta igual para e-mail com e sem conta — é a mesma
 * tabela —, então o número não denuncia quais e-mails existem.
 */
export async function tentativasRestantes(quem: { email: string; ip: string }): Promise<number> {
  const agora = new Date();
  const { doEmail, doIp } = await falhasRecentes(quem, agora);
  return Math.min(
    restantes(doEmail, { limite: LIMITE_POR_EMAIL, janelaMin: JANELA_MIN, agora }),
    restantes(doIp, { limite: LIMITE_POR_IP, janelaMin: JANELA_MIN, agora }),
  );
}

export async function registrarFalha({ email, ip }: { email: string; ip: string }): Promise<void> {
  const db = dbAdministrativo();
  await db.tentativaLogin.create({ data: { email, ip } });
  await db.tentativaLogin.deleteMany({
    where: { criadaEm: { lt: new Date(Date.now() - GUARDAR_HORAS * 60 * 60 * 1000) } },
  });
}

/** Login certo, ou senha redefinida: as falhas do e-mail param de contar. */
export async function limparFalhas(email: string): Promise<void> {
  await dbAdministrativo().tentativaLogin.deleteMany({ where: { email } });
}
