import Link from "next/link";
import {
  Inbox,
  Plus,
  Receipt,
  ScrollText,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
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
  Chip,
  EstadoVazio,
  FaixaMetricas,
  LinhaLista,
  Placa,
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

      {/*
        O palco cobre só o que está acima da dobra.

        Os dois blocos de baixo saem dele de propósito: eles se revelam ao
        ROLAR, e uma cascata de entrada somada a uma revelação de rolagem faria
        o mesmo bloco animar duas vezes no primeiro segundo.
      */}
      <div className="palco space-y-5">
        {/* ---------------------------------------------------------------- */}
        {/* O número que a pessoa abriu o sistema para ver                    */}
        {/* ---------------------------------------------------------------- */}
        <Link href="/comissoes" className="block">
          <Cartao marcada className="elevavel px-6 py-8 sm:px-10 sm:py-11">
            <div className="flex flex-col lg:flex-row lg:items-end gap-9 lg:gap-14">
              <div className="min-w-0 flex-1">
                {/*
                  O ponto verde pulsa porque a competência está ABERTA: este
                  número ainda vai mudar hoje. Parado, ele seria só um enfeite
                  redondo ao lado de um rótulo.
                */}
                <Chip>
                  <span className="pulso" aria-hidden="true" />
                  Comissão de {MES.format(new Date())}
                </Chip>

                {/*
                  Quatro vezes e meia o tamanho do corpo de texto. É esse salto
                  — e não a cor — que faz o olho pousar aqui antes de tudo.
                */}
                <div className="cifra text-[2.75rem] sm:text-[4rem] lg:text-[4.5rem] leading-[0.92] mt-5">
                  <ValorAnimado valor={resumo.valor.toNumber()} />
                </div>

                <p className="text-[0.9375rem] text-tinta-2 mt-4 numerico">
                  {formatarMoeda(resumo.base.toString())} vendidos em {doMes.length} pedido
                  {doMes.length === 1 ? "" : "s"}
                </p>
              </div>

              {progresso && (
                <div className="w-full lg:w-64 shrink-0">
                  <div className="flex items-center gap-2.5 mb-4">
                    <Placa icone={Target} tom={progresso.batida ? "menta" : "neutro"} pequena />
                    {/*
                      O marca-texto amarelo, uma vez por tela. Ele fica guardado
                      para o único momento em que a tela tem uma notícia: a meta
                      do mês saiu do lugar de "faltam tantos" e virou fato.
                    */}
                    {progresso.batida ? (
                      <span className="marcador text-sm font-semibold">Meta batida</span>
                    ) : (
                      <span className="rotulo">Sua meta</span>
                    )}
                    <span
                      className={`numerico text-sm font-bold ml-auto ${
                        progresso.batida ? "text-verde" : "text-tinta"
                      }`}
                    >
                      {Math.round(progresso.percentual)}%
                    </span>
                  </div>

                  <div className="h-2.5 rounded-full bg-folha-2 overflow-hidden">
                    <div
                      // A barra cresce de zero até o valor: o preenchimento
                      // mostra o progresso acontecendo, não só o resultado.
                      style={{ "--alvo": `${progresso.percentual}%` } as CSSProperties}
                      className={`barra-preenche h-full rounded-full ${
                        progresso.batida ? "bg-verde" : "bg-tinta"
                      }`}
                    />
                  </div>

                  <p className="text-[0.8125rem] text-tinta-2 mt-3 numerico">
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
        {/* Os números de apoio                                               */}
        {/* ---------------------------------------------------------------- */}
        <FaixaMetricas>
          <CartaoMetrica
            rotulo="Vendido no mês"
            icone={TrendingUp}
            tom="menta"
            valor={formatarMoeda(resumo.base.toString())}
            detalhe="Base da comissão, sem IPI e sem frete"
          />
          <CartaoMetrica
            rotulo="Pedidos enviados"
            icone={ScrollText}
            tom="mar"
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
            tom="sol"
            valor={ticketMedio ? formatarMoeda(ticketMedio.toString()) : "—"}
            detalhe="Valor médio por pedido enviado no mês"
          />
        </FaixaMetricas>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* As duas listas — cada uma se monta quando sobe na tela              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-5 lg:grid-cols-2 items-start mt-5">
        <section className="revelar">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 px-1">
            <div className="flex items-center gap-2.5">
              <Placa icone={Users} tom="pessego" pequena />
              <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
                Clientes sumidos
              </h2>
            </div>

            {/*
              Controle segmentado: a opção ativa é a única pastilha branca com
              sombra, e o trilho cinza em volta mostra as outras três sem
              precisar abrir nada.
            */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-folha-2 border border-filete">
              {CORTES.map((opcao) => (
                <Link
                  key={opcao}
                  href={opcao === CORTE_PADRAO ? "/" : `/?dias=${opcao}`}
                  aria-current={opcao === dias ? "true" : undefined}
                  className={`px-2.5 py-1 rounded-full text-xs numerico font-semibold transition-all duration-150 ${
                    opcao === dias
                      ? "bg-folha text-tinta shadow-[var(--sombra-sm)]"
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
                    <div className="font-semibold truncate">{cliente.apelido}</div>
                    <div className="text-xs text-tinta-3 truncate mt-0.5 numerico">
                      {DATA.format(ultimaCompra)}
                      {cliente.ultimoValor
                        ? ` · ${formatarMoeda(cliente.ultimoValor.toString())}`
                        : null}
                    </div>
                  </div>

                  {/*
                    Passou do dobro do corte, o número fica vermelho. É perda
                    iminente, não um link — por isso vermelho e não azul.
                  */}
                  <div className="text-right shrink-0">
                    <span
                      className={`cifra text-xl leading-none ${
                        diasSemComprar >= dias * 2 ? "text-perigo" : "text-tinta"
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

        <section className="revelar">
          <div className="flex items-center justify-between gap-3 mb-3.5 px-1">
            <div className="flex items-center gap-2.5">
              <Placa icone={ScrollText} tom="lilas" pequena />
              <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
                Pedidos recentes
              </h2>
            </div>
            <BotaoLink
              href="/pedidos"
              variante="secundaria"
              className="text-xs py-1.5 px-3.5"
            >
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
                      <div className="truncate font-semibold">{pedido.cliente.apelido}</div>
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
                            : "text-tinta font-semibold"
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
    </Pagina>
  );
}
