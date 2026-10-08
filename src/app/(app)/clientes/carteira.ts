import "server-only";

import type { DbOrganizacao } from "@/lib/db";
import { nomeCompleto } from "@/lib/nome-usuario";

/** Um preposto que se pode marcar como quem atende o cliente. */
export type OpcaoDeCarteira = { id: string; nome: string };

/**
 * Os prepostos para o campo "Prepostos" do cliente — ou `undefined` quando o
 * campo não deve aparecer: para o preposto (o cliente que ele cadastra é dele,
 * sem escolha) e fora do plano Plus, onde não há preposto nenhum.
 *
 * Quem já atende entra mesmo sem acesso: fora da lista, salvar o cadastro
 * desvincularia o preposto sem ninguém ter desmarcado.
 */
export async function opcoesDeCarteira(
  escopo: { db: DbOrganizacao; organizacaoId: string; ehAdmin: boolean; plano: string },
  atuais: string[] = [],
): Promise<OpcaoDeCarteira[] | undefined> {
  if (!escopo.ehAdmin || escopo.plano !== "PLUS") return undefined;

  const prepostos = await escopo.db.usuario.findMany({
    where: {
      organizacaoId: escopo.organizacaoId,
      papel: "REPRESENTANTE",
      OR: [{ ativo: true }, { id: { in: atuais } }],
    },
    orderBy: [{ nome: "asc" }, { sobrenome: "asc" }],
    select: { id: true, nome: true, sobrenome: true, ativo: true },
  });

  if (prepostos.length === 0) return undefined;

  return prepostos.map((p) => ({
    id: p.id,
    nome: p.ativo ? nomeCompleto(p) : `${nomeCompleto(p)} (sem acesso)`,
  }));
}
