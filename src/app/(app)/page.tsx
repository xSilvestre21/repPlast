import Link from "next/link";
import {
  Inbox,
  Plus,
  Receipt,
  ScrollText,
  TrendingUp,
  UserRoundCheck,
} from "lucide-react";
import type { CSSProperties } from "react";

import { Pagina } from "@/components/pagina";
import { SeloStatus } from "@/components/selo-status";
import { ValorAnimado } from "@/components/valor-animado";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  CartaoMetrica,
  EstadoVazio,
  FaixaMetricas,
  LinhaLista,
  formatarMoeda,
} from "@/components/ui";
import { competenciaDe, progressoDaMeta } from "@/lib/comissao";
import { pedidosDaCompetencia, resumirComissao } from "@/lib/comissao-consulta";
import { clientesSumidos } from "@/lib/positivacao";
import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/** Opções de corte para "sumido". 60 dias é o padrão do ramo. */
const CORTES = [30, 60, 90, 180];
const CORTE_PADRAO = 60;

export default async function Painel({ searchParams }: PageProps<"/">) {
  const parametros = await searchParams;
  const dias = CORTES.includes(Number(parametros.dias)) ? Number(parametros.dias) : CORTE_PADRAO;

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);
  const competencia = competenciaDe(new Date());

  const [organizacao, doMes, recentes, clientes] = await Promise.all([
    dbAdministrativo().organizacao.findUnique({
      where: { id: organizacaoId },
      select: { metaComissaoMensal: true },
    }),

    pedidosDaCompetencia(db, organizacaoId, competencia),

    db.pedido.findMany({
      where: { organizacaoId },
      orderBy: { criadoEm: "desc" },
      take: 6,
      select: {
        id: true,
        numero: true,
        status: true,
        criadoEm: true,
        totalGeral: true,
        cliente: { select: { apelido: true } },
        fornecedor: { select: { nome: true } },
      },
    }),

    // Só quem já comprou pode ter sumido: cliente cadastrado e nunca atendido
    // é assunto de prospecção, não de positivação.
    db.cliente.findMany({
      where: { organizacaoId, ativo: true, pedidos: { some: { status: "ENVIADO" } } },
      select: {
        id: true,
        apelido: true,
        razaoSocial: true,
        pedidos: {
          where: { status: "ENVIADO" },
          orderBy: { enviadoEm: "desc" },
          take: 1,
          select: { enviadoEm: true, totalGeral: true },
        },
      },
    }),
  ]);

  const resumo = resumirComissao(doMes);
  const meta = organizacao?.metaComissaoMensal ?? null;
  const progresso = progressoDaMeta(meta?.toString() ?? null, resumo.valor);

  const ticketMedio = doMes.length > 0 ? resumo.base.dividedBy(doMes.length) : null;

  /*
   * Um único instante para toda a página.
   *
   * A regra de pureza do React existe por causa de componentes de cliente, que
   * podem re-renderizar e produzir valores diferentes a cada vez. Este é um
   * componente de SERVIDOR e a rota é dinâmica: ele roda uma vez por
   * requisição, e "quantos dias sem comprar" depende justamente de agora.
   */
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  const sumidos = clientesSumidos(
    clientes.map((cliente) => ({
      id: cliente.id,
      apelido: cliente.apelido,
      ultimaCompra: cliente.pedidos[0]?.enviadoEm ?? null,
      ultimoValor: cliente.pedidos[0]?.totalGeral ?? null,
    })),
    dias,
    agora,
  );

  return (
    <Pagina>
      <Cabecalho
        titulo="Painel"
        descricao="O mês em uma tela: o que você já ganhou, quem parou de comprar e o que entrou por último."
        acao={
          <BotaoLink href="/pedidos/novo" icone={Plus}>
            Novo pedido
          </BotaoLink>
        }
      />

      <div className="palco space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* O número que a pessoa abriu o sistema para ver                    */}
        {/* ---------------------------------------------------------------- */}
        <Link href="/comissoes" className="block realcavel">
          <Cartao marcada className="px-6 py-7 sm:px-8 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-end gap-7 sm:gap-10">
              <div className="min-w-0 flex-1">
                <span className="rotulo">Comissão de {MES.format(new Date())}</span>

                <div className="cifra text-[2.75rem] sm:text-[4rem] leading-[0.95] mt-3">
                  <ValorAnimado valor={resumo.valor.toNumber()} />
                </div>

                <p className="text-sm text-tinta-2 mt-3 numerico">
                  {formatarMoeda(resumo.base.toString())} vendidos em {doMes.length} pedido
                  {doMes.length === 1 ? "" : "s"}
                </p>
              </div>

              {progresso && (
                // A meta encosta no valor por um filete em vez de flutuar na
                // outra ponta: são o mesmo assunto, e o vão entre elas lia como
                // duas seções diferentes.
                <div className="w-full sm:w-56 shrink-0 sm:border-l sm:border-filete sm:pl-10">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`rotulo ${progresso.batida ? "text-verde" : ""}`}>
                      {progresso.batida ? "Meta batida" : "Sua meta"}
                    </span>
                    <span
                      className={`numerico text-xs font-semibold ${
                        progresso.batida ? "text-verde" : "text-tinta"
                      }`}
                    >
                      {Math.round(progresso.percentual)}%
                    </span>
                  </div>

                  <div className="h-1.5 mt-2 bg-folha-2 border border-filete overflow-hidden">
                    <div
                      // A barra cresce de zero até o valor: o preenchimento
                      // mostra o progresso acontecendo, não só o resultado.
                      style={{ "--alvo": `${progresso.percentual}%` } as CSSProperties}
                      className={`barra-preenche h-full ${
                        progresso.batida ? "bg-verde" : "bg-tinta"
                      }`}
                    />
                  </div>

                  <p className="text-xs text-tinta-2 mt-2 numerico">
                    {progresso.batida
                      ? `${formatarMoeda(progresso.meta.toString())} — alcançada`
                      : `Faltam ${formatarMoeda(progresso.falta.toString())}`}
                  </p>
                </div>
              )}
            </div>
          </Cartao>
        </Link>

        {/* ---------------------------------------------------------------- */}
        {/* Os números de apoio, separados por filete                         */}
        {/* ---------------------------------------------------------------- */}
        <FaixaMetricas>
          <CartaoMetrica
            rotulo="Vendido no mês"
            icone={TrendingUp}
            valor={formatarMoeda(resumo.base.toString())}
            detalhe="Base da comissão, sem IPI e sem frete"
          />
          <CartaoMetrica
            rotulo="Pedidos enviados"
            icone={ScrollText}
            valor={doMes.length}
            detalhe={
              doMes.length > 0
                ? `Comissão média de ${resumo.percentualMedio.toDecimalPlaces(2)}%`
                : "Nenhum pedido enviado neste mês"
            }
            href="/pedidos"
          />
          <CartaoMetrica
            rotulo="Ticket médio"
            icone={Receipt}
            valor={ticketMedio ? formatarMoeda(ticketMedio.toString()) : "—"}
            detalhe="Valor médio por pedido enviado no mês"
          />
        </FaixaMetricas>

        {/* ---------------------------------------------------------------- */}
        {/* As duas listas                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="rotulo text-tinta">Clientes sumidos</h2>

              <div className="flex items-center gap-3">
                {CORTES.map((opcao) => (
                  <Link
                    key={opcao}
                    href={opcao === CORTE_PADRAO ? "/" : `/?dias=${opcao}`}
                    aria-current={opcao === dias ? "true" : undefined}
                    className={`text-xs numerico transition-colors ${
                      opcao === dias
                        ? "text-carimbo font-semibold underline underline-offset-4 decoration-carimbo"
                        : "text-tinta-3 hover:text-tinta"
                    }`}
                  >
                    {opcao}d
                  </Link>
                ))}
              </div>
            </div>

            {sumidos.length === 0 ? (
              <EstadoVazio icone={UserRoundCheck}>
                Ninguém sumido há mais de {dias} dias. Bom sinal.
              </EstadoVazio>
            ) : (
              <Cartao className="divide-y divide-filete overflow-hidden">
                {sumidos.slice(0, 8).map(({ cliente, ultimaCompra, diasSemComprar }) => (
                  <LinhaLista key={cliente.id} href={`/clientes/${cliente.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{cliente.apelido}</div>
                      <div className="text-xs text-tinta-3 truncate mt-0.5 numerico">
                        {DATA.format(ultimaCompra)}
                        {cliente.ultimoValor
                          ? ` · ${formatarMoeda(cliente.ultimoValor.toString())}`
                          : null}
                      </div>
                    </div>

                    {/*
                      O número de dias é o dado, e o "dias" é a legenda. Em
                      serifada ele vira número de novo, e não etiqueta colorida.
                    */}
                    <div className="text-right shrink-0">
                      <span
                        className={`cifra text-lg leading-none ${
                          diasSemComprar >= dias * 2 ? "text-carimbo" : "text-tinta"
                        }`}
                      >
                        {diasSemComprar}
                      </span>
                      <span className="text-xs text-tinta-3 ml-1">dias</span>
                    </div>
                  </LinhaLista>
                ))}
              </Cartao>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="rotulo text-tinta">Pedidos recentes</h2>
              <BotaoLink href="/pedidos" variante="secundaria" className="text-xs py-1 px-3">
                Ver todos
              </BotaoLink>
            </div>

            {recentes.length === 0 ? (
              <EstadoVazio icone={Inbox}>Nenhum pedido lançado ainda.</EstadoVazio>
            ) : (
              <Cartao className="divide-y divide-filete overflow-hidden">
                {recentes.map((pedido) => (
                  <LinhaLista key={pedido.id} href={`/pedidos/${pedido.id}`}>
                    <div className="flex items-baseline gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                      <span className="font-mono text-xs text-tinta-3 shrink-0">
                        {pedido.numero}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{pedido.cliente.apelido}</div>
                        <div className="text-xs text-tinta-3 truncate">
                          {pedido.fornecedor.nome}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div
                          className={`numerico text-sm ${
                            pedido.status === "CANCELADO"
                              ? "text-tinta-3 line-through"
                              : "text-tinta font-medium"
                          }`}
                        >
                          {formatarMoeda(pedido.totalGeral.toString())}
                        </div>
                        <div className="text-xs text-tinta-3 numerico">
                          {DATA.format(pedido.criadoEm)}
                        </div>
                      </div>
                      <SeloStatus status={pedido.status} />
                    </div>
                  </LinhaLista>
                ))}
              </Cartao>
            )}
          </section>
        </div>
      </div>
    </Pagina>
  );
}
