"use client";

/**
 * A linha de um pedido na apuração, com o acerto embutido.
 *
 * O acerto abre DENTRO da linha em vez de numa janela sobreposta. Conferir o
 * extrato da indústria é ler uma lista e ir lançando: uma janela por pedido
 * obrigaria a abrir e fechar quinze vezes, perdendo de vista a lista que se
 * está conferindo.
 *
 * No celular em pé a linha vira cartão (`.tabela-cartoes`, em `globals.css`) e
 * o acerto abre numa folha que sobe de baixo: dentro do cartão, o formulário
 * herdava a largura da tabela e saía cortado.
 *
 * Enquanto não há acerto, a linha mostra só o previsto — que é a verdade
 * daquele momento: o pedido foi enviado e ainda não foi pago.
 *
 * O que a linha abre está em `painel-acerto.tsx`. Aqui fica o que se lê sem
 * abrir nada — inclusive os selos do pagamento que atrasou.
 */

import {
  Ban,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Hourglass,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { FolhaDeBaixo } from "@/components/folha-de-baixo";
import { useTelaEstreita } from "@/components/tela-estreita";
import { SeloStatus } from "@/components/selo-status";
import { Botao, Celula, Selo, formatarMoeda, formatarPercentual } from "@/components/ui";
import { nomeCurtoDaCompetencia } from "@/lib/adiamento";
import { pontualidadeEntrega } from "@/lib/comissao";

import { BolinhaPreposto } from "@/components/bolinha-preposto";
import { chaveDaLinha } from "./busca";
import { useLinhaVisivel } from "./busca-comissao";
import { colunasDaComissao } from "./colunas";
import { MARCADOR_DO_MES, type AcoesDaLinha, type LinhaPedido } from "./linha";
import { PainelAcerto } from "./painel-acerto";

export type { AcoesDaLinha, LinhaPedido };

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
// Sem o ano: a parcela está na lista do mês em que vence, o ano é o da tela.
const DIA_MES = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

function paraData(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null;
}

/**
 * A pontualidade, como texto miúdo colorido sob a data de entrega.
 *
 * Era uma pílula ao lado do nome do cliente — o que empurrava as outras
 * colunas e separava o "30 dias adiantado" da data de que ele fala.
 */
function Pontualidade({ prazo, entregue }: { prazo: string | null; entregue: string | null }) {
  const p = pontualidadeEntrega(paraData(prazo), paraData(entregue));
  if (!p) return null;

  const TONS = {
    no_prazo: { classe: "text-verde", icone: Check, texto: "no prazo" },
    atrasado: {
      classe: "text-perigo",
      icone: TriangleAlert,
      texto: `${p.dias} dia${p.dias === 1 ? "" : "s"} de atraso`,
    },
    adiantado: {
      classe: "text-carimbo",
      icone: Clock,
      texto: `${p.dias} dia${p.dias === 1 ? "" : "s"} adiantado`,
    },
  } as const;

  const { classe, icone: Glifo, texto } = TONS[p.situacao];

  return (
    <span className={`flex items-center justify-end max-sm:justify-start gap-1 text-mini mt-0.5 ${classe}`}>
      <Glifo size={11} strokeWidth={2.25} aria-hidden="true" />
      {texto}
    </span>
  );
}

/** "Davi R$ 12,00" e "casa R$ 30,00", uma em cima da outra, sob o valor. */
function Fatias({ nome, rateio }: { nome: string | null; rateio: LinhaPedido["rateio"] }) {
  if (!rateio) return null;

  return (
    <span className="block text-mini text-tinta-3 mt-0.5 leading-snug">
      {nome?.split(/\s+/)[0] ?? "preposto"} {formatarMoeda(rateio.preposto)}
      <br />
      casa {formatarMoeda(rateio.escritorio)}
    </span>
  );
}

const TRACO = <span className="text-tinta-3">—</span>;

/**
 * O selo do pagamento que atrasou, sob o nome do cliente.
 *
 * Diz três coisas diferentes, conforme onde a linha está:
 *   - "Não pago": a indústria atrasou e não há previsão;
 *   - "Recebe em novembro": a linha está no mês DELA, mas a comissão conta em
 *     outro — com o caminho para lá;
 *   - "De agosto · pagamento adiado": a linha está no mês em que conta, e veio
 *     de outro.
 */
function SeloDoAtraso({ pedido, endereco }: { pedido: LinhaPedido; endereco: (mes: string) => string }) {
  const { atraso, lugar, mesNatural, mesDaTela } = pedido;
  const feminino = pedido.parcela !== null;
  const acertado = pedido.recebido !== null;

  if (atraso.naoPaga) {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
        <Selo tom="perigo" icone={Hourglass}>
          {feminino ? "Não paga" : "Não pago"}
          {lugar === "pendente" && ` · de ${nomeCurtoDaCompetencia(mesNatural, mesDaTela)}`}
        </Selo>
        {lugar === "pendente" && (
          <Link
            href={endereco(mesNatural)}
            className="relative alvo-toque text-mini text-tinta-3 underline underline-offset-2
              decoration-filete-forte hover:text-carimbo transition-colors"
          >
            ver em {nomeCurtoDaCompetencia(mesNatural, mesDaTela)}
          </Link>
        )}
      </span>
    );
  }

  if (!atraso.para) return null;

  if (lugar === "adiada-daqui") {
    const mes = nomeCurtoDaCompetencia(atraso.para, mesDaTela);
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
        <Selo tom={acertado ? "verde" : "carimbo"} icone={acertado ? Check : CalendarClock}>
          {acertado ? (feminino ? "Recebida" : "Recebido") : "Recebe"} em {mes}
        </Selo>
        <Link
          href={endereco(atraso.para)}
          className="relative alvo-toque text-mini text-tinta-3 underline underline-offset-2
            decoration-filete-forte hover:text-carimbo transition-colors"
        >
          ver em {mes}
        </Link>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
      <Selo tom="carimbo" icone={CalendarClock}>
        De {nomeCurtoDaCompetencia(mesNatural, mesDaTela)} · pagamento adiado
      </Selo>
    </span>
  );
}

