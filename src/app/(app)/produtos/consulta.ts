/**
 * A consulta da lista de produtos, escrita uma vez.
 *
 * Gêmea de `../clientes/consulta.ts`, `../pedidos/consulta.ts` e
 * `../orcamentos/consulta.ts`: a página desenha a primeira fatia no servidor, a
 * rota de busca entrega as seguintes enquanto a pessoa digita e rola, e as duas
 * precisam do mesmo filtro — escrito aqui, uma vez só.
 */

import type { DbOrganizacao } from "@/lib/db";
import { lerNumeroBr } from "@/lib/numero-br";
import { precoMilheiroSaco } from "@/lib/precificacao";

/** Quantas linhas por fatia, na primeira e em todas as seguintes. */
export const POR_PAGINA = 20;

/** Ativos é o padrão: produto inativo continua existindo, só sai do caminho. */
export type FiltroSituacaoProduto = "ativos" | "inativos" | "todos";

const SITUACOES: FiltroSituacaoProduto[] = ["ativos", "inativos", "todos"];

export function situacaoDoParametro(valor: unknown): FiltroSituacaoProduto {
  return typeof valor === "string" && SITUACOES.includes(valor as FiltroSituacaoProduto)
    ? (valor as FiltroSituacaoProduto)
    : "ativos";
}

/**
 * O que a lista filtra. As medidas ficam como foram digitadas ("0,055"): é
 * assim que voltam para o campo e para a URL.
 */
export type FiltrosProduto = {
  busca: string;
  larguraCm: string;
  comprimentoCm: string;
  espessuraMm: string;
  situacao: FiltroSituacaoProduto;
};

/** Lê os filtros de uma URL — a da página ou a da rota de busca. */
export function filtrosDosParametros(ler: (nome: string) => unknown): FiltrosProduto {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  return {
    busca: texto(ler("busca")),
    larguraCm: texto(ler("l")),
    comprimentoCm: texto(ler("c")),
    espessuraMm: texto(ler("e")),
    situacao: situacaoDoParametro(ler("situacao")),
  };
}

/** O que uma linha precisa para se desenhar. */
export type ProdutoDaLista = {
  id: string;
  descricao: string;
  familia: string;
  cliente: string | null;
  fornecedor: string;
  codigoFornecedor: string | null;
  codigoCliente: string | null;
  ativo: boolean;
  /** Preço de referência, na unidade em que o produto é vendido. */
  preco: { valor: number; unidade: string } | null;
};

export type FatiaDeProdutos = {
  linhas: ProdutoDaLista[];
  /** Se vale a pena pedir a próxima fatia. */
  temMais: boolean;
};

/*
 * A medida entra como texto brasileiro ("0,055") e o banco guarda Decimal.
 * `lerNumeroBr` é a mesma função que o formulário usa, então digitar aqui e
 * digitar lá acham o mesmo produto.
 */
function medida(valor: string) {
  if (!valor) return undefined;
  const numero = lerNumeroBr(valor);
  return numero === null ? undefined : numero;
}

export async function buscarProdutos(
  db: DbOrganizacao,
  organizacaoId: string,
  { pagina, ...filtros }: FiltrosProduto & { pagina: number },
): Promise<FatiaDeProdutos> {
  const termo = filtros.busca.trim();
  const contem = (texto: string) => ({ contains: texto, mode: "insensitive" as const });
  const { situacao } = filtros;

  const onde = {
    organizacaoId,
    ...(situacao === "ativos" ? { ativo: true } : situacao === "inativos" ? { ativo: false } : {}),
    larguraCm: medida(filtros.larguraCm),
    comprimentoCm: medida(filtros.comprimentoCm),
    espessuraMm: medida(filtros.espessuraMm),
    /*
     * A busca alcança o CLIENTE e a INDÚSTRIA, não só a descrição.
     *
     * É como se procura na prática — "o que eu vendo para a Flexopet?" — e era
     * o comportamento do sistema anterior. Sem isso, um catálogo com quatro
     * linhas `90x160x0,055 SF 12 PEAD` não tem como ser desempatado.
     */
    ...(termo
      ? {
          OR: [
            { descricao: contem(termo) },
            { material: contem(termo) },
            { complemento: contem(termo) },
            { codigoFornecedor: contem(termo) },
            { cliente: { apelido: contem(termo) } },
            { cliente: { razaoSocial: contem(termo) } },
            { fornecedor: { nome: contem(termo) } },
            { codigoCliente: contem(termo) },
          ],
        }
      : {}),
  };

  // Uma linha a mais do que cabe: responde "ainda tem?" sem um `count` por tecla.
  const encontrados = await db.produto.findMany({
    where: onde,
    // Por DESCRIÇÃO, como no sistema anterior: é ela que a pessoa tem na
    // cabeça. Agrupar por indústria escondia que o mesmo saco existe para
    // três clientes, porque as três linhas caíam longe uma da outra.
    orderBy: [{ descricao: "asc" }, { id: "asc" }],
    take: POR_PAGINA + 1,
    skip: pagina * POR_PAGINA,
    include: {
      fornecedor: { select: { nome: true } },
      cliente: { select: { apelido: true } },
      aditivos: { include: { aditivo: true } },
    },
  });

  /** Preço de referência do produto, na unidade em que ele é vendido. */
  function precoDe(produto: (typeof encontrados)[number]) {
    if (produto.familia === "SACO") {
      if (!produto.larguraCm || !produto.comprimentoCm || !produto.espessuraMm || !produto.fatorKg) {
        return null;
      }

      const preco = precoMilheiroSaco({
        larguraCm: produto.larguraCm.toString(),
        comprimentoCm: produto.comprimentoCm.toString(),
        espessuraMm: produto.espessuraMm.toString(),
        densidade: produto.densidade ? produto.densidade.toString() : null,
        fatorKg: produto.fatorKg.toString(),
        aditivos: produto.aditivos.map(({ aditivo }) => ({
          nome: aditivo.nome,
          sufixoDescricao: aditivo.sufixoDescricao,
          tipo: aditivo.tipo,
          valor: aditivo.valor.toString(),
        })),
      });

      return { valor: preco.toNumber(), unidade: produto.unidadeRotulo ?? "milheiro" };
    }

    if (produto.familia === "FITA") {
      if (produto.precoCaixa) return { valor: Number(produto.precoCaixa), unidade: "caixa" };
      if (produto.precoUnidade) return { valor: Number(produto.precoUnidade), unidade: "unidade" };
      return null;
    }

    if (produto.familia === "AVULSO") {
      return produto.precoAvulso
        ? { valor: Number(produto.precoAvulso), unidade: produto.unidadeRotulo ?? "unidade" }
        : null;
    }

    return produto.precoKg ? { valor: Number(produto.precoKg), unidade: "kg" } : null;
  }

  return {
    temMais: encontrados.length > POR_PAGINA,
    linhas: encontrados.slice(0, POR_PAGINA).map((produto) => ({
      id: produto.id,
      descricao: produto.descricao,
      familia: produto.familia,
      cliente: produto.cliente?.apelido ?? null,
      fornecedor: produto.fornecedor.nome,
      codigoFornecedor: produto.codigoFornecedor,
      codigoCliente: produto.codigoCliente,
      ativo: produto.ativo,
      preco: precoDe(produto),
    })),
  };
}
