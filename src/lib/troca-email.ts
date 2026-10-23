import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { dbAdministrativo } from "./db";
import { liberacao } from "./limite-tentativas";

/**
 * A troca do e-mail de login: o link mandado ao endereço NOVO, e a troca por ele.
 *
 * O e-mail é o login e o destino do "Esqueceu sua senha?". Trocado na hora, um
 * erro de digitação trancaria a pessoa fora da conta; por isso ele só muda
 * quando alguém abre o link na caixa nova — o que prova que ela existe e é de
 * quem pediu.
 *
 * Mesmo molde de `redefinicao-senha.ts`: token de 256 bits, o banco guarda só o
 * hash, vale por 1 hora e uma vez, e pedir outro encerra os anteriores.
 */

export const VALIDADE_TROCA_MIN = 60;
export const LIMITE_TROCAS = 3;
export const JANELA_TROCAS_MIN = 60;

export const LINK_TROCA_VENCIDO =
  "Este link venceu ou já foi usado. Entre no sistema e peça outro em Configurações › Perfil.";

function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Até quando novos pedidos estão fechados para este usuário, ou `null`. */
export async function bloqueioDasTrocas(usuarioId: string): Promise<Date | null> {
  const agora = new Date();
  const desde = new Date(agora.getTime() - JANELA_TROCAS_MIN * 60 * 1000);

  const pedidos = await dbAdministrativo().trocaEmail.findMany({
    where: { usuarioId, criadaEm: { gt: desde } },
    select: { criadaEm: true },
  });

  return liberacao(
    pedidos.map((p) => p.criadaEm),
    { janelaMin: JANELA_TROCAS_MIN, agora, limite: LIMITE_TROCAS },
  );
}

/** Registra o pedido e devolve o token que vai no link. */
export async function criarTrocaEmail({
  usuarioId,
  emailNovo,
  ip,
}: {
  usuarioId: string;
  emailNovo: string;
  ip: string;
}): Promise<string> {
  const agora = new Date();
  const token = randomBytes(32).toString("base64url");

  // Pedir de novo encerra os links anteriores: vale só o último e-mail.
  await dbAdministrativo().usuario.update({
    where: { id: usuarioId },
    data: {
      trocasEmail: {
        updateMany: { where: { usadaEm: null }, data: { usadaEm: agora } },
        create: {
          emailNovo,
          ip,
          tokenHash: hashDoToken(token),
          expiraEm: new Date(agora.getTime() + VALIDADE_TROCA_MIN * 60 * 1000),
        },
      },
    },
  });

  return token;
}

/** O pedido ainda em aberto deste usuário — o cartão mostra "aguardando confirmação". */
export async function trocaPendente(usuarioId: string): Promise<string | null> {
  const pedido = await dbAdministrativo().trocaEmail.findFirst({
    where: { usuarioId, usadaEm: null, expiraEm: { gt: new Date() } },
    orderBy: { criadaEm: "desc" },
    select: { emailNovo: true },
  });
  return pedido?.emailNovo ?? null;
}

/** O link ainda serve? Devolve de quem é e para qual e-mail, ou `null`. */
export async function pedidoDoLink(token: string): Promise<{
  usuarioId: string;
  nome: string;
  emailAtual: string;
  emailNovo: string;
} | null> {
  if (!token) return null;

  const pedido = await dbAdministrativo().trocaEmail.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: {
      emailNovo: true,
      usadaEm: true,
      expiraEm: true,
      usuario: {
        select: { id: true, nome: true, email: true, ativo: true, organizacao: { select: { ativa: true } } },
      },
    },
  });

  if (!pedido || pedido.usadaEm || pedido.expiraEm <= new Date()) return null;
  const { usuario } = pedido;
  if (!usuario.ativo || !usuario.organizacao.ativa) return null;
  return { usuarioId: usuario.id, nome: usuario.nome, emailAtual: usuario.email, emailNovo: pedido.emailNovo };
}

/**
 * Troca o e-mail pelo link.
 *
 * `"vencido"` quando o link já não serve; `"em-uso"` quando outra conta pegou o
 * endereço entre o pedido e o clique (o índice único do e-mail recusa).
 *
 * Primeiro TOMA o link, num UPDATE só, como `redefinirPeloLink`: dois cliques
 * ao mesmo tempo não trocam duas vezes. Depois o e-mail novo,
 * `sessaoVersao + 1` — quem estava logado em outro aparelho entra de novo,
 * agora com o e-mail novo — e o fim dos links de senha mandados ao antigo.
 *
 * O caminho inverso também vale: trocar ou redefinir a senha encerra as trocas
 * de e-mail em aberto (`redefinirPeloLink`, `trocarMinhaSenha`).
 */
export async function trocarPeloLink(
  token: string,
): Promise<
  | { ok: true; usuarioId: string; nome: string; emailAntigo: string; emailNovo: string }
  | { ok: false; motivo: "vencido" | "em-uso" }
> {
  const pedido = await pedidoDoLink(token);
  if (!pedido) return { ok: false, motivo: "vencido" };

  const db = dbAdministrativo();
  const agora = new Date();

  const outro = await db.usuario.findUnique({ where: { email: pedido.emailNovo }, select: { id: true } });
  if (outro && outro.id !== pedido.usuarioId) return { ok: false, motivo: "em-uso" };

  const tomado = await db.trocaEmail.updateMany({
    where: { tokenHash: hashDoToken(token), usadaEm: null, expiraEm: { gt: agora } },
    data: { usadaEm: agora },
  });
  if (tomado.count !== 1) return { ok: false, motivo: "vencido" };

  try {
    await db.usuario.update({
      where: { id: pedido.usuarioId },
      data: {
        email: pedido.emailNovo,
        sessaoVersao: { increment: 1 },
        trocasEmail: { updateMany: { where: { usadaEm: null }, data: { usadaEm: agora } } },
        // Os links de "Esqueceu sua senha?" foram para o endereço ANTIGO — que
        // pode ser justamente a caixa que a pessoa perdeu.
        redefinicoesSenha: { updateMany: { where: { usadaEm: null }, data: { usadaEm: agora } } },
      },
    });
  } catch (erro) {
    // P2002: o índice único do e-mail — outra conta levou o endereço agora há pouco.
    if ((erro as { code?: string }).code === "P2002") return { ok: false, motivo: "em-uso" };
    throw erro;
  }

  return {
    ok: true,
    usuarioId: pedido.usuarioId,
    nome: pedido.nome,
    emailAntigo: pedido.emailAtual,
    emailNovo: pedido.emailNovo,
  };
}