export function LinhaComissao({
  pedido,
  comPercentual,
  acoes,
  enderecoDoMes,
}: {
  pedido: LinhaPedido;
  comPercentual: boolean;
  /** As ações desta linha — do pedido, ou da parcela. Só o administrador as usa. */
  acoes: AcoesDaLinha;
  /**
   * O endereço da tela com `MARCADOR_DO_MES` no lugar do mês — para o selo levar
   * até onde a comissão conta.
   */
  enderecoDoMes: string;
}) {
  const endereco = (mes: string) => enderecoDoMes.replace(MARCADOR_DO_MES, mes);
  const acertado = pedido.recebido !== null;
  const cancelado = pedido.status === "CANCELADO";
  // No mês dela, contando em outro: à vista, e fora da soma deste mês.
  const foraDaSoma = pedido.lugar === "adiada-daqui";
  const [aberto, setAberto] = useState(false);
  /*
   * O painel só é montado quando a linha abre pela primeira vez: num mês de
   * sessenta pedidos, eram sessenta formulários escondidos, cada um com o seu
   * calendário. Depois de aberto ele FICA montado — fechar e reabrir não apaga
   * o que foi digitado nem o erro da última tentativa.
   */
  const [jaAbriu, setJaAbriu] = useState(false);
  /** O que o painel está mostrando, para o título da folha do celular. */
  const [aba, setAba] = useState<"recebi" | "nao-pago" | "parcelas">("recebi");
  const painel = useId();
  const estreita = useTelaEstreita();
  // A busca da tela (`busca-comissao.tsx`) esconde a linha, sem desmontá-la:
  // o acerto aberto continua com o que foi digitado quando ela volta.
  // (a lista de pendentes fica fora da busca, e lá a linha está sempre à vista.)
  const visivel = useLinhaVisivel(chaveDaLinha(pedido.id, pedido.parcela?.numero ?? null));

  const fechamentoGravado = pedido.fechamento !== "";
  const pagaAposFaturar = !pedido.parcela && fechamentoGravado && pedido.atraso.para === null;

  const diferenca = acertado ? pedido.recebido! - pedido.previsto : 0;
  const colunas = colunasDaComissao(comPercentual).length;

  /*
   * O painel do acerto. Um elemento só, posto na linha da tabela (tela larga)
   * ou na folha que sobe de baixo (celular).
   */
  const conteudoDoPainel = jaAbriu && pedido.podeAcertar && (
    <PainelAcerto
      pedido={pedido}
      acoes={acoes}
      aoFechar={() => setAberto(false)}
      aoMudarDeAba={setAba}
    />
  );

  return (
    <>
      <tr hidden={!visivel}>
        <Celula data-area="pedido">
          <Link
            href={`/pedidos/${pedido.id}`}
            className="relative alvo-toque numerico text-tinta-2 hover:text-carimbo transition-colors"
          >
            #{pedido.numero}
          </Link>
        </Celula>

        {/*
          `w-full max-w-0`: a coluna do cliente fica com o que SOBRA das colunas
          de largura fixa, em vez de crescer até caber o nome mais o chip do
          preposto — numa tabela, texto sem quebra impõe a largura mínima da
          coluna, e o `truncate` sozinho não a encolhe. Sem isto, o primeiro
          pedido com preposto empurrava a tabela para a rolagem lateral mesmo
          em tela larga. A rolagem continua existindo nas telas menores, pelo
          `min-w-200` da tabela.
        */}
        <Celula data-area="cliente" className="w-full max-w-0">
          <span className={`block truncate max-sm:whitespace-normal max-sm:font-medium ${cancelado ? "text-tinta-3" : ""}`}>
            {pedido.apelidoCliente}
          </span>
          {/*
            O preposto embaixo do nome, em texto miúdo e alinhado com ele — e
            não num chip: ao lado, o chip tomava a largura do nome; embaixo, o
            recuo da borda dele fazia a linha parecer torta.
          */}
          {pedido.industria && (
            <span className="block truncate text-mini text-tinta-3 mt-0.5">{pedido.industria}</span>
          )}
          {pedido.preposto && (
            <span className="flex items-center gap-1 text-mini text-tinta-3 mt-0.5 min-w-0">
              {pedido.corPreposto ? (
                <BolinhaPreposto cor={pedido.corPreposto} />
              ) : (
                <User size={11} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              )}
              <span className="truncate">{pedido.preposto}</span>
            </span>
          )}
          {/*
            A marca da parcela, e o porquê de a linha estar NESTE mês: ela cai no mês em que
            vence, não no da entrega. Antes, o vencimento ocupava a coluna do
            prazo com a palavra "vencimento" embaixo, e a linha parecia um
            pedido com prazo diferente. Quando a indústria só paga depois de
            faturar, a linha está num mês seguinte ao do vencimento — a data
            vai com o ano, que pode ser outro, e a frase diz o porquê.
          */}
          {pedido.parcela && (
            <span className="flex items-center gap-1 text-mini text-carimbo mt-0.5 min-w-0">
              <CalendarClock size={11} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span className="truncate max-sm:whitespace-normal">
                Parcela {pedido.parcela.numero} de {pedido.parcela.total} · vence{" "}
                {pedido.parcela.recebimento === pedido.parcela.vencimento.slice(0, 7)
                  ? DIA_MES.format(paraData(pedido.parcela.vencimento)!)
                  : `${DATA.format(paraData(pedido.parcela.vencimento)!)} · paga após faturar`}
              </span>
            </span>
          )}
          {/*
            O motivo sob o nome, na coluna que tem largura sobrando — e não em
            linha própria, onde o filete da tabela o separava do pedido e ele
            parecia outro registro. Responde a pergunta que a linha zerada
            levanta: por que este pedido está no mês sem somar nada.
          */}
          {!cancelado && <SeloDoAtraso pedido={pedido} endereco={endereco} />}
          {pedido.motivoCancelamento && (
            <span className="flex items-start gap-1 text-mini text-perigo mt-0.5">
              <Ban size={11} strokeWidth={2} aria-hidden="true" className="shrink-0 mt-[3px]" />
              {pedido.motivoCancelamento}
            </span>
          )}
        </Celula>

        {/*
          As duas datas da entrega: a prometida, que decide o mês e a ordem da
          lista (o `deliveryDate || createdAt` do SICOV), e a que de fato
          aconteceu, lançada no acerto. A data em que o pedido foi enviado à
          indústria não entra — para a comissão, o que conta é a mercadoria
          chegar.
        */}
        <Celula alinhamento="numero" data-area="prazo" data-rotulo="Prazo">
          {/*
            O prazo de entrega do pedido, também na parcela: a coluna diz a
            mesma coisa em todas as linhas. O vencimento da parcela, que é o que
            a põe neste mês, fica sob o nome do cliente.
          */}
          {pedido.prazoEntrega ? (
            DATA.format(paraData(pedido.prazoEntrega)!)
          ) : (
            TRACO
          )}
          {/* Por que o pedido está num mês depois do da entrega. */}
          {pagaAposFaturar && (
            <span className="block text-mini text-carimbo mt-0.5">paga após faturar</span>
          )}
        </Celula>

        <Celula alinhamento="numero" data-area="entregue" data-rotulo="Entregue">
          {pedido.entregueEm ? DATA.format(paraData(pedido.entregueEm)!) : TRACO}
          {!cancelado && <Pontualidade prazo={pedido.prazoEntrega} entregue={pedido.entregueEm} />}
        </Celula>

        {comPercentual && (
          <Celula alinhamento="numero" data-area="percentual" data-rotulo="%" className="text-tinta-2">
            {pedido.percentual ? formatarPercentual(pedido.percentual) : TRACO}
          </Celula>
        )}

        {/*
          No cancelado, "R$ 0,00 previsto" seria mentira: não se prevê nada
          dele. A nota diz por que a linha está aqui sem somar — e fica NO LUGAR
          do traço, numa linha só: empilhada embaixo dele, empurrava o traço
          para cima e a célula saía do alinhamento das vizinhas.
        */}
        <Celula alinhamento="numero" data-area="previsto" data-rotulo="Previsto">
          {cancelado ? (
            <span className="text-mini text-tinta-3">fora da soma</span>
          ) : foraDaSoma ? (
            /*
              O valor continua à vista — é o que a indústria deve —, mas
              apagado e com a nota: ele não entra no total DESTE mês, e sem
              isso a soma das linhas não bateria com o total embaixo.
            */
            <>
              <span className="text-tinta-3">{formatarMoeda(pedido.previsto)}</span>
              <span className="block text-mini text-tinta-3 mt-0.5">
                conta em {nomeCurtoDaCompetencia(pedido.atraso.para!, pedido.mesDaTela)}
              </span>
            </>
          ) : (
            <>
              <span className="font-medium">{formatarMoeda(pedido.previsto)}</span>
              <Fatias nome={pedido.preposto} rateio={pedido.rateio} />
            </>
          )}
        </Celula>

        <Celula alinhamento="numero" data-area="recebido" data-rotulo="Recebido">
          {acertado && foraDaSoma ? (
            <span className="text-tinta-3">{formatarMoeda(pedido.recebido!)}</span>
          ) : acertado ? (
            <>
              <span className="font-medium">{formatarMoeda(pedido.recebido!)}</span>
              <Fatias nome={pedido.preposto} rateio={pedido.rateioRecebido} />
            </>
          ) : (
            TRACO
          )}
        </Celula>

        <Celula
          alinhamento="numero"
          data-area="diferenca"
          data-rotulo="Diferença"
          className={
            !acertado || foraDaSoma || diferenca === 0 ? "" : diferenca < 0 ? "text-perigo" : "text-verde"
          }
        >
          {acertado && !foraDaSoma ? `${diferenca > 0 ? "+" : ""}${formatarMoeda(diferenca)}` : TRACO}
        </Celula>

        <Celula alinhamento="acao" data-area="acao">
          {cancelado ? (
            <SeloStatus status={pedido.status} />
          ) : (
            pedido.podeAcertar && (
              <>
              {/*
                Botão de verdade, dizendo o que faz. Era o link "acertar",
                sublinhado e cinza: o que mais se usava na tela e o que menos
                parecia um botão.
              */}
              <Botao
                type="button"
                variante="secundaria"
                tamanho="compacto"
                onClick={() => {
                  setAberto((a) => !a);
                  setJaAbriu(true);
                }}
                aria-expanded={aberto}
                aria-controls={painel}
                className="px-3 max-sm:px-3.5"
              >
                {/* No cartão do celular a ação tem um terço da largura: o
                    rótulo inteiro passava por cima do nome do cliente. */}
                <span className="max-sm:hidden">{acertado ? "Ver acerto" : "Lançar acerto"}</span>
                <span className="sm:hidden">{acertado ? "Acerto" : "Acertar"}</span>
                <ChevronDown
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={`transition-transform duration-200 max-sm:hidden ${aberto ? "rotate-180" : ""}`}
                />
              </Botao>
              {estreita && (
                <FolhaDeBaixo
                  id={painel}
                  aberto={aberto}
                  aoFechar={() => setAberto(false)}
                  titulo={
                    aba === "parcelas"
                      ? `Parcelas do pedido #${pedido.numero}`
                      : pedido.parcela
                        ? `Parcela ${pedido.parcela.numero} de ${pedido.parcela.total} do pedido #${pedido.numero}`
                        : `Pedido #${pedido.numero}`
                  }
                  descricao={`${pedido.apelidoCliente} · previsto ${formatarMoeda(pedido.previsto)}`}
                >
                  {conteudoDoPainel}
                </FolhaDeBaixo>
              )}
              </>
            )
          )}
        </Celula>
      </tr>

      {/*
        `hidden`, e não desmontar: o formulário guarda o que foi digitado e o
        erro da última tentativa enquanto a pessoa fecha e reabre a linha. No
        celular em pé esta linha não existe: o painel vai para a folha que sobe
        de baixo, montada na célula da ação.
      */}
      {!estreita && (
        <tr id={painel} hidden={!aberto || !pedido.podeAcertar || !visivel}>
          <td colSpan={colunas} className="px-3 pb-4 pt-1">
            <div className="rounded-suave border border-filete bg-folha-2 p-4">{conteudoDoPainel}</div>
          </td>
        </tr>
      )}
    </>
  );
}
