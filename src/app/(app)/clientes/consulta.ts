/**
 * A consulta da lista de clientes, escrita uma vez.
 *
 * Gêmea de `../pedidos/consulta.ts` e `../orcamentos/consulta.ts`, e pelos
 * mesmos motivos: a página desenha a primeira fatia no servidor, a rota de
 * busca entrega as seguintes enquanto a pessoa digita e rola, e as duas
 * precisam do mesmo filtro — escrito aqui, uma vez só.
 */

import type { DbOrganizacao } from "@/lib/db";

/** Quantas linhas por fatia, na primeira e em todas as seguintes. */
export const POR_PAGINA = 20;

/**
 * Ativos é o padrão, como sempre foi: inativo é cliente que parou de comprar
 * e saiu do caminho — continua existindo, com pedidos e histórico, mas não
 * precisa disputar a lista com quem compra hoje.
 */
export type FiltroSituacaoCliente = "ativos" | "inativos" | "todos";

const SITUACOES: FiltroSituacaoCliente[] = ["ativos", "inativos", "todos"];

export function situacaoDoParametro(valor: unknown): FiltroSituacaoCliente {
  return typeof valor === "string" && SITUACOES.includes(valor as FiltroSituacaoCliente)
    ? (valor as FiltroSituacaoCliente)
    : "ativos";
}

/**
 * Os dígitos digitados, com a máscara do CNPJ aplicada do começo.
 *
 * O CNPJ é guardado como se lê — "39.843.059/0001-87" —, e quem cola ou digita
 * só os números ("39843059") não acharia nada procurando o texto cru. Quase
 * sempre se digita do começo, então a máscara é aplicada a partir do primeiro
 * dígito: "3984305" vira "39.843.05".
 */
export function comMascaraDeCnpj(digitos: string): string {
  const marcas: Record<number, string> = { 2: ".", 5: ".", 8: "/", 12: "-" };
  let resultado = "";
  [...digitos.slice(0, 14)].forEach((digito, i) => {
    resultado += (marcas[i] ?? "") + digito;
  });
  return resultado;
}

/** O que uma linha precisa para se desenhar. */
export type ClienteDaLista = {
  id: string;
  apelido: string;
  razaoSocial: string;
  cnpj: string;
  /** "Iracemápolis/SP", ou vazio. */
  local: string;
  pedidos: number;
  ativo: boolean;
};

export type FatiaDeClientes = {
  linhas: ClienteDaLista[];
  /** Se vale a pena pedir a próxima fatia. */
  temMais: boolean;
};

export async function buscarClientes(
  db: DbOrganizacao,
  organizacaoId: string,
  {
    busca,
    situacao,
    pagina,
  }: { busca: string; situacao: FiltroSituacaoCliente; pagina: number },
): Promise<FatiaDeClientes> {
  const procurado = busca.trim();
  const soDigitos = /^[\d.\-/\s]+$/.test(procurado) ? procurado.replace(/\D/g, "") : "";
  const contem = (texto: string) => ({ contains: texto, mode: "insensitive" as const });

  const onde = {
    organizacaoId,
    ...(situacao === "ativos" ? { ativo: true } : situacao === "inativos" ? { ativo: false } : {}),
    ...(procurado
      ? {
          OR: [
            { apelido: contem(procurado) },
            { razaoSocial: contem(procurado) },
            { cnpj: contem(procurado) },
            ...(soDigitos.length >= 3 ? [{ cnpj: contem(comMascaraDeCnpj(soDigitos)) }] : []),
            { municipio: contem(procurado) },
            { email: contem(procurado) },
          ],
        }
      : {}),
  };

  // Uma linha a mais do que cabe: responde "ainda tem?" sem um `count` por tecla.
  const encontrados = await db.cliente.findMany({
    where: onde,
    orderBy: [{ apelido: "asc" }, { id: "asc" }],
    take: POR_PAGINA + 1,
    skip: pagina * POR_PAGINA,
    select: {
      id: true,
      apelido: true,
      razaoSocial: true,
      cnpj: true,
      municipio: true,
      uf: true,
      ativo: true,
      _count: { select: { pedidos: true } },
    },
  });

  return {
    temMais: encontrados.length > POR_PAGINA,
    linhas: encontrados.slice(0, POR_PAGINA).map((cliente) => ({
      id: cliente.id,
      apelido: cliente.apelido,
      razaoSocial: cliente.razaoSocial,
      cnpj: cliente.cnpj ?? "",
      local: cliente.municipio ? `${cliente.municipio}/${cliente.uf ?? ""}` : "",
      pedidos: cliente._count.pedidos,
      ativo: cliente.ativo,
    })),
  };
}
