import "server-only";

import type { DbOrganizacao } from "@/lib/db";
import { nomeCompleto } from "@/lib/nome-usuario";

/** Um preposto que se pode marcar como quem atende o cliente. */
export type OpcaoDeCarteira = { id: string; nome: string };

type EscopoDaCarteira = { db: DbOrganizacao; organizacaoId: string; ehAdmin: boolean; plano: string };

/**
 * Os prepostos para o campo "Prepostos" do cliente — ou `undefined` quando o
 * campo não deve aparecer: para o preposto (o cliente que ele cadastra é dele,
 * sem escolha) e fora do plano Plus, onde não há preposto nenhum.
 *
 * Quem já atende entra mesmo sem acesso: fora da lista, salvar o cadastro
 * desvincularia o preposto sem ninguém ter desmarcado. `"todos"` traz também os
 * outros sem acesso, para quem só consulta (`filtroDePreposto`).
 */
export async function opcoesDeCarteira(
  escopo: EscopoDaCarteira,
  atuais: string[] | "todos" = [],
): Promise<OpcaoDeCarteira[] | undefined> {
  if (!escopo.ehAdmin || escopo.plano !== "PLUS") return undefined;

  const prepostos = await escopo.db.usuario.findMany({
    where: {
      organizacaoId: escopo.organizacaoId,
      papel: "REPRESENTANTE",
      ...(atuais === "todos" ? {} : { OR: [{ ativo: true }, { id: { in: atuais } }] }),
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

/**
 * O filtro por preposto das listas de clientes, pedidos e orçamentos: as opções
 * e o escolhido entre elas.
 *
 * Quem está sem acesso entra: os clientes e os pedidos dele continuam guardados,
 * e a ficha dele também leva para cá.
 *
 * Escolher só entre as opções descarta de uma vez o que a URL e o cookie podem
 * trazer de errado (texto solto, preposto de outro escritório, um que já saiu).
 * E quem não tem filtro — o preposto, o plano Solo — não tem opção nenhuma: a
 * lista dele abre como sempre abriu.
 */
export async function filtroDePreposto(
  escopo: EscopoDaCarteira,
  parametro: unknown,
): Promise<{ prepostos: OpcaoDeCarteira[]; preposto: string }> {
  const prepostos = (await opcoesDeCarteira(escopo, "todos")) ?? [];
  return { prepostos, preposto: prepostos.find((p) => p.id === parametro)?.id ?? "" };
}
