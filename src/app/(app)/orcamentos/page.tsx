import { FileText, Plus, ScrollText } from "lucide-react";

import { Pagina } from "@/components/pagina";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  CorpoLinha,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { SeloOrcamento, destinatario } from "./selo";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export default async function PaginaOrcamentos() {
  const { organizacaoId, db } = await escopoAtual();

  const orcamentos = await db.orcamento.findMany({
    where: { organizacaoId },
    orderBy: { criadoEm: "desc" },
    include: {
      cliente: { select: { apelido: true } },
      fornecedor: { select: { nome: true } },
      _count: { select: { itens: true, pedidos: true } },
    },
  });

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

      {orcamentos.length === 0 ? (
        <EstadoVazio icone={FileText}>
          Nenhuma proposta lançada.
          <br />
          Comece escolhendo o cliente e a indústria.
        </EstadoVazio>
      ) : (
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
      )}
    </Pagina>
  );
}
