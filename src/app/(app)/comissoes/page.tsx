import Link from "next/link";
import { ChevronLeft, ChevronRight, Factory, PiggyBank, Send } from "lucide-react";

import { SeloStatus } from "@/components/selo-status";
import {
  Cabecalho,
  Cartao,
  Emblema,
  EstadoVazio,
  formatarMoeda,
  formatarPercentual,
} from "@/components/ui";
import { competenciaDe, deslocarCompetencia, intervaloDaCompetencia, progressoDaMeta } from "@/lib/comissao";
import {
  pedidosDaCompetencia,
  percentualDoPedido,
  resumirComissao,
} from "@/lib/comissao-consulta";
import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

import { definirMeta } from "./acoes";
import { PainelMeta } from "./painel-meta";
import { Pagina } from "@/components/pagina";

const MES_LONGO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function PaginaComissoes({ searchParams }: PageProps<"/comissoes">) {
  const parametros = await searchParams;
  const competencia =
    typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes)
      ? parametros.mes
      : competenciaDe(new Date());

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);
  const { de } = intervaloDaCompetencia(competencia);

  const [organizacao, pedidos] = await Promise.all([
    dbAdministrativo().organizacao.findUnique({
      where: { id: organizacaoId },
      select: { metaComissaoMensal: true },
    }),
    pedidosDaCompetencia(db, organizacaoId, competencia),
  ]);

  const total = resumirComissao(pedidos);

  // Agrupa por indústria, mantendo a ordem alfabética.
  const porFornecedor = [...Map.groupBy(pedidos, (p) => p.fornecedor.id).entries()]
    .map(([, doFornecedor]) => ({
      fornecedor: doFornecedor[0].fornecedor,
      pedidos: doFornecedor,
      resumo: resumirComissao(doFornecedor),
    }))
    .sort((a, b) => a.fornecedor.nome.localeCompare(b.fornecedor.nome, "pt-BR"));

  const meta = organizacao?.metaComissaoMensal ?? null;
  const progresso = progressoDaMeta(meta?.toString() ?? null, total.valor);

  return (
    <Pagina>
      <Cabecalho
        icone={PiggyBank}
        titulo="Comissões"
        descricao="Conta a partir do envio do pedido; cancelar tira da conta. A meta é sua — não da indústria."
      />

      {/*
        O mês é a legenda da página inteira, não um controle dentro dela: fica
        centralizado em serifada, com as setas discretas de cada lado — como o
        cabeçalho de uma folha de apuração.
      */}
      <div className="flex items-center justify-center gap-5 mb-7">
        <SetaMes competencia={deslocarCompetencia(competencia, -1)} rotulo="Mês anterior">
          <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
        </SetaMes>
        <span className="font-serif text-xl min-w-52 text-center">{nomeDoMes(de)}</span>
        <SetaMes competencia={deslocarCompetencia(competencia, 1)} rotulo="Próximo mês">
          <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </SetaMes>
      </div>

      <PainelMeta
        competencia={competencia}
        meta={meta?.toString() ?? null}
        alcancado={total.valor.toNumber()}
        progresso={progresso?.percentual ?? null}
        batida={progresso?.batida ?? false}
        falta={progresso?.falta.toNumber() ?? null}
        definirMeta={definirMeta}
      />

      {porFornecedor.length === 0 ? (
        <EstadoVazio icone={Send}>
          Nenhum pedido enviado neste mês.
          <br />A comissão passa a contar quando você marca o pedido como enviado.
        </EstadoVazio>
      ) : (
        <div className="space-y-5 palco">
          {porFornecedor.map(({ fornecedor, pedidos: doFornecedor, resumo }) => (
            <Cartao key={fornecedor.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Emblema icone={Factory} tom="fraco" className="size-4" />
                  <div className="min-w-0">
                    <Link
                      href={`/fornecedores/${fornecedor.id}`}
                      className="font-semibold hover:text-carimbo transition-colors"
                    >
                      {fornecedor.nome}
                    </Link>
                    <div className="text-sm text-tinta-2 mt-0.5 numerico">
                      {formatarMoeda(resumo.base.toString())} vendidos ·{" "}
                      {doFornecedor.length} pedido(s)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-extrabold cifra numerico tracking-tight">
                    {formatarMoeda(resumo.valor.toString())}
                  </div>
                  <div className="text-xs text-tinta-3 numerico">
                    {formatarPercentual(resumo.percentualMedio.toString())} sobre a base
                  </div>
                </div>
              </div>

              <div className="rounded-[3px] border border-filete bg-folha divide-y divide-filete">
                {doFornecedor.map((pedido) => (
                  <Link
                    key={pedido.id}
                    href={`/pedidos/${pedido.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-2.5 text-sm hover:bg-folha-2 transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="numerico text-tinta-2">#{pedido.numero}</span>
                      <span className="truncate">{pedido.cliente.apelido}</span>
                      <span className="text-xs text-tinta-3 whitespace-nowrap numerico">
                        {formatarPercentual(percentualDoPedido(pedido))}
                      </span>
                    </span>

                    <span className="flex items-center gap-4 numerico">
                      <span className="text-xs text-tinta-3">
                        {pedido.enviadoEm ? DATA.format(pedido.enviadoEm) : ""}
                      </span>
                      <span>{formatarMoeda(pedido.subtotalSemIpi.toString())}</span>
                      <SeloStatus status={pedido.status} />
                    </span>
                  </Link>
                ))}
              </div>
            </Cartao>
          ))}
        </div>
      )}
    </Pagina>
  );
}

function SetaMes({
  competencia,
  rotulo,
  children,
}: {
  competencia: string;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/comissoes?mes=${competencia}`}
      aria-label={rotulo}
      className="grid place-items-center size-8 text-tinta-3
        transition-colors duration-150 hover:text-carimbo"
    >
      {children}
    </Link>
  );
}

/**
 * "setembro de 2026" com apenas a inicial maiúscula.
 *
 * O `capitalize` do CSS não serve: ele capitaliza toda palavra e produziria
 * "Setembro De 2026".
 */
function nomeDoMes(data: Date): string {
  const nome = MES_LONGO.format(data);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
