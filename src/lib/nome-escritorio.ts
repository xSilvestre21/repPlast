import "server-only";

import type { DbOrganizacao } from "./db";
import { ErroDeCampo } from "./erro-formulario";
import { proximaTrocaPermitida } from "./escritorio-regras";

/**
 * O nome do escritório é único entre os escritórios ativos, sem distinguir
 * maiúsculas, acentos e espaços (migração `nome_escritorio_unico`).
 *
 * Duas camadas, cada uma com um trabalho: `nomeEmUso` pergunta antes de gravar,
 * para a recusa sair embaixo do campo; o índice `organizacao_nome_unico` segura
 * os dois cadastros com o mesmo nome no mesmo instante, que a pergunta não
 * pega — e `ehConflitoDeNome` traduz essa recusa para a mesma frase.
 */

/** Qualquer cliente serve: a função do banco vê todos os escritórios, o RLS não a limita. */
type ComQueryRaw = {
  $queryRaw<T>(consulta: TemplateStringsArray, ...valores: unknown[]): Promise<T>;
};

/** Se outro escritório ativo já usa este nome. `exceto`: o próprio, numa troca. */
export async function nomeEmUso(
  db: ComQueryRaw,
  nome: string,
  { exceto }: { exceto?: string } = {},
): Promise<boolean> {
  const [linha] = await db.$queryRaw<{ emUso: boolean }[]>`
    SELECT app_nome_escritorio_em_uso(${nome}, ${exceto ?? null}::uuid) AS "emUso"`;
  return linha?.emUso ?? false;
}

/** A violação do índice do nome — e não de outro único, como o e-mail do usuário. */
export function ehConflitoDeNome(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null) return false;
  if ((erro as { code?: unknown }).code !== "P2002") return false;
  // O nome do índice chega em lugares diferentes conforme o adaptador
  // (`meta.target`, `meta.driverAdapterError`…); procurar no erro inteiro não
  // depende de qual.
  try {
    return JSON.stringify(erro).includes("organizacao_nome_unico");
  } catch {
    return false;
  }
}

export function erroNomeEmUso(campo: string, nome: string): ErroDeCampo {
  return new ErroDeCampo(
    campo,
    `Já existe um escritório chamado “${nome}”. Escolha outro — por exemplo, junte a cidade: ` +
      `“${nome} (sua cidade)”.`,
  );
}

/** O que a tela de troca precisa saber: o nome de agora e quando pode trocar de novo. */
export async function situacaoDoNome(
  db: DbOrganizacao,
  organizacaoId: string,
): Promise<{ nome: string; proximaTroca: Date | null } | null> {
  const [organizacao, ultima] = await Promise.all([
    db.organizacao.findUnique({
      where: { id: organizacaoId },
      select: { nome: true, criadaEm: true },
    }),
    db.trocaNomeEscritorio.findFirst({
      where: { organizacaoId },
      orderBy: { criadaEm: "desc" },
      select: { criadaEm: true },
    }),
  ]);
  if (!organizacao) return null;

  return {
    nome: organizacao.nome,
    proximaTroca: proximaTrocaPermitida({
      criadaEm: organizacao.criadaEm,
      ultimaTroca: ultima?.criadaEm ?? null,
      agora: new Date(),
    }),
  };
}
