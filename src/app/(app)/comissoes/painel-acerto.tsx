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
 */

import { ArrowLeft, Check, CircleDollarSign, Hourglass, Scissors, Truck, Undo2 } from "lucide-react";
import Decimal from "decimal.js";
import { useActionState, useEffect, useRef, useState } from "react";

import { useAoSalvar } from "@/components/ao-salvar";
import { CampoData } from "@/components/campo-data";
import { CampoMes } from "@/components/campo-mes";
import { CampoMoeda } from "@/components/campo-mascarado";
import { focarSePuder } from "@/components/foco";
import { ErroGeral, Formulario } from "@/components/formulario";
import { usePerguntaAntes } from "@/components/pergunta-antes";
import { Botao, Campo, EspacoDoRotulo, formatarMoeda, formatarPercentual } from "@/components/ui";
import { mesesParaAdiar, nomeCurtoDaCompetencia, nomeDaCompetencia } from "@/lib/adiamento";
import { comissaoDoPedido } from "@/lib/comissao";
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

/** O título de uma das duas partes do painel. */
function Titulo({ icone: Glifo, id, children }: { icone: typeof Truck; id?: string; children: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 text-mini font-semibold uppercase tracking-wide text-tinta-2">
      <Glifo size={14} strokeWidth={2.25} aria-hidden="true" className="text-tinta-3" />
      {children}
    </h3>
  );
}

type Aba = "recebi" | "parcelas";

/** O que o painel está mostrando — a folha do celular muda de título com isto. */
export type VistaDoPainel = Aba | "nao-pago";

export function PainelAcerto({
  pedido,
  acoes,
  aoFechar,
  aoMudarDeVista,
}: {
  pedido: LinhaPedido;
  acoes: AcoesDaLinha;
  /** Fecha o painel: depois de salvar o acerto, o "não pago" ou as parcelas. */
  aoFechar: () => void;
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

  const fecharNaoPago = () => {
    // Salvou: a próxima vez que a linha abrir, abre no começo.
    setNaoPago(false);
    aoFechar();
  };

  return (
    <>
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
            aoSalvar={fecharNaoPago}
          />
        </section>
      )}

      {/*
        Escondido, e não desmontado, enquanto a tela do "não pago" está aberta:
        voltar dela encontra o que já tinha sido digitado aqui.
      */}
      <div hidden={naoPago} className="space-y-5">
        <Entrega pedido={pedido} salvar={acoes.entrega} />

        <section className="space-y-3 border-t border-filete pt-4">
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
            <Recebi pedido={pedido} salvar={acoes.acerto} aoSalvar={aoFechar} />
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
                  <p role="note" className="text-mini text-tinta-2 leading-relaxed">
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
                />
              </>
            ))}
        </section>
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
    <section className="space-y-3">
      <Titulo icone={Truck}>Entrega da mercadoria</Titulo>

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

        <p className="text-mini text-tinta-3 leading-relaxed">
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
  aoSalvar: () => void;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const acertado = pedido.recebido !== null;
  const marcado = pedido.atraso.naoPaga || pedido.atraso.para !== null;
  const feminino = pedido.parcela !== null;

  // Fecha ao salvar sem erro; com erro, fica aberto mostrando a mensagem.
  useAoSalvar(estado, aoSalvar);

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
   * Desfazer o acerto lançado errado. Antes, o único caminho era apagar o
   * valor e o % e salvar — e o % já vem preenchido, então quem apagava só o
   * valor recebia um erro e achava que não tinha volta.
   */
  const perguntaDesfazer = usePerguntaAntes(
    acertado
      ? {
          titulo: pedido.parcela
            ? `Desfazer o acerto da parcela ${pedido.parcela.numero} do pedido #${pedido.numero}?`
            : `Desfazer o acerto do pedido #${pedido.numero}?`,
          texto:
            `O valor recebido (${formatarMoeda(pedido.recebido!)}) e o % do acerto são apagados, e ` +
            `${feminino ? "a parcela" : "o pedido"} volta a contar só como previsto, ` +
            `${formatarMoeda(pedido.previsto)}. A data de entrega continua como está. Depois, ` +
            "lance o valor certo e salve.",
          rotulo: "Desfazer acerto",
        }
      : undefined,
  );

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">
      {/* Pelo topo: o erro de um campo aparece embaixo dele, e pela base os
          vizinhos desceriam junto. */}
      <div className="flex flex-wrap items-start gap-3">
        <CampoMoeda
          key={geracao}
          name="valorRecebido"
          rotulo="Venda sobre a qual a indústria pagou"
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

      {/* A conta, enquanto se digita: o campo é a VENDA, e o que entra no
          bolso é isto aqui. */}
      <p aria-live="polite" className="text-corpo text-tinta-2 leading-relaxed">
        {recebe === null ? (
          <>
            Digite o valor da venda que a indústria considerou — normalmente o{" "}
            {feminino ? "da parcela" : "do pedido"}, <span className="numerico">{formatarMoeda(pedido.base)}</span>
            . A comissão é esse valor × o %.
          </>
        ) : (
          <>
            Comissão recebida:{" "}
            <strong className="text-tinta numerico">{formatarMoeda(recebe)}</strong>
            {diferenca === 0 ? (
              " — igual ao previsto."
            ) : (
              <>
                {" — "}
                <span className={`numerico ${diferenca < 0 ? "text-perigo" : "text-verde"}`}>
                  {formatarMoeda(Math.abs(diferenca))} {diferenca < 0 ? "a menos" : "a mais"}
                </span>{" "}
                que o previsto.
              </>
            )}
          </>
        )}
      </p>

      {!pedido.parcela && pagamento.campos}

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

      <p className="text-mini text-tinta-3 leading-relaxed">
        {pedido.parcela
          ? `Parcela ${pedido.parcela.numero} de ${pedido.parcela.total}: `
          : "Previsto: "}
        {formatarMoeda(pedido.base)} × {formatarPercentual(pedido.percentual)} ={" "}
        <span className="numerico">{formatarMoeda(pedido.previsto)}</span>. A comissão{" "}
        {feminino ? "desta parcela" : "deste pedido"} conta em{" "}
        <span className="font-semibold text-tinta-2">{nomeDaCompetencia(pagouEm)}</span>
        {pagouEm !== mesDela && ` (${feminino ? "a parcela" : "o pedido"} é de ${nomeCurtoDaCompetencia(mesDela, pagouEm)})`}
        .
      </p>

      <ErroGeral />

      <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <Botao
          type="submit"
          variante="secundaria"
          icone={Check}
          carregando={salvando}
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
              className="max-sm:w-full max-sm:py-3"
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
