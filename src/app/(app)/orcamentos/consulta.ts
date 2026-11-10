/**
 * A consulta da lista de orçamentos, escrita uma vez.
 *
 * Dois caminhos precisam exatamente do mesmo resultado: a página, que desenha a
 * primeira fatia no servidor, e a rota de busca, que entrega as fatias
 * seguintes enquanto a pessoa digita e rola. Escrever o filtro duas vezes seria
 * duas chances de a busca da segunda página não bater com a da primeira.
 *
 * A linha sai daqui pronta para desenhar: dinheiro e data já escritos, porque
 * `Decimal` e `Date` não atravessam para o componente de cliente e porque
 * formatar nos dois lados é como dois formatos diferentes nascem.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { StatusOrcamento } from "@/generated/prisma/enums";
import { prepostosComCor } from "@/lib/cores-prepostos";
import type { DbOrganizacao } from "@/lib/db";
import { fatiaEmCamadas } from "@/lib/fatia-em-camadas";
import { incluirItemAchado, itemAchado, itemProcurado, type ItemAchado } from "@/lib/item-procurado";
import { digitosProcurados, numeroProcurado, numerosQueContem } from "@/lib/numero-procurado";
import { formatarMoeda } from "@/components/ui";

import { destinatario } from "./selo";

export { prepostoDoParametro } from "../clientes/consulta";

/** Quantas linhas por fatia, na primeira e em todas as seguintes. */
export const POR_PAGINA = 20;

export type FiltroStatusOrcamento = "todos" | "aberto" | "recusado" | "aceito";

const STATUS_VALIDOS: FiltroStatusOrcamento[] = ["aberto", "recusado", "aceito"];

/** "Em aberto" cobre Vencido também — quem entra nesses dois ainda não teve
 *  resposta do cliente, é o mesmo balde de "precisa de acompanhamento". */
const STATUS_DO_FILTRO: Record<"aberto" | "recusado" | "aceito", StatusOrcamento[]> = {
  aberto: ["ABERTO", "EXPIRADO"],
  recusado: ["RECUSADO"],
  aceito: ["ACEITO"],
};

export function statusDoParametro(valor: unknown): FiltroStatusOrcamento {
  return typeof valor === "string" && STATUS_VALIDOS.includes(valor as FiltroStatusOrcamento)
    ? (valor as FiltroStatusOrcamento)
    : "todos";
}

/** O que uma linha precisa para se desenhar. */
export type OrcamentoDaLista = {
  id: string;
  numero: number;
  status: string;
  nome: string;
  cadastrado: boolean;
  fornecedor: string;
  itens: number;
  virouPedido: boolean;
  data: string;
  valor: string;
  /** Vazio quando a proposta não foi recusada, ou quando ninguém escreveu. */
  motivoRecusa: string;
  /**
   * O preposto do documento, com a cor dele — só para o administrador, que vê
   * os de todos. Nulo quando é do escritório.
   */
  preposto: { nome: string; cor: string } | null;
  /** O item que a busca achou (`lib/item-procurado.ts`); nulo sem busca ou quando achou por outra coisa. */
  itemAchado: ItemAchado | null;
};

