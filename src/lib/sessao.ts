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

import { cache } from "react";
import { cookies } from "next/headers";

import { type Ator, dbAdministrativo, dbParaOrganizacao } from "./db";
import { ErroParaUsuario } from "./erro-formulario";
import { nomeCompleto } from "./nome-usuario";
import { COOKIE_ENTROU } from "./aba";
import { criarToken, lerToken, precisaRenovar, type TokenLido } from "./token-sessao";

/**
 * Sem sessão no meio de uma ação: o cookie venceu com a tela aberta. Entrar
 * de novo em OUTRA aba preserva o formulário desta, que ainda está preenchido.
 */
const SESSAO_EXPIRADA =
  "Sua sessão expirou. Abra o sistema em outra aba, entre de novo e volte aqui para salvar — " +
  "assim o que você digitou não se perde.";

/**
 * Assinatura não paga no meio de uma ação: a tela estava aberta quando a
 * cobrança venceu. As páginas nem chegam aqui — o layout leva a `/assinatura`.
 */
const ASSINATURA_PENDENTE =
  "A assinatura do escritório não está em dia, e por isso não dá para salvar agora. Abra o " +
  "sistema em outra aba para ver o que falta e regularizar.";

const COOKIE = "repplast_sessao";

export interface Sessao {
  usuarioId: string;
  organizacaoId: string;
  nome: string;
  email: string;
  papel: "ADMIN" | "REPRESENTANTE";
  /// Plano do escritório. Decide se as telas de preposto existem.
  plano: "PADRAO" | "PLUS";
  /// Só ATIVA usa o sistema; o resto vai para `/assinatura`.
  assinatura: "AGUARDANDO_PAGAMENTO" | "ATIVA" | "ATRASADA" | "CANCELADA";
  /// Nome do escritório, para exibir no lugar do nome do produto na barra.
  organizacaoNome: string;
  /// Preferência de conta que substitui `prefers-reduced-motion` do sistema.
  reduzirAnimacoes: boolean;
  /// O Painel troca os valores em reais por uma máscara.
  ocultarValores: boolean;
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

/** O token do cookie desta requisição, já conferido — ou `null`. */
async function tokenAtual(): Promise<TokenLido | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? lerToken(token, segredo(), Date.now()) : null;
}

/**
 * Grava o cookie com um token novo.
 *
 * Cookie de sessão, sem `maxAge`: some ao fechar o navegador inteiro. Fechar
 * só a guia, ou o app no celular, não o apaga — disso cuida `lib/aba.ts`.
 */
async function gravarCookie(sessao: { usuarioId: string; versao: number; manter: boolean; inicio: number }) {
  (await cookies()).set(COOKIE, criarToken(sessao, segredo(), Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/**
 * Sessão da requisição, ou `null` quando não há.
 *
 * `cache` do React garante uma única ida ao banco por requisição, mesmo que
 * várias partes da página perguntem quem está logado.
 */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const lido = await tokenAtual();
  if (!lido) return null;
  const { usuarioId } = lido;

  // O cliente administrativo é necessário aqui: ainda não sabemos a qual
  // escritório o usuário pertence, então não há escopo de tenant a aplicar.
  const usuario = await dbAdministrativo().usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nome: true,
      sobrenome: true,
      email: true,
      organizacaoId: true,
      papel: true,
      ativo: true,
      sessaoVersao: true,
      reduzirAnimacoes: true,
      ocultarValores: true,
      organizacao: { select: { nome: true, ativa: true, plano: true, assinatura: true } },
    },
  });

  // Desativar um preposto tem efeito na requisição seguinte, e não quando o
  // cookie dele vencer — é o mesmo motivo de a organização ser relida aqui.
  if (!usuario || !usuario.ativo || !usuario.organizacao.ativa) return null;
  // A senha foi redefinida depois deste login: a sessão é da senha antiga.
  if (usuario.sessaoVersao !== lido.versao) return null;

  return {
    usuarioId: usuario.id,
    organizacaoId: usuario.organizacaoId,
    // O nome inteiro: é o que o menu mostra e o que as telas assinam.
    nome: nomeCompleto(usuario),
    email: usuario.email,
    papel: usuario.papel,
    plano: usuario.organizacao.plano,
    assinatura: usuario.organizacao.assinatura,
    organizacaoNome: usuario.organizacao.nome,
    reduzirAnimacoes: usuario.reduzirAnimacoes,
    ocultarValores: usuario.ocultarValores,
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
  return (await sessaoComAssinatura()).organizacaoId;
}

/**
 * A sessão de quem pode TRABALHAR: logado e com a assinatura em dia. `null`
 * em qualquer outro caso.
 *
 * É o guarda das rotas de arquivo (PDF, exportação, busca), que não passam por
 * layout e respondem 401 em vez de lançar.
 */
