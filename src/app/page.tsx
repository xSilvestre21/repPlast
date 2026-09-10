import Link from "next/link";

import { SeloStatus } from "@/components/selo-status";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  LinhaLista,
  formatarMoeda,
} from "@/components/ui";
import { competenciaDe, progressoDaMeta } from "@/lib/comissao";
import { pedidosDaCompetencia, resumirComissao } from "@/lib/comissao-consulta";
import { clientesSumidos } from "@/lib/positivacao";
import { dbAdministrativo, dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

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
    <>
      <Cabecalho
        titulo="Painel"
        descricao="O mês em uma tela: o que você já ganhou, quem parou de comprar e o que entrou por último."
      />

      <div className="space-y-5">
        <Link href="/comissoes" className="block group">
          <Cartao className="p-5 sm:p-6 transition-colors group-hover:bg-superficie-alta">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs text-texto-fraco uppercase tracking-wide">
                  Comissão deste mês
                </div>
                <div className="text-3xl font-semibold texto-gradiente numerico mt-0.5">
                  {formatarMoeda(resumo.valor.toString())}
                </div>
                <div className="text-sm text-texto-suave mt-1 numerico">
                  {formatarMoeda(resumo.base.toString())} vendidos em {doMes.length} pedido(s)
                </div>
              </div>

              {progresso && (
                <div className="text-right min-w-40">
                  <div className="text-xs text-texto-fraco uppercase tracking-wide">
                    {progresso.batida ? "Meta batida 🎉" : "Sua meta"}
                  </div>
                  <div className="numerico">{formatarMoeda(progresso.meta.toString())}</div>
                  <div className="h-1.5 rounded-full bg-superficie-alta overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        progresso.batida ? "bg-aviso" : "fundo-gradiente"
                      }`}
                      style={{ width: `${progresso.percentual}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </Cartao>
        </Link>

        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="font-semibold tracking-tight">Clientes sumidos</h2>

              <div className="flex gap-1">
                {CORTES.map((opcao) => (
                  <Link
                    key={opcao}
                    href={opcao === CORTE_PADRAO ? "/" : `/?dias=${opcao}`}
                    className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                      opcao === dias
                        ? "fundo-gradiente text-sobre-acento font-medium"
                        : "text-texto-fraco hover:text-texto"
                    }`}
                  >
                    {opcao}d
                  </Link>
                ))}
              </div>
            </div>

            {sumidos.length === 0 ? (
              <Cartao className="p-8 text-center text-sm text-texto-suave">
                Ninguém sumido há mais de {dias} dias. Bom sinal.
              </Cartao>
            ) : (
              <Cartao className="divide-y divide-borda">
                {sumidos.slice(0, 8).map(({ cliente, ultimaCompra, diasSemComprar }) => (
                  <LinhaLista key={cliente.id} href={`/clientes/${cliente.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{cliente.apelido}</div>
                      <div className="text-xs text-texto-suave truncate">
                        Última compra em {DATA.format(ultimaCompra)}
                        {cliente.ultimoValor
                          ? ` · ${formatarMoeda(cliente.ultimoValor.toString())}`
                          : null}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="numerico text-aviso font-medium">{diasSemComprar}</div>
                      <div className="text-xs text-texto-fraco">dias</div>
                    </div>
                  </LinhaLista>
                ))}
              </Cartao>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <h2 className="font-semibold tracking-tight">Pedidos recentes</h2>
              <BotaoLink href="/pedidos/novo" variante="secundaria" className="text-xs py-1">
                Novo pedido
              </BotaoLink>
            </div>

            {recentes.length === 0 ? (
              <Cartao className="p-8 text-center text-sm text-texto-suave">
                Nenhum pedido lançado ainda.
              </Cartao>
            ) : (
              <Cartao className="divide-y divide-borda">
                {recentes.map((pedido) => (
                  <LinhaLista key={pedido.id} href={`/pedidos/${pedido.id}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="numerico text-texto-suave shrink-0">#{pedido.numero}</span>
                      <div className="min-w-0">
                        <div className="truncate">{pedido.cliente.apelido}</div>
                        <div className="text-xs text-texto-suave truncate">
                          {pedido.fornecedor.nome} · {DATA.format(pedido.criadoEm)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`numerico text-sm ${
                          pedido.status === "CANCELADO"
                            ? "text-texto-fraco line-through"
                            : "text-texto"
                        }`}
                      >
                        {formatarMoeda(pedido.totalGeral.toString())}
                      </span>
                      <SeloStatus status={pedido.status} />
                    </div>
                  </LinhaLista>
                ))}
              </Cartao>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
