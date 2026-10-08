import "server-only";

import { corDoPreposto } from "@/lib/cor-preposto";
import type { DbOrganizacao } from "@/lib/db";
import { nomeCompleto } from "@/lib/nome-usuario";

export interface PrepostoComCor {
  id: string;
  nome: string;
  cor: string;
}

/**
 * Os prepostos do escritório na ordem que decide a cor de cada um — a mesma
 * em Comissões, nos Gráficos e nas listas de pedidos e orçamentos.
 *
 * Os inativos entram de propósito: tirá-los mudaria a cor de quem veio depois.
 * Só o administrador lista prepostos; para o preposto o RLS devolve só ele.
 */
export async function prepostosComCor(
  db: DbOrganizacao,
  organizacaoId: string,
): Promise<PrepostoComCor[]> {
  const prepostos = await db.usuario.findMany({
    where: { organizacaoId, papel: "REPRESENTANTE" },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    select: { id: true, nome: true, sobrenome: true },
  });

  return prepostos.map((u, i) => ({ id: u.id, nome: nomeCompleto(u), cor: corDoPreposto(i) }));
}
