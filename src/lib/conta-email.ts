/**
 * A caixa de e-mail do usuário, pronta para o envio.
 *
 * É o único lugar que decifra a senha. Configurações (testar) e pedido (enviar)
 * passam por aqui, e a senha nunca vai além do objeto `ContaSmtp` que o envio
 * consome — nem para a tela, nem para log.
 */

import "server-only";

import { decifrar } from "./cripto";
import type { DbOrganizacao } from "./db";
import type { ContaSmtp } from "./email";

/**
 * A conta, se for DESTE usuário.
 *
 * A policy de `conta_email` já esconde a de outra pessoa; o `usuarioId` no
 * `where` é a segunda camada, como em todo o resto (ver `lib/db.ts`).
 */
export async function contaParaEnvio(
  db: DbOrganizacao,
  usuarioId: string,
  contaId: string,
): Promise<(ContaSmtp & { id: string }) | null> {
  const conta = await db.contaEmail.findFirst({ where: { id: contaId, usuarioId } });
  if (!conta) return null;

  return {
    id: conta.id,
    email: conta.email,
    nomeExibicao: conta.nomeExibicao,
    host: conta.host,
    porta: conta.porta,
    tlsDireto: conta.tlsDireto,
    usuarioSmtp: conta.usuarioSmtp,
    senha: decifrar(conta.senhaCifrada),
  };
}

/** O que a tela pode saber de uma conta: tudo, menos a senha. */
export const CAMPOS_PUBLICOS_CONTA = {
  id: true,
  provedor: true,
  email: true,
  nomeExibicao: true,
  host: true,
  porta: true,
  tlsDireto: true,
  usuarioSmtp: true,
  padrao: true,
  testadaEm: true,
} as const;
