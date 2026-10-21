/**
 * A caixa de e-mail do usuário, pronta para o envio.
 *
 * É o único lugar que decifra a senha. Configurações (testar) e pedido (enviar)
 * passam por aqui, e a senha nunca vai além do objeto `ContaSmtp` que o envio
 * consome — nem para a tela, nem para log.
 */

import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { decifrar } from "./cripto";
import { ErroDeCampo } from "./erro-formulario";
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

/**
 * A assinatura escolhida no envio (`assinaturaId`), em HTML — desta caixa e
 * deste usuário. Escolha vazia é "Sem assinatura": `null`.
 *
 * Id que não acha nada (excluída em outra aba enquanto o diálogo estava
 * aberto) é recusado embaixo da escolha, em vez de mandar sem avisar.
 */
export async function assinaturaEscolhida(
  db: DbOrganizacao,
  usuarioId: string,
  contaId: string,
  formData: FormData,
): Promise<string | null> {
  const assinaturaId = formData.get("assinaturaId");
  if (typeof assinaturaId !== "string" || assinaturaId === "") return null;

  const assinatura = await db.assinaturaEmail.findFirst({
    where: { id: assinaturaId, contaId, usuarioId },
    select: { html: true },
  });
  if (!assinatura) {
    throw new ErroDeCampo(
      "assinaturaId",
      "Esta assinatura não existe mais — ela pode ter sido excluída em Configurações. " +
        "Escolha outra ou “Sem assinatura”.",
    );
  }
  return assinatura.html;
}

/** As assinaturas de uma caixa, a padrão primeiro — para a tela. */
export const ASSINATURAS_DA_CONTA = {
  orderBy: [{ padrao: "desc" }, { criadoEm: "asc" }],
  select: { id: true, nome: true, html: true, padrao: true },
} satisfies Prisma.ContaEmail$assinaturasArgs;

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
  assinaturas: ASSINATURAS_DA_CONTA,
} as const;
