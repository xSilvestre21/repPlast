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
import { Pagina } from "@/components/pagina";
import { SeloStatus } from "@/components/selo-status";
import { ValorAnimado } from "@/components/valor-animado";
import {
  Barra,
  BotaoLink,
  Cabecalho,
  Cartao,
  CartaoMetrica,
  Chip,
  CorpoLinha,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  Placa,
  Segmentado,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";
import { competenciaDe, progressoDaMeta } from "@/lib/comissao";
import { pedidosDaCompetencia, resumirComissao } from "@/lib/comissao-consulta";
import { clientesSumidos } from "@/lib/positivacao";
import { dbAdministrativo } from "@/lib/db";
import { escopoAtual } from "@/lib/sessao";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/** Opções de corte para "sumido". 60 dias é o padrão do ramo. */
const CORTES = [30, 60, 90, 180];
const CORTE_PADRAO = 60;

export default async function Painel({ searchParams }: PageProps<"/">) {
  const parametros = await searchParams;
  const dias = CORTES.includes(Number(parametros.dias)) ? Number(parametros.dias) : CORTE_PADRAO;

  const { organizacaoId, db, ehAdmin, usuarioId } = await escopoAtual();
  const competencia = competenciaDe(new Date());

  const [organizacao, doMes, recentes, clientes] = await Promise.all([
    dbAdministrativo().organizacao.findUnique({
      where: { id: organizacaoId },
      select: { metaComissaoMensal: true },
    }),

    // Mesmo corte da tela de comissões: o preposto vê o mês dele.
    pedidosDaCompetencia(db, organizacaoId, competencia, ehAdmin ? null : usuarioId),

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

  /*
   * O número grande do painel é o que cabe a quem está olhando: o total que a
   * indústria paga, para o dono do escritório; a fatia dele, para o preposto.
   */
  const comissaoDoMes = ehAdmin ? resumo.valor : resumo.previstoDoPreposto;

  const meta = organizacao?.metaComissaoMensal ?? null;
  const progresso = progressoDaMeta(meta?.toString() ?? null, comissaoDoMes);

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
        Grade bento: uma calha só, células de tamanhos diferentes.

        O palco cobre só o que está acima da dobra. Os dois blocos de baixo saem
        dele de propósito: eles se revelam ao ROLAR, e uma cascata de entrada
        somada a uma revelação de rolagem faria o mesmo bloco animar duas vezes
        no primeiro segundo.

        8/4 em cima, 4/4/4 embaixo. A assimetria é o que diz qual dos cinco
        números é O número — sem precisar de cor nem de moldura para dizê-lo.
      */}
      <div className="palco grid gap-4 md:grid-cols-6 lg:grid-cols-12 items-stretch">
        {/* ---------------------------------------------------------------- */}
        {/* O número que a pessoa abriu o sistema para ver                    */}
        {/* ---------------------------------------------------------------- */}
        <Link href="/comissoes" className="block md:col-span-6 lg:col-span-8">
          <Cartao marcada className="elevavel h-full p-6 sm:p-8">
            <div className="h-full flex flex-col">
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
                Quatro vezes e meia o tamanho do corpo de texto. É esse salto —
                e não a cor — que faz o olho pousar aqui antes de tudo.
              */}
              <div className="cifra text-heroi mt-5">
                <ValorAnimado valor={comissaoDoMes.toNumber()} />
              </div>

              <p className="text-realce text-tinta-2 mt-4 numerico">
                {formatarMoeda(resumo.base.toString())} vendidos em {doMes.length} pedido
                {doMes.length === 1 ? "" : "s"}
              </p>
            </div>
          </Cartao>
        </Link>

        {/* ---------------------------------------------------------------- */}
        {/* A meta, agora célula própria da grade                             */}
        {/* ---------------------------------------------------------------- */}
        <Link href="/comissoes" className="block md:col-span-6 lg:col-span-4">
          <Cartao className="elevavel h-full p-5 sm:p-6 flex flex-col">
            <div className="flex items-center gap-3">
              <Placa icone={Target} tom={progresso?.batida ? "menta" : "neutro"} pequena />
              {/*
                O marca-texto amarelo, uma vez por tela. Ele fica guardado para
                o único momento em que a tela tem uma notícia: a meta do mês
                saiu do lugar de "faltam tantos" e virou fato.
              */}
              {progresso?.batida ? (
                <span className="marcador text-corpo font-semibold">Meta batida</span>
              ) : (
                <span className="rotulo">Sua meta</span>
              )}
              {progresso && (
                <span
                  className={`numerico text-corpo font-bold ml-auto ${
                    progresso.batida ? "text-verde" : "text-tinta"
                  }`}
                >
                  {Math.round(progresso.percentual)}%
                </span>
              )}
            </div>

            {progresso ? (
              <div className="mt-auto pt-6">
                <Barra
                  progresso={progresso.percentual}
                  tom={progresso.batida ? "verde" : "tinta"}
                />
                <p className="text-rotulo text-tinta-2 mt-3 numerico">
                  {progresso.batida
                    ? `${formatarMoeda(progresso.meta.toString())} — alcançada`
                    : `Faltam ${formatarMoeda(progresso.falta.toString())}`}
                </p>
              </div>
            ) : (
              /* Sem meta a célula ficaria vazia na grade. Dizer como criá-la
                 aproveita o espaço e é o próximo passo de quem chegou aqui. */
              <p className="text-corpo text-tinta-2 mt-auto pt-6 leading-relaxed">
                Nenhuma meta definida para este mês. Defina uma em Comissões e ela passa
                a aparecer aqui.
              </p>
            )}
          </Cartao>
        </Link>

        {/* ---------------------------------------------------------------- */}
        {/* Os números de apoio — três células iguais fechando a grade        */}
        {/* ---------------------------------------------------------------- */}
        <div className="md:col-span-2 lg:col-span-4">
          <CartaoMetrica
            rotulo="Vendido no mês"
            icone={TrendingUp}
            tom="menta"
            valor={formatarMoeda(resumo.base.toString())}
            detalhe="Base da comissão, sem IPI e sem frete"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-4">
          <CartaoMetrica
            rotulo="Pedidos enviados"
            icone={ScrollText}
            tom="mar"
            valor={doMes.length}
            detalhe={
              doMes.length > 0
                ? ehAdmin
                  ? `Comissão média de ${resumo.percentualMedio.toDecimalPlaces(2)}%`
                  : "Sua fatia da comissão"
                : "Nenhum pedido enviado neste mês"
            }
            href="/pedidos"
          />
        </div>
        <div className="md:col-span-2 lg:col-span-4">
          <CartaoMetrica
            rotulo="Ticket médio"
            icone={Receipt}
            tom="sol"
            valor={ticketMedio ? formatarMoeda(ticketMedio.toString()) : "—"}
            detalhe="Valor médio por pedido enviado no mês"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* As duas listas — cada uma se monta quando sobe na tela              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2 items-start mt-4">
        <section className="revelar">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
            <div className="flex items-center gap-3">
              <Placa icone={Users} tom="pessego" pequena />
              <h2 className="text-realce font-semibold">Clientes sumidos</h2>
            </div>

            {/* O corte mora na URL, então cada opção é um link de verdade —
                dá para abrir "90 dias" numa aba nova e mandar por mensagem. */}
            <Segmentado
              nome="Dias sem comprar"
              atual={String(dias)}
              opcoes={CORTES.map((opcao) => ({
                valor: String(opcao),
                rotulo: `${opcao}d`,
                href: opcao === CORTE_PADRAO ? "/" : `/?dias=${opcao}`,
              }))}
            />
          </div>

          {sumidos.length === 0 ? (
            <EstadoVazio icone={UserRoundCheck}>
              Ninguém sumido há mais de {dias} dias. Bom sinal.
            </EstadoVazio>
          ) : (
            <Cartao className="divide-y divide-filete overflow-hidden">
              {sumidos.slice(0, 8).map(({ cliente, ultimaCompra, diasSemComprar }) => (
                <LinhaLista key={cliente.id} href={`/clientes/${cliente.id}`}>
                  <CorpoLinha
                    titulo={cliente.apelido}
                    detalhe={
                      <span className="numerico">
                        {DATA.format(ultimaCompra)}
                        {cliente.ultimoValor
                          ? ` · ${formatarMoeda(cliente.ultimoValor.toString())}`
                          : null}
                      </span>
                    }
                  />

                  {/*
                    Passou do dobro do corte, o número fica vermelho. É perda
                    iminente, não um link — por isso vermelho e não azul.
                  */}
                  <FimDaLinha>
                    <div className="text-right w-16">
                      <span
                        className={`cifra text-medio ${
                          diasSemComprar >= dias * 2 ? "text-perigo" : "text-tinta"
                        }`}
                      >
                        {diasSemComprar}
                      </span>
                      <span className="text-mini text-tinta-3 ml-1">dias</span>
                    </div>
                  </FimDaLinha>
                </LinhaLista>
              ))}
            </Cartao>
          )}
        </section>

        <section className="revelar">
          <div className="flex items-center justify-between gap-3 mb-4 px-1">
            <div className="flex items-center gap-3">
              <Placa icone={ScrollText} tom="lilas" pequena />
              <h2 className="text-realce font-semibold">Pedidos recentes</h2>
            </div>
            <BotaoLink href="/pedidos" variante="secundaria" tamanho="compacto">
              Ver todos
            </BotaoLink>
          </div>

          {recentes.length === 0 ? (
            <EstadoVazio icone={Inbox}>Nenhum pedido lançado ainda.</EstadoVazio>
          ) : (
            <Cartao className="divide-y divide-filete overflow-hidden">
              {recentes.map((pedido) => (
                <LinhaLista key={pedido.id} href={`/pedidos/${pedido.id}`}>
                  <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                    <span className="font-mono text-mini text-tinta-3 shrink-0 w-10">
                      {pedido.numero}
                    </span>
                    <CorpoLinha
                      titulo={pedido.cliente.apelido}
                      detalhe={pedido.fornecedor.nome}
                    />
                  </div>

                  <FimDaLinha>
                    <ValorLinha
                      className="w-28"
                      riscado={pedido.status === "CANCELADO"}
                      valor={formatarMoeda(pedido.totalGeral.toString())}
                      nota={DATA.format(pedido.criadoEm)}
                    />
                    <div className="w-24 flex justify-end">
                      <SeloStatus status={pedido.status} />
                    </div>
                  </FimDaLinha>
                </LinhaLista>
              ))}
            </Cartao>
          )}
        </section>
      </div>
    </Pagina>
  );
}