export type FatiaDeOrcamentos = {
  linhas: OrcamentoDaLista[];
  /** Se vale a pena pedir a próxima fatia. */
  temMais: boolean;
  /** Quantos batem com a busca, ao todo. Só na primeira fatia; as seguintes não recontam. */
  quantos?: number;
};

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export async function buscarOrcamentos(
  db: DbOrganizacao,
  organizacaoId: string,
  ehAdmin: boolean,
  {
    busca,
    status,
    preposto,
    pagina,
  }: { busca: string; status: FiltroStatusOrcamento; preposto?: string; pagina: number },
): Promise<FatiaDeOrcamentos> {
  const procurado = busca.trim();
  const digitos = digitosProcurados(procurado);
  const numero = numeroProcurado(procurado);
  const filtroDoItem = itemProcurado(procurado);

  const filtros: Prisma.OrcamentoWhereInput = {
    organizacaoId,
    ...(status !== "todos" ? { status: { in: STATUS_DO_FILTRO[status] } } : {}),
    // O mesmo preposto que a linha mostra: quem fez a proposta, e não o dono da
    // carteira. A que o escritório montou para um cliente dele é do escritório.
    ...(preposto ? { criadoPorId: preposto } : {}),
  };

  /** O que a busca acha fora do número. */
  const outros: Prisma.OrcamentoWhereInput[] = [
    { cliente: { apelido: { contains: procurado, mode: "insensitive" } } },
    { cliente: { razaoSocial: { contains: procurado, mode: "insensitive" } } },
    { fornecedor: { nome: { contains: procurado, mode: "insensitive" } } },
    { clienteAvulsoNome: { contains: procurado, mode: "insensitive" } },
    // O produto, inclusive a linha feita na conta (`lib/item-procurado.ts`).
    ...(filtroDoItem ? [{ itens: { some: filtroDoItem } }] : []),
  ];

  const [numeros, prepostos] = await Promise.all([
    // Os números com o pedaço digitado (`numerosQueContem`). Só quando a busca é número.
    digitos === null
      ? Promise.resolve<number[]>([])
      : db.orcamento
          .groupBy({ by: ["numero"], where: filtros })
          .then((grupos) => numerosQueContem(grupos.map((g) => g.numero), digitos)),
    // O preposto só vê os dele: marcar quem fez seria repetir o óbvio.
    ehAdmin ? prepostosComCor(db, organizacaoId) : Promise.resolve([]),
  ]);

  /*
   * O número antes do resto (`numero-procurado.ts`): o exato, depois os que o
   * têm como pedaço, e só então o que achou pelo cliente, pela indústria ou
   * pelas medidas do item. Disjuntas: a última camada deixa de fora o número
   * que as primeiras já mostraram.
   */
  const exato = numero !== null && numeros.includes(numero);
  const pedacos = numeros.filter((n) => n !== numero);
  const camadas: Prisma.OrcamentoWhereInput[] = !procurado
    ? [filtros]
    : [
        ...(exato ? [{ ...filtros, numero }] : []),
        ...(pedacos.length > 0 ? [{ ...filtros, numero: { in: pedacos } }] : []),
        { ...filtros, ...(numeros.length > 0 ? { numero: { notIn: numeros } } : {}), OR: outros },
      ];
  const onde: Prisma.OrcamentoWhereInput = procurado
    ? { ...filtros, OR: [...(numeros.length > 0 ? [{ numero: { in: numeros } }] : []), ...outros] }
    : filtros;

  /*
   * Pede uma linha a mais do que cabe na fatia. É o que responde "ainda tem?"
   * sem um `count` por fatia — que, com o mesmo `OR` de `ILIKE`, custaria uma
   * segunda varredura a cada fatia rolada. O `count` que existe é o do número
   * do topo, uma vez por busca.
   */
  const [encontrados, quantos] = await Promise.all([
    fatiaEmCamadas(
      camadas,
      { inicio: pagina * POR_PAGINA, quantos: POR_PAGINA + 1 },
      {
        buscar: (where, skip, take) =>
          db.orcamento.findMany({
            where,
            orderBy: [{ criadoEm: "desc" }, { numero: "desc" }],
            take,
            skip,
            include: {
              cliente: { select: { apelido: true, razaoSocial: true } },
              fornecedor: { select: { nome: true } },
              ...incluirItemAchado(filtroDoItem),
              _count: { select: { itens: true, pedidos: true } },
            },
          }),
        contar: (where) => db.orcamento.count({ where }),
      },
    ),
    // Quantos batem ao todo — o número do topo. Só na primeira fatia: rolar não reconta.
    pagina === 0 ? db.orcamento.count({ where: onde }) : undefined,
  ]);
  const porId = new Map(prepostos.map((p) => [p.id, p]));

  const temMais = encontrados.length > POR_PAGINA;

  const linhas = encontrados.slice(0, POR_PAGINA).map((orcamento) => {
    const para = destinatario(orcamento);

    return {
      id: orcamento.id,
      numero: orcamento.numero,
      status: orcamento.status,
      nome: para.nome,
      cadastrado: para.cadastrado,
      fornecedor: orcamento.fornecedor.nome,
      itens: orcamento._count.itens,
      virouPedido: orcamento._count.pedidos > 0,
      data: DATA.format(orcamento.criadoEm),
      valor: formatarMoeda(orcamento.totalGeral.toString()),
      motivoRecusa:
        orcamento.status === "RECUSADO" ? (orcamento.motivoRecusa ?? "") : "",
      // Na proposta, quem a FEZ — é o que decide quem a vê.
      preposto: porId.get(orcamento.criadoPorId ?? "") ?? null,
      itemAchado: itemAchado("itens" in orcamento ? orcamento.itens : undefined),
    };
  });

  return { linhas, temMais, quantos };
}
