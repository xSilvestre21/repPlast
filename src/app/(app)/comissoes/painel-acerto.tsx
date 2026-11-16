"use client";

/**
 * O painel que a linha abre: a entrega, e o que aconteceu com o pagamento.
 *
 * Eram um formulário só — valor, %, data de entrega e um Salvar — com
 * "parcelar" e "desfazer" em links no rodapé. Dois problemas apareceram no uso:
 *
 *   - a data de entrega não salvava sem o valor recebido, e a mercadoria quase
 *     sempre chega antes do dinheiro. Ela também parecia ser a data do
 *     pagamento. Agora é um bloco à parte, com o botão dele, dizendo o que é;
 *   - quem não tinha recebido não achava o que fazer: parcelar estava
 *     escondido, e "não foi pago" nem existia. Agora o painel PERGUNTA o que
 *     aconteceu, com as três respostas à vista, e mostra só o que é de cada uma.
 *
 * Cada parte é um formulário próprio, com a ação dela: salvar a entrega não
 * mexe no acerto, e vice-versa.
 *
 * O pagamento vem PRIMEIRO, e a entrega no fim. O botão da linha diz "Lançar
 * acerto", e o painel abria na data de entrega, com outro botão de salvar —
 * quem usa pouco o computador preenchia a data achando que era o pagamento.
 */

import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Hourglass,
  Scissors,
  TriangleAlert,
  Truck,
  Undo2,
} from "lucide-react";
import Decimal from "decimal.js";
import { type ReactNode, useActionState, useEffect, useRef, useState } from "react";

import { useAoSalvar } from "@/components/ao-salvar";
import { CampoData } from "@/components/campo-data";
import { CampoMes } from "@/components/campo-mes";
import { CampoMoeda } from "@/components/campo-mascarado";
import { focarSePuder } from "@/components/foco";
import { ErroGeral, Formulario } from "@/components/formulario";
import { usePerguntaAntes } from "@/components/pergunta-antes";
import { Botao, Campo, EspacoDoRotulo, formatarMoeda, formatarPercentual } from "@/components/ui";
import { mesesParaAdiar, nomeCurtoDaCompetencia, nomeDaCompetencia } from "@/lib/adiamento";
import { comissaoDoPedido, pontualidadeEntrega, ratearComissao } from "@/lib/comissao";
import { mascararMoeda } from "@/lib/mascara";
import { lerNumeroBr } from "@/lib/numero-br";
import { mesDoRecebimento } from "@/lib/parcelas";

import { Escolhas, type Escolha } from "./escolhas";
import type { AcaoDaLinha, AcoesDaLinha, LinhaPedido } from "./linha";
import { NaoPago } from "./nao-pago";
import { usePagamentoComissao } from "./pagamento-comissao";
import { EditorParcelas } from "./parcelas";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * O título de uma das duas partes do painel.
 *
 * Em letra de leitura, e não no rótulo miúdo de 12px em maiúsculas cinza:
 * "O que aconteceu com o pagamento?" é a pergunta da tela, e passava por
 * etiqueta.
 */
function Titulo({ icone: Glifo, id, children }: { icone: typeof Truck; id?: string; children: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-realce font-semibold text-tinta">
      <Glifo size={17} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-tinta-2" />
      {children}
    </h3>
  );
}

/** "Iara Celina" → "Iara": a frase fala da pessoa, não do cadastro. */
function primeiroNome(nome: string | null): string {
  return nome?.split(/\s+/)[0] ?? "o preposto";
}

/**
 * O pedido, em poucas linhas, no alto da janela: de quem é, quando a indústria
 * prometeu entregar, quanto vale a comissão e em que pé está o pagamento.
 *
 * Quem abria o acerto precisava lembrar de que pedido se tratava pela linha que
 * ficou atrás. Agora a janela diz — inclusive a entrega PREVISTA, que é a data
 * que decide o mês e que se confere com o extrato da indústria.
 */
