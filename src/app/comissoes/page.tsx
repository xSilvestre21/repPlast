import Link from "next/link";

import { SeloStatus } from "@/components/selo-status";
import {
  Cabecalho,
  Cartao,
  EstadoVazio,
  formatarMoeda,
  formatarPercentual,
} from "@/components/ui";
import { apurar, competenciaDe, intervaloDaCompetencia } from "@/lib/comissao";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

const MES_LONGO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const KG = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export default async function PaginaComissoes({ searchParams }: PageProps<"/comissoes">) {
  const parametros = await searchParams;
  const competencia =
    typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes)
      ? parametros.mes
      : competenciaDe(new Date());

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);
  const { de, ate } = intervaloDaCompetencia(competencia);

  const fornecedores = await db.fornecedor.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { nome: "asc" },
    include: {
      faixas: { orderBy: { minimo: "asc" } },
      apuracoes: { where: { competencia } },
      pedidos: {
        where: { status: "ENVIADO", enviadoEm: { gte: de, lt: ate } },
        orderBy: { enviadoEm: "asc" },
        select: {
          id: true,
          numero: true,
          status: true,
          enviadoEm: true,
          subtotalSemIpi: true,
          comissaoPercentual: true,
          cliente: { select: { apelido: true } },
        },
      },
    },
  });

  const comMovimento = fornecedores.filter(
    (f) => f.pedidos.length > 0 || f.apuracoes.length > 0,
  );

  const totalDoMes = comMovimento.reduce(
    (acc, f) => acc + Number(f.apuracoes[0]?.valorComissao ?? 0),
    0,
  );

  const mesAnterior = deslocarCompetencia(competencia, -1);
  const mesSeguinte = deslocarCompetencia(competencia, 1);

  return (
    <>
      <Cabecalho
        titulo="Comissões"
        descricao="Apuração mensal por indústria. Conta a partir do envio do pedido; cancelar tira da conta."
      />

      <Cartao className="p-5 sm:p-6 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/comissoes?mes=${mesAnterior}`}
              aria-label="Mês anterior"
              className="grid place-items-center size-8 rounded-full border border-borda text-texto-suave hover:text-texto hover:border-borda-forte transition-colors"
            >
              ‹
            </Link>
            <span className="font-medium min-w-40 text-center">{nomeDoMes(de)}</span>
            <Link
              href={`/comissoes?mes=${mesSeguinte}`}
              aria-label="Próximo mês"
              className="grid place-items-center size-8 rounded-full border border-borda text-texto-suave hover:text-texto hover:border-borda-forte transition-colors"
            >
              ›
            </Link>
          </div>

          <div className="text-right">
            <div className="text-xs text-texto-fraco uppercase tracking-wide">
              Total do mês
            </div>
            <div className="text-2xl font-semibold texto-gradiente numerico">
              {formatarMoeda(totalDoMes)}
            </div>
          </div>
        </div>
      </Cartao>

      {comMovimento.length === 0 ? (
        <EstadoVazio>
          Nenhum pedido enviado neste mês.
          <br />A comissão passa a contar quando você marca o pedido como enviado.
        </EstadoVazio>
      ) : (
        <div className="space-y-5">
          {comMovimento.map((fornecedor) => {
            const apuracao = fornecedor.apuracoes[0];
            const emKg = fornecedor.unidadeMeta === "KG";

            const volume = Number(
              emKg ? (apuracao?.baseKg ?? 0) : (apuracao?.baseReais ?? 0),
            );

            // Recalcula só a projeção de faixa para a tela — o valor apurado
            // vem gravado, e é ele que manda.
            const projecao = apurar(
              {
                percentualBase: fornecedor.comissaoPercentual.toString(),
                modo: fornecedor.modoFaixa,
                unidadeMeta: fornecedor.unidadeMeta,
                faixas: fornecedor.faixas.map((f) => ({
                  minimo: f.minimo.toString(),
                  percentual: f.percentual.toString(),
                })),
              },
              { volumeMeta: volume, baseReais: Number(apuracao?.baseReais ?? 0) },
            );

            const formatarVolume = (valor: number) =>
              emKg ? `${KG.format(valor)} kg` : formatarMoeda(valor);

            const progresso = projecao.proximaFaixa
              ? Math.min(100, (volume / Number(projecao.proximaFaixa.minimo)) * 100)
              : 100;

            return (
              <Cartao key={fornecedor.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div>
                    <Link
                      href={`/fornecedores/${fornecedor.id}`}
                      className="font-medium hover:text-acento transition-colors"
                    >
                      {fornecedor.nome}
                    </Link>
                    <div className="text-sm text-texto-suave mt-0.5 numerico">
                      {formatarVolume(volume)} vendidos ·{" "}
                      {fornecedor.pedidos.length} pedido(s)
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-semibold texto-gradiente numerico">
                      {formatarMoeda(apuracao?.valorComissao?.toString() ?? 0)}
                    </div>
                    <div className="text-xs text-texto-fraco numerico">
                      {formatarPercentual(apuracao?.percentualAplicado?.toString() ?? 0)} sobre a
                      base
                    </div>
                  </div>
                </div>

                {projecao.proximaFaixa && projecao.faltaParaProxima && (
                  <div className="mb-5">
                    <div className="flex justify-between text-xs text-texto-suave mb-1.5">
                      <span>
                        Faltam{" "}
                        <strong className="text-texto numerico">
                          {formatarVolume(Number(projecao.faltaParaProxima))}
                        </strong>{" "}
                        para{" "}
                        {formatarPercentual(projecao.proximaFaixa.percentual.toString())}
                      </span>
                      <span className="numerico">
                        {formatarVolume(Number(projecao.proximaFaixa.minimo))}
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-superficie-alta overflow-hidden">
                      <div
                        className="h-full rounded-full fundo-gradiente transition-all duration-500"
                        style={{ width: `${progresso}%` }}
                      />
                    </div>
                  </div>
                )}

                {fornecedor.pedidos.length > 0 && (
                  <div className="rounded-xl border border-borda bg-fundo-elevado divide-y divide-borda">
                    {fornecedor.pedidos.map((pedido) => (
                      <Link
                        key={pedido.id}
                        href={`/pedidos/${pedido.id}`}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-2.5 text-sm hover:bg-superficie-alta transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="numerico text-texto-suave">#{pedido.numero}</span>
                          <span className="truncate">{pedido.cliente.apelido}</span>
                          {pedido.comissaoPercentual && (
                            <span className="text-xs text-aviso whitespace-nowrap">
                              {formatarPercentual(pedido.comissaoPercentual.toString())} combinado
                            </span>
                          )}
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
                )}
              </Cartao>
            );
          })}
        </div>
      )}
    </>
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

/** Anda meses na competência "AAAA-MM" sem depender de fuso. */
function deslocarCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(ano, mes - 1 + meses, 1);

  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}
