/**
 * A consulta da lista de fornecedores, escrita uma vez.
 *
 * Gêmea de `../clientes/consulta.ts`: a página desenha a primeira fatia no
 * servidor, a rota de busca entrega as seguintes enquanto a pessoa digita e
 * rola, e as duas precisam do mesmo filtro — escrito aqui, uma vez só.
 */

import type { DbOrganizacao } from "@/lib/db";
import { soIndustriasMarcadas } from "@/lib/industrias-do-ator";

// O CNPJ da indústria é guardado do mesmo jeito que o do cliente, então quem
// digita só os números precisa da mesma máscara para achar.
import { comMascaraDeCnpj, type FiltroSituacaoCliente } from "../clientes/consulta";

/**
 * Ativas é o padrão, como nos clientes: indústria inativa é representação que
 * acabou — continua existindo, com pedidos e produtos, só sai do caminho.
 */
export type FiltroSituacaoFornecedor = FiltroSituacaoCliente;

export { situacaoDoParametro } from "../clientes/consulta";

/** Quantas linhas por fatia, na primeira e em todas as seguintes. */
export const POR_PAGINA = 20;

/** O que uma linha precisa para se desenhar. */
export type FornecedorDaLista = {
  id: string;
  nome: string;
  produtos: number;
  aditivos: number;
  /** Os percentuais como texto do Decimal ("9.750"): o JSON não perde casa. */
  ipiPercentual: string;
  comissaoPercentual: string;
  ativo: boolean;
};

export type FatiaDeFornecedores = {
  linhas: FornecedorDaLista[];
  /** Se vale a pena pedir a próxima fatia. */
  temMais: boolean;
};

export async function buscarFornecedores(
  db: DbOrganizacao,
  organizacaoId: string,
  ator: { ehAdmin: boolean; usuarioId: string },
  {
    busca,
    situacao,
    pagina,
  }: { busca: string; situacao: FiltroSituacaoFornecedor; pagina: number },
): Promise<FatiaDeFornecedores> {
  const procurado = busca.trim();
  const soDigitos = /^[\d.\-/\s]+$/.test(procurado) ? procurado.replace(/\D/g, "") : "";
  const contem = (texto: string) => ({ contains: texto, mode: "insensitive" as const });

  const onde = {
    organizacaoId,
    ...soIndustriasMarcadas(ator),
    ...(situacao === "ativos" ? { ativo: true } : situacao === "inativos" ? { ativo: false } : {}),
    ...(procurado
      ? {
          OR: [
            { nome: contem(procurado) },
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
  const encontrados = await db.fornecedor.findMany({
    where: onde,
    orderBy: [{ nome: "asc" }, { id: "asc" }],
    take: POR_PAGINA + 1,
    skip: pagina * POR_PAGINA,
    select: {
      id: true,
      nome: true,
      ipiPercentual: true,
      comissaoPercentual: true,
      ativo: true,
      _count: { select: { produtos: true, aditivos: true } },
    },
  });

  return {
    temMais: encontrados.length > POR_PAGINA,
    linhas: encontrados.slice(0, POR_PAGINA).map((fornecedor) => ({
      id: fornecedor.id,
      nome: fornecedor.nome,
      produtos: fornecedor._count.produtos,
      aditivos: fornecedor._count.aditivos,
      ipiPercentual: fornecedor.ipiPercentual.toString(),
      comissaoPercentual: fornecedor.comissaoPercentual.toString(),
      ativo: fornecedor.ativo,
    })),
  };
}