function ResumoDoPedido({ pedido }: { pedido: LinhaPedido }) {
  const { atraso, parcela } = pedido;
  const acertado = pedido.recebido !== null;
  const diferenca = acertado ? Math.round((pedido.recebido! - pedido.previsto) * 100) / 100 : 0;
  const pontualidade = pontualidadeEntrega(
    pedido.prazoEntrega ? paraData(pedido.prazoEntrega) : null,
    pedido.entregueEm ? paraData(pedido.entregueEm) : null,
  );
  const contaEm = atraso.para ?? pedido.mesNatural;

  const situacao = acertado
    ? {
        texto:
          diferenca === 0
            ? `Pago: ${formatarMoeda(pedido.recebido!)}, igual ao previsto`
            : `Pago: ${formatarMoeda(pedido.recebido!)} (${formatarMoeda(Math.abs(diferenca))} ${
                diferenca < 0 ? "a menos" : "a mais"
              } que o previsto)`,
        cor: diferenca < 0 ? "text-perigo" : "text-verde",
      }
    : atraso.naoPaga
      ? { texto: "Não pago — a indústria atrasou, sem previsão", cor: "text-perigo" }
      : atraso.para
        ? { texto: `Pagamento adiado para ${nomeDaCompetencia(atraso.para)}`, cor: "text-tinta" }
        : { texto: "Ainda não pago", cor: "text-tinta" };

  const itens: { rotulo: string; valor: ReactNode }[] = [
    { rotulo: "Cliente", valor: pedido.apelidoCliente },
    { rotulo: "Indústria", valor: pedido.nomeIndustria },
    {
      rotulo: "Entrega prevista",
      valor: pedido.prazoEntrega ? DATA.format(paraData(pedido.prazoEntrega)) : "sem data marcada no pedido",
    },
    {
      rotulo: "Entregue em",
      valor: pedido.entregueEm ? (
        <>
          {DATA.format(paraData(pedido.entregueEm))}
          {pontualidade && (
            <span
              className={`ml-1.5 font-normal ${
                pontualidade.situacao === "atrasado" ? "text-perigo" : "text-tinta-2"
              }`}
            >
              ·{" "}
              {pontualidade.situacao === "no_prazo"
                ? "no prazo"
                : `${pontualidade.dias} dia${pontualidade.dias === 1 ? "" : "s"} ${
                    pontualidade.situacao === "atrasado" ? "de atraso" : "adiantado"
                  }`}
            </span>
          )}
        </>
      ) : (
        <span className="font-normal text-tinta-2">ainda não informada</span>
      ),
    },
    {
      rotulo: parcela ? `Parcela ${parcela.numero} de ${parcela.total}` : "Venda",
      valor: parcela
        ? `${formatarMoeda(pedido.base)} · vence ${DATA.format(paraData(parcela.vencimento))}`
        : formatarMoeda(pedido.base),
    },
    {
      rotulo: "Comissão prevista",
      valor: (
        <>
          {formatarMoeda(pedido.previsto)}
          {pedido.percentual && (
            <span className="ml-1.5 font-normal text-tinta-2">({formatarPercentual(pedido.percentual)})</span>
          )}
          {pedido.rateio && (
            <span className="block text-rotulo font-normal text-tinta-2">
              {primeiroNome(pedido.preposto)} {formatarMoeda(pedido.rateio.preposto)} · escritório{" "}
              {formatarMoeda(pedido.rateio.escritorio)}
            </span>
          )}
        </>
      ),
    },
    {
      rotulo: "Conta no mês de",
      valor: (
        <>
          {nomeDaCompetencia(contaEm)}
          {contaEm !== pedido.mesNatural && (
            <span className="ml-1.5 font-normal text-tinta-2">
              ({feminino(pedido) ? "a parcela" : "o pedido"} é de {nomeCurtoDaCompetencia(pedido.mesNatural, contaEm)})
            </span>
          )}
        </>
      ),
    },
    { rotulo: "Situação", valor: <span className={situacao.cor}>{situacao.texto}</span> },
  ];

  return (
    <dl
      aria-label={`Resumo ${parcela ? "da parcela" : "do pedido"} #${pedido.numero}`}
      className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-suave border border-filete bg-folha-2
        px-4 py-3.5"
    >
      {itens.map(({ rotulo, valor }) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-rotulo text-tinta-2">{rotulo}</dt>
          <dd className="text-corpo font-semibold text-tinta numerico">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function feminino(pedido: LinhaPedido): boolean {
  return pedido.parcela !== null;
}

type Aba = "recebi" | "parcelas";

/** O que o painel está mostrando — a folha do celular muda de título com isto. */
export type VistaDoPainel = Aba | "nao-pago";

export function PainelAcerto({
  pedido,
  acoes,
  aoFechar,
  aoSalvar,
  aoMudarDeVista,
}: {
  pedido: LinhaPedido;
  acoes: AcoesDaLinha;
  /** Fecha sem ter salvo nada: o "Cancelar" das parcelas. */
  aoFechar: () => void;
  /**
   * Salvou: o acerto, o "não pago" ou as parcelas. Fecha a janela e deixa a
   * frase ("Acerto salvo") na linha, para a pessoa saber que deu certo.
   */
  aoSalvar: (aviso: string) => void;
  aoMudarDeVista?: (vista: VistaDoPainel) => void;
}) {
  const acertado = pedido.recebido !== null;
  const { atraso } = pedido;
  const marcado = atraso.naoPaga || atraso.para !== null;

  /*
   * Abre sempre no "Recebi": até a linha marcada como não paga, quando abre, é
   * quase sempre porque a indústria pagou. O cartão do "não pago" diz que ela
   * está marcada, e leva até a marca.
   */
  const [aba, setAbaInterna] = useState<Aba>("recebi");
  /*
   * "Ainda não foi pago" abre uma tela só dele, no lugar do painel inteiro. As
   * duas respostas dele ("não sei quando", "já sei o mês") eram cartões iguais
   * aos três de cima, logo embaixo deles, e liam como mais opções da mesma
   * pergunta.
   */
  const [naoPago, setNaoPagoInterno] = useState(false);
  const voltarRef = useRef<HTMLButtonElement>(null);
  const grupoRef = useRef<HTMLDivElement>(null);

  const setAba = (nova: Aba) => {
    setAbaInterna(nova);
    aoMudarDeVista?.(nova);
  };
  const setNaoPago = (aberto: boolean) => {
    setNaoPagoInterno(aberto);
    aoMudarDeVista?.(aberto ? "nao-pago" : aba);
  };

  // O foco vai junto com a troca de tela — só para quem está no teclado
  // (`focarSePuder`): o botão clicado sumiu, e o foco cairia no começo da página.
  const trocouDeTela = useRef(false);
  useEffect(() => {
    if (!trocouDeTela.current) return;
    trocouDeTela.current = false;
    if (naoPago) focarSePuder(voltarRef.current);
    else focarSePuder(grupoRef.current?.querySelector<HTMLElement>('[role="radio"][data-valor="nao-pago"]'));
  }, [naoPago]);

  const feminino = pedido.parcela !== null;
  const temParcelas = pedido.podeParcelar || pedido.parcela !== null || pedido.parcelarExigeDesfazerAcerto;
  const mesDoAtraso = atraso.para ? nomeCurtoDaCompetencia(atraso.para, pedido.mesDaTela) : "";

  const opcoes: Escolha<Aba | "nao-pago">[] = [
    {
      valor: "recebi",
      icone: Check,
      titulo: feminino ? "Recebi esta parcela" : "Recebi",
      descricao: "A indústria pagou. Lançar o valor do acerto.",
    },
    {
      valor: "nao-pago",
      icone: Hourglass,
      titulo: feminino ? "Ainda não foi paga" : "Ainda não foi pago",
      // A marca que já existe, dita no próprio cartão: é por ele que se muda.
      descricao: acertado
        ? atraso.para
          ? `A indústria pagou com atraso, em ${mesDoAtraso}.`
          : "A indústria atrasou? Marcar, e dizer o mês se você já souber."
        : atraso.para
          ? `Marcado: a indústria paga em ${mesDoAtraso}. Mudar o mês ou tirar a marca.`
          : atraso.naoPaga
            ? "Marcado, sem previsão. Dizer o mês ou tirar a marca."
            : "A indústria atrasou. Marcar, e dizer o mês se você já souber.",
      leva: true,
    },
    ...(temParcelas
      ? [
          {
            valor: "parcelas" as const,
            icone: Scissors,
            titulo: pedido.parcela ? `Editar as ${pedido.parcela.total} parcelas` : "Recebo em parcelas",
            descricao: pedido.parcela
              ? "Mudar as datas, os valores ou a quantidade."
              : "A indústria paga em partes: em dias (28/35/42) ou nas datas que você escolher.",
          },
        ]
      : []),
  ];

  const salvouNaoPago = (aviso: string) => {
    // Salvou: a próxima vez que a linha abrir, abre no começo.
    setNaoPago(false);
    aoSalvar(aviso);
  };

  return (
    <>
      <ResumoDoPedido pedido={pedido} />

      {naoPago && (
        <section aria-labelledby={`${pedido.id}-nao-pago`} className="space-y-4">
          <Botao
            ref={voltarRef}
            type="button"
            variante="secundaria"
            tamanho="compacto"
            icone={ArrowLeft}
            onClick={() => {
              trocouDeTela.current = true;
              setNaoPago(false);
            }}
          >
            Voltar
          </Botao>

          <div className="space-y-1">
            <Titulo icone={Hourglass} id={`${pedido.id}-nao-pago`}>
              {feminino ? "Ainda não foi paga" : "Ainda não foi pago"}
            </Titulo>
            <p className="text-corpo text-tinta-2 leading-relaxed">
              {acertado
                ? `${feminino ? "Esta parcela" : "Este pedido"} já tem acerto lançado.`
                : `Você já sabe quando a indústria vai pagar a comissão ${feminino ? "desta parcela" : "deste pedido"}?`}
            </p>
          </div>

          <NaoPago
            oQue={feminino ? "a parcela" : "o pedido"}
            mesNatural={pedido.mesNatural}
            hoje={pedido.hoje}
            atraso={atraso}
            acertado={acertado}
            previsto={pedido.previsto}
            marcar={acoes.naoPago}
            desmarcar={acoes.desmarcarNaoPago}
            aoSalvar={salvouNaoPago}
          />
        </section>
      )}

      {/*
        Escondido, e não desmontado, enquanto a tela do "não pago" está aberta:
        voltar dela encontra o que já tinha sido digitado aqui.
      */}
      <div hidden={naoPago} className="space-y-5">
        <section className="space-y-3">
          <Titulo icone={CircleDollarSign}>
            {feminino ? "O que aconteceu com o pagamento desta parcela?" : "O que aconteceu com o pagamento?"}
          </Titulo>

          <div ref={grupoRef}>
            <Escolhas
              nome="O que aconteceu com o pagamento"
              atual={aba}
              aoEscolher={(valor) => {
                if (valor === "nao-pago") {
                  trocouDeTela.current = true;
                  setNaoPago(true);
                } else {
                  setAba(valor);
                }
              }}
              opcoes={opcoes}
            />
          </div>

          {/*
            `hidden`, e não desmontar: trocar de resposta para ler a outra não
            apaga o que já foi digitado nesta.
          */}
          <div hidden={aba !== "recebi"}>
            <Recebi pedido={pedido} salvar={acoes.acerto} aoSalvar={aoSalvar} />
          </div>

          {aba === "parcelas" &&
            (pedido.parcelarExigeDesfazerAcerto ? (
              <p className="text-corpo text-tinta-2 leading-relaxed">
                Este pedido já tem acerto lançado no valor inteiro. Para receber em parcelas, apague
                antes esse acerto: toque em “Recebi”, aqui em cima, e use o botão “Desfazer acerto”.
              </p>
            ) : (
              <>
                {/* Parcelar tira a marca do pedido inteiro: daqui em diante,
                    quem atrasa é uma parcela, e é nela que se marca. */}
                {!pedido.parcela && marcado && (
                  <p role="note" className="text-corpo text-tinta-2 leading-relaxed">
                    Ao salvar as parcelas, o “{pedido.atraso.para ? "recebe em outro mês" : "não pago"}” deste
                    pedido sai: cada parcela conta no mês dela, e a que atrasar se marca na linha dela.
                  </p>
                )}
                <EditorParcelas
                  venda={pedido.venda}
                  percentual={pedido.percentual}
                  percentualPreposto={pedido.percentualPreposto}
                  dataBase={pedido.dataBaseParcelas}
                  prazoSugerido={pedido.prazoPagamento}
                  fechamento={pedido.fechamento}
                  atuais={pedido.parcelasAtuais}
                  acertadas={pedido.parcelasAcertadas}
                  mesDaTela={pedido.mesDaTela}
                  desta={pedido.parcela?.numero ?? null}
                  salvar={acoes.parcelas}
                  desfazer={pedido.parcela ? acoes.desfazerParcelas : null}
                  aoFechar={aoFechar}
                  aoSalvar={aoSalvar}
                />
              </>
            ))}
        </section>

        <Entrega pedido={pedido} salvar={acoes.entrega} />
      </div>
    </>
  );
}

/**
 * A data em que a indústria entregou — e só ela.
 *
 * Tem o próprio botão porque não depende de dinheiro nenhum: é o controle de
 * se a indústria cumpriu o prazo. A frase embaixo diz isso com todas as letras,
 * porque dentro do acerto ela era lida como "a data em que me pagaram".
 */
function Entrega({ pedido, salvar }: { pedido: LinhaPedido; salvar: AcaoDaLinha }) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const [data, setData] = useState(pedido.entregueEm ?? "");

  // "Salva" some quando a pessoa mexe de novo na data: aí já não é verdade.
  const [salva, setSalva] = useState(false);
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    setSalva(!estado.erro);
  }

  return (
    <section className="space-y-3 border-t border-filete pt-4">
      <Titulo icone={Truck}>Entrega da mercadoria (opcional)</Titulo>

      <Formulario estado={estado} action={enviar} className="space-y-2">
        {/* Pelo topo: o erro aparece embaixo do campo, e pela base o botão
            desceria junto. */}
        <div className="flex flex-wrap items-start gap-3">
          <CampoData
            name="entregueEm"
            rotulo="A indústria entregou em"
            defaultValue={pedido.entregueEm ?? ""}
            onChange={(valor) => {
              setData(valor);
              setSalva(false);
            }}
            atalhos={[]}
            atalhosUteis={[]}
            className="basis-56 grow sm:grow-0"
          />
          <div className="max-sm:basis-full">
            <EspacoDoRotulo />
            <div className="flex items-center gap-3 min-h-11">
              <Botao
                type="submit"
                variante="secundaria"
                icone={salva ? Check : undefined}
                carregando={salvando}
                className="max-sm:w-full max-sm:py-3"
              >
                {salvando
                  ? "Salvando…"
                  : salva
                    ? "Data salva"
                    : data === "" && pedido.entregueEm
                      ? "Apagar a data da entrega"
                      : "Salvar data da entrega"}
              </Botao>
            </div>
          </div>
        </div>

        <ErroGeral />

        <p className="text-rotulo text-tinta-2 leading-relaxed">
          Serve só para acompanhar se a indústria entregou no prazo
          {pedido.prazoEntrega && ` (prometido para ${DATA.format(paraData(pedido.prazoEntrega))})`}. Não é a
          data do pagamento e não muda o mês nem o valor da comissão — pode salvar mesmo sem ter recebido.
        </p>
      </Formulario>
    </section>
  );
}

/** "1.250,00" → 1250.00 — do campo mascarado para a conta. Vazio: nada digitado. */
function valorDoCampo(texto: string): Decimal | null {
  const limpo = texto.replace(/\./g, "").replace(",", ".").trim();
  return limpo === "" || Number.isNaN(Number(limpo)) ? null : new Decimal(limpo);
}

/**
 * "Recebi": o acerto — sobre que valor de venda a indústria pagou, e com que
 * percentual. Os dois são digitados, nunca deduzidos (ver `lerAcerto`).
 */
function Recebi({
  pedido,
  salvar,
  aoSalvar,
}: {
  pedido: LinhaPedido;
  salvar: AcaoDaLinha;
  aoSalvar: (aviso: string) => void;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const acertado = pedido.recebido !== null;
  const marcado = pedido.atraso.naoPaga || pedido.atraso.para !== null;
  const feminino = pedido.parcela !== null;

  // Salvar e desfazer vão pela mesma ação; a frase da linha diz qual foi.
  const pediuDesfazer = useRef(false);

  // Fecha ao salvar sem erro; com erro, fica aberto mostrando a mensagem.
  useAoSalvar(estado, () =>
    aoSalvar(pediuDesfazer.current ? "Acerto desfeito" : acertado ? "Acerto atualizado" : "Acerto salvo"),
  );

  const [valor, setValor] = useState(pedido.valorRecebido);
  /*
    Nasce com o percentual do pedido, como o usuário pediu: no caso comum a
    indústria paga o combinado, e quem precisa mudar muda.
  */
  const [percentual, setPercentual] = useState(pedido.percentualRecebido || pedido.percentual);
  // Remonta o campo do valor quando o botão o preenche: ele é não controlado
  // (a máscara escreve direto no nó), e guardaria o que estava.
  const [geracao, setGeracao] = useState(0);

  const cheio = mascararMoeda(new Decimal(pedido.base).toFixed(2));
  // A troca do mês em que conta, recolhida atrás de "Mudar o mês": no caso de
  // quase sempre ninguém mexe nela, e à vista ela convidava ao clique errado.
  const [mudandoMes, setMudandoMes] = useState(false);

  /*
   * Quando a indústria paga o pedido inteiro. Só no pedido sem parcelas: no
   * parcelado, a escolha mora no editor de parcelas, que muda o mês de todas.
   */
  const pagamento = usePagamentoComissao(pedido.fechamento);
  const mesDela = pedido.parcela
    ? pedido.mesNatural
    : mesDoRecebimento(pedido.dataCompetencia, pagamento.fechaNoDia);

  // "Em que mês a indústria pagou?" — só na linha que atrasou.
  const meses = [mesDela, ...mesesParaAdiar(mesDela, pedido.hoje)];
  const sugerido =
    pedido.atraso.para ??
    (pedido.mesDaTela > mesDela ? pedido.mesDaTela : pedido.hoje > mesDela ? pedido.hoje : mesDela);
  const [contaEm, setContaEm] = useState(sugerido);
  const pagouEm = marcado ? (meses.includes(contaEm) ? contaEm : mesDela) : (pedido.atraso.para ?? mesDela);

  const baseDigitada = valorDoCampo(valor);
  const percentualDigitado = lerNumeroBr(percentual);
  const recebe =
    baseDigitada && percentualDigitado !== null
      ? comissaoDoPedido(baseDigitada, percentualDigitado).toNumber()
      : null;
  const diferenca = recebe === null ? 0 : Math.round((recebe - pedido.previsto) * 100) / 100;

  /*
   * O erro mais provável aqui: digitar a COMISSÃO recebida no campo da venda.
   * Um valor abaixo de um quarto da venda é quase sempre isso — mas pode ser
   * um acordo de verdade, então é aviso, e não recusa.
   */
  const venda = new Decimal(pedido.base);
  const pareceComissao =
    baseDigitada !== null &&
    baseDigitada.greaterThan(0) &&
    venda.greaterThan(0) &&
    baseDigitada.lessThan(venda.dividedBy(4));

  /*
   * Desfazer o acerto lançado errado. Antes, o único caminho era apagar o
   * valor e o % e salvar — e o % já vem preenchido, então quem apagava só o
   * valor recebia um erro e achava que não tinha volta.
   */
  /*
   * A pergunta diz, linha por linha, o que se apaga, para onde a linha volta e
   * o que fica — "tem certeza?" sem dizer o quê não ajuda quem tem dúvida.
   */
  const perguntaDesfazer = usePerguntaAntes(
    acertado
      ? {
          titulo: pedido.parcela
            ? `Desfazer o acerto da parcela ${pedido.parcela.numero} do pedido #${pedido.numero}?`
            : `Desfazer o acerto do pedido #${pedido.numero}?`,
          texto: [
            "O que acontece:",
            `• o valor recebido (${formatarMoeda(pedido.recebido!)}) e o % do acerto são apagados;`,
            `• ${feminino ? "a parcela volta" : "o pedido volta"} para “A acertar”, com ` +
              `${formatarMoeda(pedido.previsto)} previstos;`,
            ...(pedido.rateioRecebido
              ? [
                  `• ${primeiroNome(pedido.preposto)} deixa de ter ` +
                    `${formatarMoeda(pedido.rateioRecebido.preposto)} liberados para repasse.`,
                ]
              : []),
            "",
            "Continua igual: a data de entrega. Depois, lance o valor certo e salve.",
          ].join("\n"),
          rotulo: "Desfazer acerto",
        }
      : undefined,
    () => {
      pediuDesfazer.current = true;
    },
  );

  // A parte do preposto no que se está lançando, para o "Ao salvar".
  const fatiaDoPreposto =
    recebe !== null && pedido.preposto && pedido.percentualPreposto && baseDigitada && percentualDigitado !== null
      ? ratearComissao(baseDigitada, percentualDigitado, pedido.percentualPreposto).doPreposto.toNumber()
      : null;

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">
      {/* Pelo topo: o erro de um campo aparece embaixo dele, e pela base os
          vizinhos desceriam junto. */}
      <div className="flex flex-wrap items-start gap-3">
        <CampoMoeda
          key={geracao}
          name="valorRecebido"
          // Curto, numa linha só: em duas, a caixa descia e saía da linha da
          // do %. O resto vai na dica, embaixo.
          rotulo="Valor da venda"
          dica="A venda que a indústria considerou — não a comissão."
          defaultValue={valor}
          onChange={(e) => setValor(e.currentTarget.value)}
          placeholder={cheio}
          className="basis-56 grow sm:grow-0"
        />

        <Campo
          name="comissaoPercentualRecebido"
          rotulo="% da comissão"
          numero="decimal"
          defaultValue={percentual}
          onChange={(e) => setPercentual(e.currentTarget.value)}
          className="basis-28 grow-0"
        />

        {/* O caso de quase sempre — a indústria pagou o combinado — num toque,
            em vez de redigitar o valor que está na linha de cima. */}
        {valor !== cheio && (
          <div className="max-sm:basis-full">
            <EspacoDoRotulo />
            <div className="flex items-center min-h-11">
              <Botao
                type="button"
                variante="secundaria"
                tamanho="compacto"
                onClick={() => {
                  setValor(cheio);
                  setGeracao((g) => g + 1);
                }}
                className="max-sm:w-full max-sm:py-3"
              >
                Pagou o valor todo: {formatarMoeda(pedido.base)}
              </Botao>
            </div>
          </div>
        )}
      </div>

      {pareceComissao && (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-suave border border-destaque bg-destaque-fraco px-4 py-3
            text-corpo text-tinta leading-relaxed"
        >
          <TriangleAlert size={17} strokeWidth={2.25} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span>
            Esse valor está bem abaixo da venda (<span className="numerico">{formatarMoeda(pedido.base)}</span>).
            Confira se não digitou a comissão no lugar da venda — aqui vai o valor da venda.
          </span>
        </p>
      )}

      {/* Escondido, e não desmontado: os campos vão no envio mesmo fechados. */}
      {!pedido.parcela && <div hidden={!mudandoMes}>{pagamento.campos}</div>}

      {marcado && (
        <CampoMes
          // A exceção do fechamento muda o mês da linha, e com ele os meses que
          // se pode escolher: o campo recomeça do que vale agora.
          key={mesDela}
          name="contaEm"
          rotulo="Em que mês a indústria pagou?"
          defaultValue={pagouEm}
          onChange={setContaEm}
          hoje={pedido.hoje}
          min={meses[0]}
          max={meses[meses.length - 1]}
          marcas={[{ mes: mesDela, texto: `mês ${feminino ? "da parcela" : "do pedido"}` }]}
          dica={`${feminino ? "Esta parcela" : "Este pedido"} estava ${
            pedido.atraso.para ? "com o pagamento adiado" : feminino ? "como não paga" : "como não pago"
          }. A comissão conta no mês que você escolher aqui.`}
          className="sm:max-w-80"
        />
      )}

      {/*
        O que o clique em "Salvar" vai fazer, dito ANTES dele, logo acima do
        botão, e mudando enquanto se digita: a comissão que entra, a diferença
        para o previsto, o mês em que conta e a parte do preposto.
      */}
      <div aria-live="polite" className="rounded-suave border border-filete bg-folha px-4 py-3.5 space-y-2">
        {recebe === null ? (
          <p className="text-corpo text-tinta-2 leading-relaxed">
            Digite o valor da venda que a indústria considerou — normalmente o{" "}
            {feminino ? "da parcela" : "do pedido"},{" "}
            <span className="numerico">{formatarMoeda(pedido.base)}</span>. A comissão é esse valor × o %.
          </p>
        ) : (
          <>
            <p className="text-rotulo font-semibold uppercase tracking-wide text-tinta-2">Ao salvar, fica assim:</p>
            <ul className="space-y-1.5 text-corpo text-tinta-2 leading-relaxed">
              <li>
                Comissão recebida:{" "}
                <strong className="text-medio font-semibold text-tinta numerico">{formatarMoeda(recebe)}</strong>
                {diferenca === 0 ? (
                  " — igual ao previsto."
                ) : (
                  <>
                    {" — "}
                    <span className={`font-semibold numerico ${diferenca < 0 ? "text-perigo" : "text-verde"}`}>
                      {formatarMoeda(Math.abs(diferenca))} {diferenca < 0 ? "a menos" : "a mais"}
                    </span>{" "}
                    que o previsto (<span className="numerico">{formatarMoeda(pedido.previsto)}</span>).
                  </>
                )}
              </li>
              {fatiaDoPreposto !== null && (
                <li>
                  {primeiroNome(pedido.preposto)}:{" "}
                  <strong className="font-semibold text-tinta numerico">{formatarMoeda(fatiaDoPreposto)}</strong>{" "}
                  liberados para repasse.
                </li>
              )}
            </ul>
          </>
        )}

        <p className="text-corpo text-tinta-2 leading-relaxed">
          A comissão {feminino ? "desta parcela" : "deste pedido"} conta em{" "}
          <strong className="font-semibold text-tinta">{nomeDaCompetencia(pagouEm)}</strong>
          {pagouEm !== mesDela &&
            ` (${feminino ? "a parcela" : "o pedido"} é de ${nomeCurtoDaCompetencia(mesDela, pagouEm)})`}
          {!pedido.parcela &&
            !marcado &&
            pagamento.fechaNoDia !== null &&
            ", porque a indústria paga no mês seguinte ao faturamento"}
          .{" "}
          {/* No atrasado, quem diz o mês é o "Em que mês a indústria pagou?". */}
          {!pedido.parcela && !marcado && !mudandoMes && (
            <button
              type="button"
              onClick={() => setMudandoMes(true)}
              className="relative alvo-toque font-medium text-carimbo underline underline-offset-2
                decoration-carimbo/35 hover:decoration-carimbo cursor-pointer"
            >
              Mudar o mês
            </button>
          )}
        </p>
        <p className="text-rotulo text-tinta-2 numerico">
          {pedido.parcela ? `Parcela ${pedido.parcela.numero} de ${pedido.parcela.total}: ` : "Previsto: "}
          {formatarMoeda(pedido.base)} × {formatarPercentual(pedido.percentual)} = {formatarMoeda(pedido.previsto)}.
        </p>
      </div>

      <ErroGeral />

      <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        {/* O que se veio fazer aqui: o botão preto, o único do painel. */}
        <Botao
          type="submit"
          icone={Check}
          carregando={salvando}
          onClick={() => {
            pediuDesfazer.current = false;
          }}
          className="max-sm:w-full max-sm:py-3"
        >
          {salvando ? "Salvando…" : acertado ? "Salvar a mudança no acerto" : "Salvar acerto"}
        </Botao>

        {acertado && (
          <>
            <Botao
              type="submit"
              name="desfazer"
              value="sim"
              variante="perigo"
              tamanho="compacto"
              icone={Undo2}
              onClick={perguntaDesfazer.aoClicar}
              disabled={salvando}
              // Longe do salvar, na ponta — e no celular, afastado embaixo: é o
              // que apaga, e não pode ser o vizinho de um toque distraído.
              className="sm:ml-auto max-sm:w-full max-sm:py-3 max-sm:mt-3"
            >
              Desfazer acerto
            </Botao>
            {perguntaDesfazer.janela}
          </>
        )}
      </div>
    </Formulario>
  );
}
