import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { dbAdministrativo } from "./db";
import { liberacao } from "./limite-tentativas";

/**
 * "Esqueceu sua senha?": o link por e-mail e a troca da senha por ele.
 *
 * O link leva um token aleatório de 256 bits; o banco guarda só o HASH dele
 * (`redefinicao_senha.tokenHash`), então quem lê o banco não consegue usá-lo.
 * Vale por 1 hora e uma vez: usar, ou pedir outro, encerra os anteriores.
 *
 * Nada aqui pode denunciar se um e-mail tem conta: o pedido para e-mail sem
 * conta também grava uma linha (sem usuário nem token) e conta no limite, e a
 * tela responde igual nos dois casos.
 */

export const VALIDADE_MIN = 60;

/** A frase do link que não serve mais — na página que o abre e na ação que o usa. */
export const LINK_VENCIDO =
  "Este link venceu ou já foi usado. Peça outro em “Esqueceu sua senha?” — ele chega em instantes.";
export const LIMITE_PEDIDOS_POR_EMAIL = 3;
export const LIMITE_PEDIDOS_POR_IP = 10;
export const JANELA_PEDIDOS_MIN = 60;

function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Até quando novos pedidos estão fechados para este e-mail ou IP, ou `null`. */
export async function bloqueioDosPedidos({ email, ip }: { email: string; ip: string }): Promise<Date | null> {
  const agora = new Date();
  const desde = new Date(agora.getTime() - JANELA_PEDIDOS_MIN * 60 * 1000);
  const db = dbAdministrativo();

  const [doEmail, doIp] = await Promise.all([
    db.redefinicaoSenha.findMany({ where: { email, criadaEm: { gt: desde } }, select: { criadaEm: true } }),
    db.redefinicaoSenha.findMany({ where: { ip, criadaEm: { gt: desde } }, select: { criadaEm: true } }),
  ]);

  const regra = { janelaMin: JANELA_PEDIDOS_MIN, agora };
  const porEmail = liberacao(doEmail.map((p) => p.criadaEm), { ...regra, limite: LIMITE_PEDIDOS_POR_EMAIL });
  const porIp = liberacao(doIp.map((p) => p.criadaEm), { ...regra, limite: LIMITE_PEDIDOS_POR_IP });

  if (porEmail && porIp) return porEmail > porIp ? porEmail : porIp;
  return porEmail ?? porIp;
}

/**
 * Registra o pedido e, se o e-mail é de uma conta que pode entrar, cria o link.
 *
 * Devolve o que o e-mail precisa — ou `null` quando não há a quem mandar
 * (e-mail sem conta, usuário desativado, escritório desativado). Quem chama
 * responde a mesma coisa nos dois casos.
 */
export async function criarRedefinicao({
  email,
  ip,
}: {
  email: string;
  ip: string;
}): Promise<{ para: string; nome: string; token: string } | null> {
  const db = dbAdministrativo();
  const agora = new Date();

  const usuario = await db.usuario.findUnique({
    where: { email },
    select: { id: true, nome: true, email: true, ativo: true, organizacao: { select: { ativa: true } } },
  });

  if (!usuario || !usuario.ativo || !usuario.organizacao.ativa) {
    // Só para contar no limite: sem usuário, sem token, vencida de nascença.
    await db.redefinicaoSenha.create({ data: { email, ip, expiraEm: agora } });
    return null;
  }

  const token = randomBytes(32).toString("base64url");

  // Pedir de novo encerra os links anteriores: vale só o último e-mail.
  await db.usuario.update({
    where: { id: usuario.id },
    data: {
      redefinicoesSenha: {
        updateMany: { where: { usadaEm: null }, data: { usadaEm: agora } },
        create: {
          email,
          ip,
          tokenHash: hashDoToken(token),
          expiraEm: new Date(agora.getTime() + VALIDADE_MIN * 60 * 1000),
        },
      },
    },
  });

  return { para: usuario.email, nome: usuario.nome, token };
}

/** O link ainda serve? Devolve a quem ele pertence, ou `null`. */
export async function donoDoLink(
  token: string,
): Promise<{ usuarioId: string; email: string; nome: string } | null> {
  if (!token) return null;

  const pedido = await dbAdministrativo().redefinicaoSenha.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: {
      usadaEm: true,
      expiraEm: true,
      usuario: {
        select: { id: true, email: true, nome: true, ativo: true, organizacao: { select: { ativa: true } } },
      },
    },
  });

  const usuario = pedido?.usuario;
  if (!pedido || !usuario || pedido.usadaEm || pedido.expiraEm <= new Date()) return null;
  if (!usuario.ativo || !usuario.organizacao.ativa) return null;
  return { usuarioId: usuario.id, email: usuario.email, nome: usuario.nome };
}

/**
 * Troca a senha pelo link. `false` quando o link já não serve.
 *
 * Primeiro TOMA o link (marca como usado só se ainda não estava, num UPDATE
 * só): dois cliques ao mesmo tempo não trocam a senha duas vezes. Depois, numa
 * escrita só, a senha nova, `sessaoVersao + 1` — que derruba toda sessão aberta
 * com a senha antiga —, o encerramento dos outros links e o das trocas de
 * e-mail em aberto (`lib/troca-email.ts`). Se esta segunda parte
 * falhar, o link já foi gasto e a senha continua a antiga: pede-se outro.
 */
export async function redefinirPeloLink(
  token: string,
  senhaHash: string,
): Promise<{ email: string; nome: string } | null> {
  const dono = await donoDoLink(token);
  if (!dono) return null;

  const db = dbAdministrativo();
  const agora = new Date();

  const tomado = await db.redefinicaoSenha.updateMany({
    where: { tokenHash: hashDoToken(token), usadaEm: null, expiraEm: { gt: agora } },
    data: { usadaEm: agora },
  });
  if (tomado.count !== 1) return null;

  await db.usuario.update({
    where: { id: dono.usuarioId },
    data: {
      senhaHash,
      // Criada por ele pelo link: deixa de ser a inicial que o administrador conhece.
      senhaProvisoria: false,
      sessaoVersao: { increment: 1 },
      redefinicoesSenha: { updateMany: { where: { usadaEm: null }, data: { usadaEm: agora } } },
      // Quem redefine a senha pode estar retomando a conta: uma troca de e-mail
      // pedida com a senha antiga (por quem a descobriu) não pode sobreviver.
      trocasEmail: { updateMany: { where: { usadaEm: null }, data: { usadaEm: agora } } },
    },
  });

  return { email: dono.email, nome: dono.nome };
}