export async function sessaoComAcesso(): Promise<Sessao | null> {
  const sessao = await sessaoAtual();
  return sessao?.assinatura === "ATIVA" ? sessao : null;
}

/**
 * Para onde vai quem já está logado: o sistema, ou a tela de pagamento.
 *
 * Mandar para "/" quem não pagou NÃO basta o layout redirecionar: no App Router
 * o layout e a página rodam juntos, e a página inicial lança
 * `ASSINATURA_PENDENTE` antes de o redirecionamento do layout valer — a tela
 * fica carregando para sempre. Por isso as telas de entrada já mandam direto.
 */
export function inicioDa(sessao: { assinatura: Sessao["assinatura"] }): "/" | "/assinatura" {
  return sessao.assinatura === "ATIVA" ? "/" : "/assinatura";
}

/**
 * A sessão, exigindo a assinatura em dia.
 *
 * O bloqueio mora AQUI, e não só no layout, porque as rotas de arquivo (PDF,
 * exportação) e as ações não passam por layout: sem ele, quem não pagou ainda
 * baixaria o PDF montando a URL à mão.
 */
async function sessaoComAssinatura(): Promise<Sessao> {
  const sessao = await sessaoAtual();

  if (!sessao) throw new ErroParaUsuario(SESSAO_EXPIRADA);
  if (sessao.assinatura !== "ATIVA") throw new ErroParaUsuario(ASSINATURA_PENDENTE);
  return sessao;
}

/**
 * O banco já no escopo de quem está pedindo — escritório E usuário.
 *
 * É o atalho que a aplicação inteira deve usar. Existe para que ninguém precise
 * lembrar de juntar as duas coisas na mão: montar o cliente sem o ator é um
 * erro de compilação (ver `dbParaOrganizacao`), e montá-lo com o ator errado só
 * seria possível indo buscar outra sessão de propósito.
 */
export async function escopoAtual(): Promise<{
  organizacaoId: string;
  usuarioId: string;
  papel: Ator["papel"];
  ehAdmin: boolean;
  plano: Sessao["plano"];
  db: ReturnType<typeof dbParaOrganizacao>;
}> {
  const sessao = await sessaoComAssinatura();

  return {
    organizacaoId: sessao.organizacaoId,
    usuarioId: sessao.usuarioId,
    papel: sessao.papel,
    ehAdmin: sessao.papel === "ADMIN",
    plano: sessao.plano,
    db: dbParaOrganizacao(sessao.organizacaoId, {
      usuarioId: sessao.usuarioId,
      papel: sessao.papel,
    }),
  };
}

/** Exige papel de administrador. Lança quando não é — as ações a usam de porteiro. */
export async function exigirAdmin(): Promise<void> {
  const sessao = await sessaoAtual();

  if (!sessao) throw new ErroParaUsuario(SESSAO_EXPIRADA);
  if (sessao.papel !== "ADMIN") {
    throw new ErroParaUsuario(
      "Só quem administra o escritório pode fazer isso. Peça a essa pessoa, ou entre com a conta de administrador.",
    );
  }
}

/**
 * Abre a sessão — ou a refaz, quando a `sessaoVersao` subiu (troca de senha ou
 * de e-mail com a pessoa logada).
 *
 * Refeita, o teto de 30 dias continua contando do login: trocar a senha não
 * pode estender a sessão. Aberta agora, grava também o `COOKIE_ENTROU`, que
 * marca esta guia como a que fez login (`lib/aba.ts`) — legível pelo
 * JavaScript de propósito, e só diz que houve login, nada de quem.
 */
export async function criarSessao(usuarioId: string): Promise<void> {
  const usuario = await dbAdministrativo().usuario.findUnique({
    where: { id: usuarioId },
    select: { sessaoVersao: true },
  });
  const atual = await tokenAtual();
  const continua = atual?.usuarioId === usuarioId ? atual : null;

  await gravarCookie({
    usuarioId,
    versao: usuario?.sessaoVersao ?? 0,
    manter: false,
    inicio: continua?.inicio ?? Date.now(),
  });

  if (!continua) {
    (await cookies()).set(COOKIE_ENTROU, "1", {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
  }
}

/**
 * Usar o sistema estica a sessão (`/api/sessao`, chamada ao abrir o app).
 *
 * Só depois de uma hora do último token, para não gravar cookie a cada
 * clique. Devolve se havia sessão — sem ela, nada a renovar.
 */
export async function renovarSessao(): Promise<boolean> {
  const lido = await tokenAtual();
  if (!lido) return false;
  // `manter: false` também para quem entrou quando havia "Manter conectado".
  if (precisaRenovar(lido, Date.now())) await gravarCookie({ ...lido, manter: false });
  return true;
}

export async function encerrarSessao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
