import { FileText, Plus, ScrollText } from "lucide-react";

import type { StatusOrcamento } from "@/generated/prisma/enums";
import { Pagina } from "@/components/pagina";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  CorpoLinha,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  Paginacao,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { FiltrosOrcamentos, type FiltroStatusOrcamento } from "./filtros";
import { SeloOrcamento, destinatario } from "./selo";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

/**
 * Quantos por página.
 *
 * A organização de referência tem 163 orçamentos — carregar todos de uma vez
 * é o que deixava a tela lenta para abrir.
 */
const POR_PAGINA = 15;

const STATUS_VALIDOS: FiltroStatusOrcamento[] = ["aberto", "recusado", "aceito"];

/** "Em aberto" cobre Vencido também — quem entra nesses dois ainda não teve
 *  resposta do cliente, é o mesmo balde de "precisa de acompanhamento". */
const STATUS_DO_FILTRO: Record<"aberto" | "recusado" | "aceito", StatusOrcamento[]> = {
  aberto: ["ABERTO", "EXPIRADO"],
  recusado: ["RECUSADO"],
  aceito: ["ACEITO"],
};

export default async function PaginaOrcamentos({ searchParams }: PageProps<"/orcamentos">) {
  const { organizacaoId, db } = await escopoAtual();
  const parametros = await searchParams;
  const pagina = Math.max(1, Number(parametros.pagina) || 1);

  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : "";
  const statusParam = typeof parametros.status === "string" ? parametros.status : "";
  const status: FiltroStatusOrcamento = STATUS_VALIDOS.includes(
    statusParam as FiltroStatusOrcamento,
  )
    ? (statusParam as FiltroStatusOrcamento)
    : "todos";

  const onde = {
    organizacaoId,
    ...(status !== "todos" ? { status: { in: STATUS_DO_FILTRO[status] } } : {}),
    ...(busca
      ? {
          OR: [
            { cliente: { apelido: { contains: busca, mode: "insensitive" as const } } },
            { cliente: { razaoSocial: { contains: busca, mode: "insensitive" as const } } },
            { fornecedor: { nome: { contains: busca, mode: "insensitive" as const } } },
            { clienteAvulsoNome: { contains: busca, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, orcamentos] = await Promise.all([
    db.orcamento.count({ where: onde }),
    db.orcamento.findMany({
      where: onde,
      orderBy: [{ criadoEm: "desc" }, { numero: "desc" }],
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
      include: {
        cliente: { select: { apelido: true } },
        fornecedor: { select: { nome: true } },
        _count: { select: { itens: true, pedidos: true } },
      },
    }),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  /** Mantém busca e status ao trocar de página. */
  const enderecoDaPagina = (destino: number) => {
    const query = new URLSearchParams();
    if (busca) query.set("busca", busca);
    if (status !== "todos") query.set("status", status);
    if (destino > 1) query.set("pagina", String(destino));

    const consulta = query.toString();
    return consulta ? `/orcamentos?${consulta}` : "/orcamentos";
  };

  const algumFiltro = Boolean(busca) || status !== "todos";

  return (
    <Pagina>
      <Cabecalho
        icone={FileText}
        titulo="Orçamentos"
        descricao="A proposta que vai ao cliente antes do pedido. A numeração é do escritório — a indústria não fica sabendo dela."
        acao={
          <BotaoLink href="/orcamentos/novo" icone={Plus}>
            Novo orçamento
          </BotaoLink>
        }
      />

      <FiltrosOrcamentos filtros={{ busca, status }} />

      {total === 0 && !algumFiltro ? (
        <EstadoVazio icone={FileText}>
          Nenhuma proposta lançada.
          <br />
          Comece escolhendo o cliente e a indústria.
        </EstadoVazio>
      ) : total === 0 ? (
        <EstadoVazio
          icone={FileText}
          titulo="Nada encontrado"
          acao={
            <BotaoLink href="/orcamentos" variante="secundaria" tamanho="compacto">
              Limpar filtro
            </BotaoLink>
          }
        >
          Nenhum orçamento corresponde ao que você procurou.
        </EstadoVazio>
      ) : (
        <>
          <Cartao className="divide-y divide-filete overflow-hidden palco">
            {orcamentos.map((orcamento) => {
              const para = destinatario(orcamento);

              return (
                <LinhaLista key={orcamento.id} href={`/orcamentos/${orcamento.id}`}>
                  <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                    <span className="cifra numerico shrink-0 w-16 text-tinta-2">
                      #{orcamento.numero}
                    </span>

                    <CorpoLinha
                      titulo={
                        <>
                          {para.nome}
                          {!para.cadastrado && (
                            <span className="text-mini font-normal text-tinta-3 ml-2">
                              sem cadastro
                            </span>
                          )}
                        </>
                      }
                      detalhe={
                        <>
                          {orcamento.fornecedor.nome} · {orcamento._count.itens} item(ns) ·{" "}
                          {DATA.format(orcamento.criadoEm)}
                          {orcamento._count.pedidos > 0 && (
                            <>
                              {" · "}
                              <span className="inline-flex items-center gap-1 text-verde">
                                <ScrollText size={11} strokeWidth={2} aria-hidden="true" />
                                virou pedido
                              </span>
                            </>
                          )}
                        </>
                      }
                    />
                  </div>

                  <FimDaLinha>
                    <ValorLinha
                      className="w-32"
                      riscado={orcamento.status === "RECUSADO"}
                      valor={formatarMoeda(orcamento.totalGeral.toString())}
                    />
                    <div className="w-24 flex justify-end">
                      <SeloOrcamento status={orcamento.status} />
                    </div>
                  </FimDaLinha>
                </LinhaLista>
              );
            })}
          </Cartao>

          <Paginacao
            pagina={pagina}
            paginas={paginas}
            total={total}
            href={enderecoDaPagina}
            rotuloItem="orçamento"
          />
        </>
      )}
    </Pagina>
  );
}
