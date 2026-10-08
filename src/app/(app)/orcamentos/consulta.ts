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
import { prepostosComCor } from "@/lib/cores-prepostos";
import type { DbOrganizacao } from "@/lib/db";
import { numeroProcurado } from "@/lib/numero-procurado";
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
  /** Vazio quando a proposta não foi recusada, ou quando ninguém escreveu. */
  motivoRecusa: string;
  /**
   * O preposto do documento, com a cor dele — só para o administrador, que vê
   * os de todos. Nulo quando é do escritório.
   */
  preposto: { nome: string; cor: string } | null;
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
  ehAdmin: boolean,
  { busca, status, pagina }: { busca: string; status: FiltroStatusOrcamento; pagina: number },
): Promise<FatiaDeOrcamentos> {
  const procurado = busca.trim();
  const numero = numeroProcurado(procurado);

  const onde = {
    organizacaoId,
    ...(status !== "todos" ? { status: { in: STATUS_DO_FILTRO[status] } } : {}),
    ...(procurado
      ? {
          OR: [
            // Primeiro o número: digitar dígitos quase sempre é procurar por ele.
            // Some da consulta quando o que se digitou não é número.
            ...(numero !== null ? [{ numero }] : []),
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
  const [encontrados, prepostos] = await Promise.all([
    db.orcamento.findMany({
    where: onde,
    orderBy: [{ criadoEm: "desc" }, { numero: "desc" }],
    take: POR_PAGINA + 1,
    skip: pagina * POR_PAGINA,
    include: {
      cliente: { select: { apelido: true, razaoSocial: true } },
      fornecedor: { select: { nome: true } },
      _count: { select: { itens: true, pedidos: true } },
    },
    }),
    // O preposto só vê os dele: marcar quem fez seria repetir o óbvio.
    ehAdmin ? prepostosComCor(db, organizacaoId) : Promise.resolve([]),
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
    };
  });

  return { linhas, temMais };
}
