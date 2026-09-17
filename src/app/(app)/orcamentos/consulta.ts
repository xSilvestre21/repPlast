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

import type { StatusOrcamento } from "@/generated/prisma/enums";
import type { DbOrganizacao } from "@/lib/db";
import { formatarMoeda } from "@/components/ui";

import { destinatario } from "./selo";

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
};

export type FatiaDeOrcamentos = {
  linhas: OrcamentoDaLista[];
  /** Se vale a pena pedir a próxima fatia. */
  temMais: boolean;
};

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export async function buscarOrcamentos(
  db: DbOrganizacao,
  organizacaoId: string,
  { busca, status, pagina }: { busca: string; status: FiltroStatusOrcamento; pagina: number },
): Promise<FatiaDeOrcamentos> {
  const procurado = busca.trim();

  const onde = {
    organizacaoId,
    ...(status !== "todos" ? { status: { in: STATUS_DO_FILTRO[status] } } : {}),
    ...(procurado
      ? {
          OR: [
            { cliente: { apelido: { contains: procurado, mode: "insensitive" as const } } },
            { cliente: { razaoSocial: { contains: procurado, mode: "insensitive" as const } } },
            { fornecedor: { nome: { contains: procurado, mode: "insensitive" as const } } },
            { clienteAvulsoNome: { contains: procurado, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  /*
   * Pede uma linha a mais do que cabe na fatia. É o que responde "ainda tem?"
   * sem um `count` — que, com o mesmo `OR` de `ILIKE`, custaria uma segunda
   * varredura a cada tecla digitada.
   */
  const encontrados = await db.orcamento.findMany({
    where: onde,
    orderBy: [{ criadoEm: "desc" }, { numero: "desc" }],
    take: POR_PAGINA + 1,
    skip: pagina * POR_PAGINA,
    include: {
      cliente: { select: { apelido: true, razaoSocial: true } },
      fornecedor: { select: { nome: true } },
      _count: { select: { itens: true, pedidos: true } },
    },
  });

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
    };
  });

  return { linhas, temMais };
}
