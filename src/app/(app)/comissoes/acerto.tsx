"use client";

/**
 * A linha de um pedido na apuração, com o acerto embutido.
 *
 * O acerto abre DENTRO da linha em vez de numa janela sobreposta. Conferir o
 * extrato da indústria é ler uma lista e ir lançando: uma janela por pedido
 * obrigaria a abrir e fechar quinze vezes, perdendo de vista a lista que se
 * está conferindo.
 *
 * Enquanto não há acerto, a linha mostra só o previsto — que é a verdade
 * daquele momento: o pedido foi enviado e ainda não foi pago.
 */

import {
  Ban,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  Scissors,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { CampoMoeda } from "@/components/campo-mascarado";
import { SeloStatus } from "@/components/selo-status";
import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE,
  Celula,
  MensagemErro,
  formatarMoeda,
  formatarPercentual,
} from "@/components/ui";
import { pontualidadeEntrega } from "@/lib/comissao";

import type { EstadoFormulario } from "./acoes";
import { BolinhaPreposto } from "./bolinha-preposto";
import { colunasDaComissao } from "./colunas";
import { EditorParcelas } from "./parcelas";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
// Sem o ano: a parcela está na lista do mês em que vence, o ano é o da tela.
const DIA_MES = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

export type LinhaPedido = {
  id: string;
  numero: number;
  status: string;
  /** Vazio quando o pedido não foi cancelado, ou quando ninguém escreveu. */
  motivoCancelamento: string;
  apelidoCliente: string;
  /** "AAAA-MM-DD", como o input date espera. */
  prazoEntrega: string | null;
  entregueEm: string | null;
  base: string;
  percentual: string;
  previsto: number;
  /** Já no padrão brasileiro; vazio quando ainda não houve acerto. */
  valorRecebido: string;
  percentualRecebido: string;
  recebido: number | null;

  /** Nome do preposto que leva a fatia. Nulo quando o pedido é da casa. */
  preposto: string | null;
  /** A cor dele (`corDoPreposto`). Só na tela do administrador. */
  corPreposto: string | null;
  /** A fatia do preposto, para o editor de parcelas mostrar a de cada uma. */
  percentualPreposto: string | null;
  /**
   * As duas fatias, do previsto e do já acertado.
   *
   * Chegam NULAS na tela do preposto — e isso não é a tela escondendo: a página
   * simplesmente não as coloca aqui, então elas não viajam para o navegador
   * dele. O que o escritório ganha não é assunto dele.
   */
  rateio: { preposto: number; escritorio: number } | null;
  rateioRecebido: { preposto: number; escritorio: number } | null;
  /** O acerto é do administrador: é ele quem recebe da indústria. */
  podeAcertar: boolean;

  /**
   * Preenchido quando a linha é UMA parcela do pedido. Aí base, previsto e
   * acerto acima são os dela, e o vencimento é a data que decide o mês.
   */
  parcela: { numero: number; total: number; vencimento: string } | null;
  /** A venda sem IPI do pedido inteiro, "9765.00" — o que as parcelas dividem. */
  venda: string;
  prazoPagamento: string | null;
  /** "AAAA-MM-DD" de onde os dias das parcelas contam: a entrega prevista. */
  dataBaseParcelas: string;
  /** As parcelas do pedido, para o editor reabrir com elas. */
  parcelasAtuais: { vencimento: string; valor: string }[];
  /**
   * Pode abrir o editor de parcelas: administrador, pedido não cancelado e sem
   * acerto lançado no pedido inteiro (a ação recusaria parcelar por cima dele).
   */
  podeParcelar: boolean;
  /**
   * Parcelaria, não fosse o acerto já lançado no pedido inteiro. A linha diz
   * isso em vez de esconder o link sem explicação.
   */
  parcelarExigeDesfazerAcerto: boolean;
};

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

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
    <span className={`flex items-center justify-end gap-1 text-mini mt-0.5 ${classe}`}>
      <Glifo size={11} strokeWidth={2.25} aria-hidden="true" />
      {texto}
    </span>
  );
}

/** "Luiz R$ 12,00" e "casa R$ 30,00", uma em cima da outra, sob o valor. */
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

