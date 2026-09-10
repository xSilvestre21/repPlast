/**
 * Sessão do usuário.
 *
 * O cookie guarda apenas um token assinado com HMAC — nunca dados de confiança.
 * Quem manda é o banco: o token diz "sou o usuário X", e a organização é
 * carregada de lá a cada requisição. Assim, desativar um usuário tem efeito
 * imediato, sem esperar o cookie expirar.
 *
 * Também é aqui que vive `organizacaoAtual()`, que todo acesso a dados usa
 * para se limitar ao escritório certo.
 */

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";

import { dbAdministrativo } from "./db";

const COOKIE = "repplast_sessao";
const DURACAO_DIAS = 30;

export interface Sessao {
  usuarioId: string;
  organizacaoId: string;
  nome: string;
  email: string;
}

function segredo(): string {
  const valor = process.env.SESSAO_SECRET;

  if (!valor || valor.length < 32) {
    throw new Error(
      "SESSAO_SECRET ausente ou curta demais. Defina no .env uma chave aleatória de pelo menos 32 caracteres — sem ela o login não é seguro.",
    );
  }
  return valor;
}

function assinar(dados: string): string {
  return createHmac("sha256", segredo()).update(dados).digest("base64url");
}

/** Token no formato `payload.assinatura`, com o vencimento dentro do payload. */
function criarToken(usuarioId: string): string {
  const expiraEm = Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000;
  const dados = Buffer.from(JSON.stringify({ usuarioId, expiraEm })).toString("base64url");

  return `${dados}.${assinar(dados)}`;
}

function lerToken(token: string): string | null {
  const [dados, assinatura] = token.split(".");
  if (!dados || !assinatura) return null;

  const esperada = Buffer.from(assinar(dados));
  const recebida = Buffer.from(assinatura);

  // Tempo constante: comparar com `===` vazaria, pelo tempo de resposta,
  // quantos bytes da assinatura o atacante já acertou.
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;

  try {
    const { usuarioId, expiraEm } = JSON.parse(Buffer.from(dados, "base64url").toString());
    if (typeof usuarioId !== "string" || typeof expiraEm !== "number") return null;
    if (Date.now() > expiraEm) return null;

    return usuarioId;
  } catch {
    return null;
  }
}

/**
 * Sessão da requisição, ou `null` quando não há.
 *
 * `cache` do React garante uma única ida ao banco por requisição, mesmo que
 * várias partes da página perguntem quem está logado.
 */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const usuarioId = lerToken(token);
  if (!usuarioId) return null;

  // O cliente administrativo é necessário aqui: ainda não sabemos a qual
  // escritório o usuário pertence, então não há escopo de tenant a aplicar.
  const usuario = await dbAdministrativo().usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nome: true,
      email: true,
      organizacaoId: true,
      organizacao: { select: { ativa: true } },
    },
  });

  if (!usuario || !usuario.organizacao.ativa) return null;

  return {
    usuarioId: usuario.id,
    organizacaoId: usuario.organizacaoId,
    nome: usuario.nome,
    email: usuario.email,
  };
});

/**
 * Escritório da requisição.
 *
 * LANÇA quando não há sessão, em vez de redirecionar: quem decide o que fazer
 * é quem chamou — uma página redireciona para o login, uma rota de API devolve
 * 401. Também evita que um esquecimento vire acesso a dados de outro tenant.
 */
export async function organizacaoAtual(): Promise<string> {
  const sessao = await sessaoAtual();

  if (!sessao) throw new Error("Sem sessão. Faça login para continuar.");
  return sessao.organizacaoId;
}

export async function criarSessao(usuarioId: string): Promise<void> {
  (await cookies()).set(COOKIE, criarToken(usuarioId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
