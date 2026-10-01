/**
 * A consulta da lista de produtos, escrita uma vez.
 *
 * Gêmea de `../clientes/consulta.ts`, `../pedidos/consulta.ts` e
 * `../orcamentos/consulta.ts`: a página desenha a primeira fatia no servidor, a
 * rota de busca entrega as seguintes enquanto a pessoa digita e rola, e as duas
 * precisam do mesmo filtro — escrito aqui, uma vez só.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { DbOrganizacao } from "@/lib/db";
import { lerNumeroBr } from "@/lib/numero-br";
import { precoUnitario, unidadeDoRotulo } from "@/lib/produto-preco";

import { faixasDoPrefixo } from "./prefixo-medida";

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

export type CampoMedida = "larguraCm" | "comprimentoCm" | "espessuraMm";

const CAMPOS_MEDIDA: CampoMedida[] = ["larguraCm", "comprimentoCm", "espessuraMm"];

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
  /**
   * A medida que ainda está sendo digitada, que casa pelo COMEÇO e não pelo
   * valor exato (ver `prefixo-medida.ts`). Só a busca enquanto se digita manda
   * isto: a URL da página guarda o filtro em repouso, que é o exato.
   */
  digitando?: CampoMedida | null;
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
    digitando: CAMPOS_MEDIDA.find((campo) => campo === ler("digitando")) ?? null,
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

/** A condição de uma medida: exata em repouso, pelo começo enquanto se digita. */
function condicaoDeMedida(
  campo: CampoMedida,
  valor: string,
  digitando: boolean,
): Prisma.ProdutoWhereInput | null {
  if (!digitando) {
    const exata = medida(valor);
    return exata === undefined ? null : { [campo]: exata };
  }

  const faixas = faixasDoPrefixo(valor);
  return faixas ? { OR: faixas.map((faixa) => ({ [campo]: faixa })) } : null;
}

export async function buscarProdutos(
  db: DbOrganizacao,
  organizacaoId: string,
  { pagina, ...filtros }: FiltrosProduto & { pagina: number },
): Promise<FatiaDeProdutos> {
  const termo = filtros.busca.trim();
  const contem = (texto: string) => ({ contains: texto, mode: "insensitive" as const });
  const { situacao } = filtros;

  const porMedida = CAMPOS_MEDIDA.flatMap((campo) => {
    const condicao = condicaoDeMedida(campo, filtros[campo], filtros.digitando === campo);
    return condicao ? [condicao] : [];
  });

  const onde: Prisma.ProdutoWhereInput = {
    organizacaoId,
    ...(situacao === "ativos" ? { ativo: true } : situacao === "inativos" ? { ativo: false } : {}),
    // Em AND porque cada medida pelo começo já é um OR de faixas, e o OR da
    // busca por texto logo abaixo ocupa a chave de cima.
    ...(porMedida.length > 0 ? { AND: porMedida } : {}),
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

      // Vendido por quilo, o preço é o do kg — mostrar o milheiro com o
      // rótulo "por KG" dizia um preço que ninguém cobra.
      const porKg = unidadeDoRotulo(produto.unidadeRotulo) === "KG";

      const preco = precoUnitario(
        {
          familia: "SACO",
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
        },
        porKg ? "KG" : "MIL",
      );
      if (!preco) return null;

      return {
        valor: preco.toNumber(),
        unidade: porKg ? "kg" : (produto.unidadeRotulo ?? "milheiro"),
      };
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