export function LinhaComissao({
  pedido,
  comPercentual,
  salvar,
  salvarParcelas,
  desfazerParcelas,
}: {
  pedido: LinhaPedido;
  comPercentual: boolean;
  /** O acerto desta linha — do pedido inteiro, ou da parcela. */
  salvar: Acao;
  salvarParcelas: Acao;
  desfazerParcelas: Acao;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const acertado = pedido.recebido !== null;
  const cancelado = pedido.status === "CANCELADO";
  const [aberto, setAberto] = useState(false);
  // Dentro do painel aberto: o acerto, ou o editor de parcelas no lugar dele.
  const [parcelando, setParcelando] = useState(false);
  const painel = useId();

  /*
   * Salvou sem erro, fecha o acerto — na mesma renderização em que a linha
   * recebe os valores novos. Com erro, fica aberto mostrando a mensagem. Mesmo
   * ajuste de estado durante a renderização do formulário da meta
   * (`painel-meta.tsx`), no lugar de um efeito com `setState`.
   */
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (!estado.erro) setAberto(false);
  }

  const diferenca = acertado ? pedido.recebido! - pedido.previsto : 0;
  const colunas = colunasDaComissao(comPercentual).length;

  return (
    <>
      <tr>
        <Celula>
          <Link
            href={`/pedidos/${pedido.id}`}
            className="numerico text-tinta-2 hover:text-carimbo transition-colors"
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
        <Celula className="w-full max-w-0">
          <span className={`block truncate ${cancelado ? "text-tinta-3" : ""}`}>
            {pedido.apelidoCliente}
          </span>
          {/*
            O preposto embaixo do nome, em texto miúdo e alinhado com ele — e
            não num chip: ao lado, o chip tomava a largura do nome; embaixo, o
            recuo da borda dele fazia a linha parecer torta.
          */}
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
            pedido com prazo diferente.
          */}
          {pedido.parcela && (
            <span className="flex items-center gap-1 text-mini text-carimbo mt-0.5 min-w-0">
              <CalendarClock size={11} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <span className="truncate">
                Parcela {pedido.parcela.numero} de {pedido.parcela.total} · vence{" "}
                {DIA_MES.format(paraData(pedido.parcela.vencimento)!)}
              </span>
            </span>
          )}
          {/*
            O motivo sob o nome, na coluna que tem largura sobrando — e não em
            linha própria, onde o filete da tabela o separava do pedido e ele
            parecia outro registro. Responde a pergunta que a linha zerada
            levanta: por que este pedido está no mês sem somar nada.
          */}
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
        <Celula alinhamento="numero">
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
        </Celula>

        <Celula alinhamento="numero">
          {pedido.entregueEm ? DATA.format(paraData(pedido.entregueEm)!) : TRACO}
          {!cancelado && <Pontualidade prazo={pedido.prazoEntrega} entregue={pedido.entregueEm} />}
        </Celula>

        {comPercentual && (
          <Celula alinhamento="numero" className="text-tinta-2">
            {pedido.percentual ? formatarPercentual(pedido.percentual) : TRACO}
          </Celula>
        )}

        {/*
          No cancelado, "R$ 0,00 previsto" seria mentira: não se prevê nada
          dele. A nota diz por que a linha está aqui sem somar — e fica NO LUGAR
          do traço, numa linha só: empilhada embaixo dele, empurrava o traço
          para cima e a célula saía do alinhamento das vizinhas.
        */}
        <Celula alinhamento="numero">
          {cancelado ? (
            <span className="text-mini text-tinta-3">fora da soma</span>
          ) : (
            <>
              <span className="font-medium">{formatarMoeda(pedido.previsto)}</span>
              <Fatias nome={pedido.preposto} rateio={pedido.rateio} />
            </>
          )}
        </Celula>

        <Celula alinhamento="numero">
          {acertado ? (
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
          className={!acertado || diferenca === 0 ? "" : diferenca < 0 ? "text-perigo" : "text-verde"}
        >
          {acertado ? `${diferenca > 0 ? "+" : ""}${formatarMoeda(diferenca)}` : TRACO}
        </Celula>

        <Celula alinhamento="acao">
          {cancelado ? (
            <SeloStatus status={pedido.status} />
          ) : (
            pedido.podeAcertar && (
              <BotaoTexto
                type="button"
                onClick={() => {
                  setAberto((a) => !a);
                  // Fechar abandona o parcelamento em andamento: reabrir mostra
                  // o acerto, que é o que a linha abre por padrão.
                  setParcelando(false);
                }}
                aria-expanded={aberto}
                aria-controls={painel}
                className="inline-flex items-center gap-1"
              >
                {acertado ? "acerto" : "acertar"}
                <ChevronDown
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
                />
              </BotaoTexto>
            )
          )}
        </Celula>
      </tr>

      {/*
        `hidden`, e não desmontar: o formulário guarda o que foi digitado e o
        erro da última tentativa enquanto a pessoa fecha e reabre a linha.
      */}
      <tr id={painel} hidden={!aberto || !pedido.podeAcertar}>
        <td colSpan={colunas} className="px-3 pb-4 pt-1">
          <div className="rounded-suave border border-filete bg-folha-2 p-4">
            {parcelando ? (
              <EditorParcelas
                venda={pedido.venda}
                percentual={pedido.percentual}
                percentualPreposto={pedido.percentualPreposto}
                dataBase={pedido.dataBaseParcelas}
                prazoSugerido={pedido.prazoPagamento}
                atuais={pedido.parcelasAtuais}
                salvar={salvarParcelas}
                desfazer={pedido.parcela ? desfazerParcelas : null}
                aoFechar={() => setParcelando(false)}
              />
            ) : (
            <form action={enviar} className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <CampoMoeda
                  name="valorRecebido"
                  rotulo="Valor recebido"
                  defaultValue={pedido.valorRecebido}
                  placeholder={formatarMoeda(pedido.base).replace("R$", "").trim()}
                  className="basis-36 grow"
                />

                <label className="basis-24 grow-0">
                  <span className="rotulo block mb-1.5 text-tinta-2">%</span>
                  <input
                    name="comissaoPercentualRecebido"
                    inputMode="decimal"
                    /*
                      Nasce com o percentual do pedido, como o usuário pediu: no caso
                      comum a indústria paga o combinado, e quem precisa mudar muda.
                    */
                    defaultValue={pedido.percentualRecebido || pedido.percentual}
                    className={`${CLASSE_CONTROLE} numerico`}
                  />
                </label>

                <label className="basis-40 grow">
                  <span className="rotulo block mb-1.5 text-tinta-2">Entregue em</span>
                  <input
                    type="date"
                    name="entregueEm"
                    defaultValue={pedido.entregueEm ?? ""}
                    className={CLASSE_CONTROLE}
                  />
                </label>

                <Botao type="submit" variante="secundaria" carregando={salvando} className="px-4 py-2">
                  {salvando ? "Salvando…" : "Salvar"}
                </Botao>
              </div>

              <p className="text-mini text-tinta-3 leading-relaxed">
                {pedido.parcela
                  ? `Parcela ${pedido.parcela.numero} de ${pedido.parcela.total}: `
                  : "Previsto: "}
                {formatarMoeda(pedido.base)} × {formatarPercentual(pedido.percentual)} ={" "}
                <span className="numerico">{formatarMoeda(pedido.previsto)}</span>.
                {pedido.prazoEntrega && ` Entrega prometida para ${DATA.format(paraData(pedido.prazoEntrega)!)}.`}
                {" "}Deixe os dois primeiros campos em branco para desfazer o acerto.
              </p>

              <MensagemErro>{estado.erro}</MensagemErro>

              {/*
                Parcelar mora aqui, no acerto: é conferindo com a indústria que
                se descobre que o pagamento vem em partes.
              */}
              {(pedido.podeParcelar || pedido.parcela || pedido.parcelarExigeDesfazerAcerto) && (
                /*
                  Botão de verdade, num rodapé separado por filete. Era um link
                  miúdo e cinza no fim do painel, que se perdia entre as notas.
                */
                <div className="flex flex-wrap items-center gap-3 border-t border-filete pt-3">
                  {pedido.parcelarExigeDesfazerAcerto ? (
                    <p className="text-mini text-tinta-3">
                      Para parcelar o recebimento, desfaça o acerto antes: deixe o valor e o % em
                      branco e salve.
                    </p>
                  ) : (
                    <>
                      <Botao
                        type="button"
                        variante="secundaria"
                        tamanho="compacto"
                        icone={Scissors}
                        onClick={() => setParcelando(true)}
                      >
                        {pedido.parcela
                          ? `Editar as ${pedido.parcela.total} parcelas`
                          : "Parcelar o recebimento"}
                      </Botao>
                      <span className="text-mini text-tinta-3">
                        {pedido.parcela
                          ? "Mude datas e valores; cada parcela conta no mês em que vence."
                          : "A indústria paga em partes? Cada parcela conta no mês em que vence."}
                      </span>
                    </>
                  )}
                </div>
              )}
            </form>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}
