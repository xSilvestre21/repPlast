/**
 * O token do cookie de sessão: quem é, e até quando vale.
 *
 * Separado de `sessao.ts` para ser testado sem Next nem banco — o relógio e o
 * segredo chegam por parâmetro.
 *
 * Vale até o primeiro destes:
 *   - 12 horas sem usar — fechar a guia já encerra a sessão (`lib/aba.ts`),
 *     mas isso depende do navegador; este prazo não;
 *   - 30 dias desde o login, mesmo usando todo dia;
 *   - 7 dias sem usar, para quem entrou quando havia "Manter conectado"
 *     (`manter`): tokens daquela época, que somem sozinhos.
 *
 * Era 30 dias fixos: fechar e abrir o app não pedia nada nesse tempo, e um
 * celular esquecido mostrava as comissões a quem pegasse. Cada uso refaz o
 * token com prazo novo (`renovarSessao`), então quem usa sempre não percebe.
 *
 * Os prazos moram DENTRO do token, assinados, e não só no `maxAge` do cookie:
 * quem copia o cookie não estica nada.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

export const INATIVIDADE_MANTER_MS = 7 * DIA_MS;
export const INATIVIDADE_SEM_MANTER_MS = 12 * HORA_MS;
export const TETO_MS = 30 * DIA_MS;
/** Refazer o token a cada clique gravaria cookie à toa; uma vez por hora basta. */
const RENOVAR_DEPOIS_MS = HORA_MS;

export interface TokenLido {
  usuarioId: string;
  versao: number;
  manter: boolean;
  /** Quando foi o login: é dele que conta o teto. */
  inicio: number;
  /** Quando este token foi feito — o último uso que o renovou. */
  emitidoEm: number;
}

function assinar(dados: string, segredo: string): string {
  return createHmac("sha256", segredo).update(dados).digest("base64url");
}

/**
 * Token no formato `payload.assinatura`.
 *
 * `versao` é a `sessaoVersao` do usuário no momento do login: redefinir a
 * senha a soma, e o token velho deixa de bater (`sessaoAtual`).
 */
export function criarToken(
  sessao: { usuarioId: string; versao: number; manter: boolean; inicio: number },
  segredo: string,
  agora: number,
): string {
  const inatividade = sessao.manter ? INATIVIDADE_MANTER_MS : INATIVIDADE_SEM_MANTER_MS;
  const expiraEm = Math.min(agora + inatividade, sessao.inicio + TETO_MS);
  const { usuarioId, versao, manter, inicio } = sessao;
  const dados = Buffer.from(JSON.stringify({ usuarioId, versao, manter, inicio, emitidoEm: agora, expiraEm }))
    .toString("base64url");

  return `${dados}.${assinar(dados, segredo)}`;
}

export function lerToken(token: string, segredo: string, agora: number): TokenLido | null {
  const [dados, assinatura] = token.split(".");
  if (!dados || !assinatura) return null;

  const esperada = Buffer.from(assinar(dados, segredo));
  const recebida = Buffer.from(assinatura);

  // Tempo constante: comparar com `===` vazaria, pelo tempo de resposta,
  // quantos bytes da assinatura o atacante já acertou.
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;

  try {
    const payload = JSON.parse(Buffer.from(dados, "base64url").toString());
    const { usuarioId, expiraEm } = payload;
    if (typeof usuarioId !== "string" || typeof expiraEm !== "number") return null;
    if (agora > expiraEm) return null;
    // Token de antes da versão existir conta como 0: o deploy não desloga ninguém.
    const versao = typeof payload.versao === "number" ? payload.versao : 0;

    if (typeof payload.inicio !== "number") {
      /*
       * Token de antes dos prazos: valia 30 dias a partir do login, e só isso
       * se sabe dele. Continua valendo enquanto o login tiver menos de 7 dias —
       * quem usa o sistema troca pelo novo no primeiro acesso; o celular
       * esquecido há mais tempo pede a senha de novo.
       */
      const emitidoEm = expiraEm - TETO_MS;
      if (agora > emitidoEm + INATIVIDADE_MANTER_MS) return null;
      return { usuarioId, versao, manter: true, inicio: emitidoEm, emitidoEm };
    }

    if (typeof payload.emitidoEm !== "number" || typeof payload.manter !== "boolean") return null;
    return { usuarioId, versao, manter: payload.manter, inicio: payload.inicio, emitidoEm: payload.emitidoEm };
  } catch {
    return null;
  }
}

/** Vale refazer o token agora? Só passada uma hora do último. */
export function precisaRenovar(lido: TokenLido, agora: number): boolean {
  return agora - lido.emitidoEm >= RENOVAR_DEPOIS_MS;
}
