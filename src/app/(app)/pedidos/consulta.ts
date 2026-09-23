/**
 * A consulta da lista de pedidos, escrita uma vez.
 *
 * Dois caminhos precisam exatamente do mesmo resultado: a página, que desenha a
 * primeira fatia no servidor, e a rota de busca, que entrega as fatias
 * seguintes enquanto a pessoa digita e rola. Escrever o filtro duas vezes seria
 * duas chances de a busca da segunda página não bater com a da primeira.
 *
 * A linha sai daqui pronta para desenhar: dinheiro e data já escritos, porque
 * `Decimal` e `Date` não atravessam para o componente de cliente e porque
 * formatar nos dois lados é como dois formatos diferentes nascem.
 *
 * Gêmea de `../orcamentos/consulta.ts`, e de propósito — as duas listas são a
 * mesma ideia sobre documentos diferentes.
 */

import type { StatusPedido } from "@/generated/prisma/enums";
import type { DbOrganizacao } from "@/lib/db";
import { numeroProcurado } from "@/lib/numero-procurado";
import { formatarMoeda } from "@/components/ui";

/** Quantas linhas por fatia, na primeira e em todas as seguintes. */
export const POR_PAGINA = 20;

export type FiltroStatusPedido = "todos" | "aberto" | "enviado" | "cancelado";

const STATUS_VALIDOS: FiltroStatusPedido[] = ["aberto", "enviado", "cancelado"];

/**
 * Um para um com o enum do banco.
 *
 * Diferente do orçamento, onde "Em aberto" precisa cobrir VENCIDO junto: lá os
 * dois querem dizer "o cliente ainda não respondeu". Aqui cada estado é ele
 * mesmo, e o filtro é pelo ENUM e não pelas datas — `enviadoEm` sobrevive ao
 * cancelamento de propósito (ver `mudarStatus` em `acoes.ts`), então filtrar
 * por data traria pedido cancelado dentro de "enviados".
 */
const STATUS_DO_FILTRO: Record<"aberto" | "enviado" | "cancelado", StatusPedido> = {
  aberto: "ABERTO",
  enviado: "ENVIADO",
  cancelado: "CANCELADO",
};

export function statusDoParametro(valor: unknown): FiltroStatusPedido {
  return typeof valor === "string" && STATUS_VALIDOS.includes(valor as FiltroStatusPedido)
    ? (valor as FiltroStatusPedido)
    : "todos";
}

/** O que uma linha precisa para se desenhar. */
export type PedidoDaLista = {
  id: string;
  numero: number;
  status: string;
  cliente: string;
  fornecedor: string;
  itens: number;
  data: string;
  valor: string;
  /** A ordem de compra que o CLIENTE emitiu. Vazio quando ele não usa uma. */
  pedidoDoCliente: string;
  /** Vazio quando o pedido não foi cancelado, ou quando ninguém escreveu. */
  motivoCancelamento: string;
};

export type FatiaDePedidos = {
  linhas: PedidoDaLista[];
  /** Se vale a pena pedir a próxima fatia. */
  temMais: boolean;
};

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export async function buscarPedidos(
  db: DbOrganizacao,
  organizacaoId: string,
  { busca, status, pagina }: { busca: string; status: FiltroStatusPedido; pagina: number },
): Promise<FatiaDePedidos> {
  const procurado = busca.trim();
  const numero = numeroProcurado(procurado);

  const onde = {
    organizacaoId,
    ...(status !== "todos" ? { status: STATUS_DO_FILTRO[status] } : {}),
    ...(procurado
      ? {
          OR: [
            // Primeiro o número: digitar dígitos quase sempre é procurar por ele.
            // Some da consulta quando o que se digitou não é número.
            ...(numero !== null ? [{ numero }] : []),
            { cliente: { apelido: { contains: procurado, mode: "insensitive" as const } } },
            { cliente: { razaoSocial: { contains: procurado, mode: "insensitive" as const } } },
            { fornecedor: { nome: { contains: procurado, mode: "insensitive" as const } } },
            /*
             * O número que vem de FORA do escritório.
             *
             * É por ele que o cliente e a indústria se referem ao pedido no
             * telefone — o nosso número eles nem sempre têm à mão.
             */
            { pedidoDoCliente: { contains: procurado, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  /*
   * Pede uma linha a mais do que cabe na fatia. É o que responde "ainda tem?"
   * sem um `count` — que, com o mesmo `OR` de `ILIKE`, custaria uma segunda
   * varredura a cada tecla digitada.
   */
  const encontrados = await db.pedido.findMany({
    where: onde,
    orderBy: [{ criadoEm: "desc" }, { numero: "desc" }],
    take: POR_PAGINA + 1,
    skip: pagina * POR_PAGINA,
    include: {
      cliente: { select: { apelido: true } },
      fornecedor: { select: { nome: true } },
      _count: { select: { itens: true } },
    },
  });

  const temMais = encontrados.length > POR_PAGINA;

  const linhas = encontrados.slice(0, POR_PAGINA).map((pedido) => ({
    id: pedido.id,
    numero: pedido.numero,
    status: pedido.status,
    cliente: pedido.cliente.apelido,
    fornecedor: pedido.fornecedor.nome,
    itens: pedido._count.itens,
    data: DATA.format(pedido.criadoEm),
    valor: formatarMoeda(pedido.totalGeral.toString()),
    pedidoDoCliente: pedido.pedidoDoCliente ?? "",
    // Só no cancelado: reabrir não apaga o texto, e mostrá-lo num pedido que
    // voltou a valer seria contar uma história que deixou de ser verdade.
    motivoCancelamento:
      pedido.status === "CANCELADO" ? (pedido.motivoCancelamento ?? "") : "",
  }));

  return { linhas, temMais };
}
