import Link from "next/link";

import { SeloStatus } from "@/components/selo-status";
import {
  Cabecalho,
  Cartao,
  EstadoVazio,
  formatarMoeda,
  formatarPercentual,
} from "@/components/ui";
import {
  competenciaDe,
  deslocarCompetencia,
  intervaloDaCompetencia,
  progressoDaMeta,
  somarComissao,
} from "@/lib/comissao";
import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

import { definirMeta } from "./acoes";
import { PainelMeta } from "./painel-meta";

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
  const { de, ate } = intervaloDaCompetencia(competencia);

  const [organizacao, pedidos] = await Promise.all([
    dbAdministrativo().organizacao.findUnique({
      where: { id: organizacaoId },
      select: { metaComissaoMensal: true },
    }),
    // A comissão é derivada dos pedidos: o percentual fica congelado em cada um
    // ao ser enviado, então este cálculo é sempre historicamente correto.
    db.pedido.findMany({
      where: { organizacaoId, status: "ENVIADO", enviadoEm: { gte: de, lt: ate } },
      orderBy: { enviadoEm: "asc" },
      select: {
        id: true,
        numero: true,
        status: true,
        enviadoEm: true,
        subtotalSemIpi: true,
        comissaoPercentual: true,
        cliente: { select: { apelido: true } },
        fornecedor: { select: { id: true, nome: true, comissaoPercentual: true } },
      },
    }),
  ]);

  /** Percentual do pedido; cai no da indústria só para dados antigos sem valor. */
  const percentualDe = (pedido: (typeof pedidos)[number]) =>
    (pedido.comissaoPercentual ?? pedido.fornecedor.comissaoPercentual).toString();

  const total = somarComissao(
    pedidos.map((p) => ({ base: p.subtotalSemIpi.toString(), percentual: percentualDe(p) })),
  );

  // Agrupa por indústria, mantendo a ordem alfabética.
  const porFornecedor = [...Map.groupBy(pedidos, (p) => p.fornecedor.id).entries()]
    .map(([, doFornecedor]) => ({
      fornecedor: doFornecedor[0].fornecedor,
      pedidos: doFornecedor,
      resumo: somarComissao(
        doFornecedor.map((p) => ({
          base: p.subtotalSemIpi.toString(),
          percentual: percentualDe(p),
        })),
      ),
    }))
    .sort((a, b) => a.fornecedor.nome.localeCompare(b.fornecedor.nome, "pt-BR"));

  const meta = organizacao?.metaComissaoMensal ?? null;
  const progresso = progressoDaMeta(meta?.toString() ?? null, total.valor);

  return (
    <>
      <Cabecalho
        titulo="Comissões"
        descricao="Conta a partir do envio do pedido; cancelar tira da conta. A meta é sua — não da indústria."
      />

      <Cartao className="p-4 sm:p-5 mb-5">
        <div className="flex items-center justify-center gap-3">
          <SetaMes competencia={deslocarCompetencia(competencia, -1)} rotulo="Mês anterior">
            ‹
          </SetaMes>
          <span className="font-medium min-w-44 text-center">{nomeDoMes(de)}</span>
          <SetaMes competencia={deslocarCompetencia(competencia, 1)} rotulo="Próximo mês">
            ›
          </SetaMes>
        </div>
      </Cartao>

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
        <EstadoVazio>
          Nenhum pedido enviado neste mês.
          <br />A comissão passa a contar quando você marca o pedido como enviado.
        </EstadoVazio>
      ) : (
        <div className="space-y-5">
          {porFornecedor.map(({ fornecedor, pedidos: doFornecedor, resumo }) => (
            <Cartao key={fornecedor.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <Link
                    href={`/fornecedores/${fornecedor.id}`}
                    className="font-medium hover:text-acento transition-colors"
                  >
                    {fornecedor.nome}
                  </Link>
                  <div className="text-sm text-texto-suave mt-0.5 numerico">
                    {formatarMoeda(resumo.base.toString())} vendidos ·{" "}
                    {doFornecedor.length} pedido(s)
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-semibold texto-gradiente numerico">
                    {formatarMoeda(resumo.valor.toString())}
                  </div>
                  <div className="text-xs text-texto-fraco numerico">
                    {formatarPercentual(resumo.percentualMedio.toString())} sobre a base
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-borda bg-fundo-elevado divide-y divide-borda">
                {doFornecedor.map((pedido) => (
                  <Link
                    key={pedido.id}
                    href={`/pedidos/${pedido.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-2.5 text-sm hover:bg-superficie-alta transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="numerico text-texto-suave">#{pedido.numero}</span>
                      <span className="truncate">{pedido.cliente.apelido}</span>
                      <span className="text-xs text-texto-fraco whitespace-nowrap numerico">
                        {formatarPercentual(percentualDe(pedido))}
                      </span>
                    </span>

                    <span className="flex items-center gap-4 numerico">
                      <span className="text-xs text-texto-fraco">
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
    </>
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
      className="grid place-items-center size-8 rounded-full border border-borda text-texto-suave hover:text-texto hover:border-borda-forte transition-colors"
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
