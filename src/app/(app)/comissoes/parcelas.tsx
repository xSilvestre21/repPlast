"use client";

/**
 * O editor do parcelamento do recebimento de um pedido.
 *
 * Abre dentro do painel de acerto da linha, como o próprio acerto: conferir o
 * extrato e parcelar são a mesma conversa com a indústria.
 *
 * Começa PERGUNTANDO como a pessoa quer montar, com as duas formas à vista —
 * antes só havia o campo dos dias, e quem tinha as datas na mão (o boleto, o
 * extrato) não descobria que podia escolhê-las no calendário:
 *
 *   - por DIAS a partir da entrega ("28/35/42", já sugeridos pelo prazo de
 *     pagamento do pedido) e "Dividir", que gera parcelas iguais — o que o
 *     SICOV fazia;
 *   - escolhendo as DATAS: quantas parcelas e a data da primeira; as outras
 *     nascem um mês depois da anterior, e cada uma se troca no calendário.
 *
 * Nas duas, depois, dá para mexer na data e no valor de qualquer parcela: a
 * ÚLTIMA é sempre o que sobra, então diminuir uma empurra a diferença para
 * frente sem a pessoa fazer conta.
 *
 * E quando a indústria paga: no mês do vencimento, ou só no mês seguinte ao
 * faturamento que fecha num dia — aí cada linha diz em que mês a comissão
 * dela entra. Abre com a sugestão da indústria e é deste pedido: há exceção.
 *
 * As contas são as de `lib/parcelas.ts`, as mesmas que o servidor confere ao
 * gravar.
 */

import { CalendarDays, Hash, Plus, RotateCcw, Scissors, Undo2, X } from "lucide-react";
import Decimal from "decimal.js";
import { useActionState, useId, useRef, useState } from "react";

import { CampoData } from "@/components/campo-data";
import { CampoMoeda } from "@/components/campo-mascarado";
import {
  Botao,
  CLASSE_CONTROLE,
  Campo,
  EspacoDoRotulo,
  MensagemErro,
  formatarMoeda,
} from "@/components/ui";
import { ratearComissao } from "@/lib/comissao";
import { mascararMoeda } from "@/lib/mascara";
import {
  dividirIgual,
  lerPrazoEmDias,
  mesDoRecebimento,
  restanteDaBase,
  somarDias,
  somarMeses,
} from "@/lib/parcelas";

import { ErroGeral, Formulario } from "@/components/formulario";
import { usePerguntaAntes } from "@/components/pergunta-antes";
import { campoDaLinha, erroDoCampo } from "@/lib/erro-formulario";

import type { EstadoFormulario } from "./acoes";
import { Escolhas } from "./escolhas";
import { usePagamentoComissao } from "./pagamento-comissao";

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/** Uma parcela enquanto é editada: a data e o valor como estão no campo. */
type Linha = { vencimento: string; valor: string };

const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "3.255,00" → "3255.00" — do campo mascarado para a conta. */
function paraDecimal(valor: string): Decimal {
  const limpo = valor.replace(/\./g, "").replace(",", ".");
  return new Decimal(limpo === "" ? "0" : limpo);
}

/** "3255.00" → "3.255,00" — da conta para o campo. */
function paraCampo(valor: Decimal.Value): string {
  return mascararMoeda(new Decimal(valor).toFixed(2));
}

function mesDe(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? MES.format(new Date(`${iso}T00:00:00Z`)) : "";
}

/** As ações do rodapé, no celular: da largura da folha e com altura de dedo. */
const ACAO_NO_CELULAR = "max-sm:w-full max-sm:justify-center max-sm:py-3 max-sm:text-corpo";

/** Como as parcelas estão sendo montadas. */
type Modo = "dias" | "datas";

/** O título de um passo: "1", "Como quer montar as parcelas?". */
function Passo({ numero, children }: { numero: number; children: string }) {
  return (
    <h4 className="flex items-center gap-2 text-corpo font-semibold text-tinta">
      <span
        aria-hidden="true"
        className="grid place-items-center size-5 rounded-full bg-tinta text-papel text-micro font-semibold numerico"
      >
        {numero}
      </span>
      {children}
    </h4>
  );
}

export function EditorParcelas({
  venda,
  percentual,
  percentualPreposto,
  dataBase,
  prazoSugerido,
  fechamento,
  atuais,
  salvar,
  desfazer,
  aoFechar,
}: {
  /** A venda sem IPI do pedido inteiro, "9765.00". */
  venda: string;
  /** O percentual da comissão, para mostrar quanto cada parcela rende. */
  percentual: string;
  /** A fatia do preposto, quando o pedido tem um: cada parcela mostra a dele e a da casa. */
  percentualPreposto: string | null;
  /** "AAAA-MM-DD" de onde os dias contam: a entrega prevista. */
  dataBase: string;
  prazoSugerido: string | null;
  /**
   * O dia em que a indústria fecha o faturamento, "30" — o do pedido, que
   * nasce com o da indústria. Vazio: mês do vencimento.
   */
  fechamento: string;
  /** As parcelas que o pedido já tem. Vazio: parcelamento novo. */
  atuais: Linha[];
  salvar: Acao;
  /** Só quando o pedido já é parcelado. */
  desfazer: Acao | null;
  aoFechar: () => void;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const [estadoDesfazer, enviarDesfazer, desfazendo] = useActionState<EstadoFormulario, FormData>(
    desfazer ?? (async () => ({})),
    {},
  );

  const perguntaDesfazer = usePerguntaAntes(
    desfazer
      ? {
          titulo: "Desfazer o parcelamento?",
          texto:
            `As ${atuais.length} parcelas são apagadas e o pedido volta a contar inteiro, ` +
            `${formatarMoeda(Number(venda))}, no mês da entrega (ou no seguinte, se a indústria só paga ` +
            "depois de faturar). Para parcelar de novo, escolha " +
            "“Recebo em parcelas” outra vez.",
          rotulo: "Desfazer parcelamento",
        }
      : undefined,
  );

  const sugeridos = lerPrazoEmDias(prazoSugerido);
  /**
   * O prazo do pedido, quando é ele que abre o campo: só no parcelamento novo.
   * É o ponto de partida, e não a regra — quem diz em quantas vezes e em que
   * dias a indústria paga é o representante.
   */
  const sugerido = atuais.length === 0 && sugeridos ? sugeridos.join("/") : null;
  const [dias, setDias] = useState(sugerido ?? "");
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    atuais.length > 0 ? atuais : sugeridos && sugeridos.length > 1 ? gerar(sugeridos) : [],
  );
  /** Os dias que montaram as parcelas da tela: diferentes do campo, falta dividir. */
  const [divididoCom, setDivididoCom] = useState(
    sugerido && sugeridos && sugeridos.length > 1 ? sugerido : "",
  );
  /** O primeiro toque no campo ainda com o prazo do pedido seleciona tudo: digitar já troca. */
  const selecionouAoTocar = useRef(false);
  // Remonta os campos de valor quando as linhas são geradas de novo: eles são
  // não controlados (a máscara escreve direto no nó), e guardariam o valor velho.
  const [geracao, setGeracao] = useState(0);
  const [erroDias, setErroDias] = useState<string | null>(null);
  const idDias = useId();

  /*
   * A forma de montar. Com prazo legível no pedido, abre nos dias, já
   * divididos — é o caso de quase sempre. Sem ele, ninguém escolheu ainda, e a
   * tela espera a resposta. No pedido já parcelado, as parcelas gravadas vêm
   * primeiro: montar de novo é um botão.
   */
  const [modo, setModo] = useState<Modo | null>(
    atuais.length === 0 && sugeridos && sugeridos.length > 1 ? "dias" : null,
  );
  const [montando, setMontando] = useState(atuais.length === 0);
  const [quantas, setQuantas] = useState("2");
  // Um mês depois da entrega: é o "30 dias" de quem não tem prazo em dias.
  const [primeira, setPrimeira] = useState(() => somarMeses(dataBase, 1));
  const [erroDatas, setErroDatas] = useState<string | null>(null);
  const { fechaNoDia, campos: camposPagamento } = usePagamentoComissao(fechamento);

  // Fecha ao salvar sem erro — o mesmo ajuste de estado do acerto e da meta.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (!estado.erro) aoFechar();
  }
  const [desfazerVisto, setDesfazerVisto] = useState(estadoDesfazer);
  if (estadoDesfazer !== desfazerVisto) {
    setDesfazerVisto(estadoDesfazer);
    if (!estadoDesfazer.erro) aoFechar();
  }

  function gerar(listaDias: number[]): Linha[] {
    const valores = dividirIgual(venda, listaDias.length);
    return listaDias.map((d, i) => ({
      vencimento: somarDias(dataBase, d),
      valor: paraCampo(valores[i]),
    }));
  }

  function dividir() {
    const lidos = lerPrazoEmDias(dias);
    if (!lidos || lidos.length < 2) {
      setErroDias('Escreva os dias de cada parcela a partir da entrega, como "28/35/42" ou "28,35,42".');
      return;
    }
    setErroDias(null);
    setLinhas(gerar(lidos));
    setGeracao((g) => g + 1);
    setDivididoCom(dias);
  }

  /** As parcelas pelo calendário: `quantas`, a primeira em `primeira`, uma por mês. */
  function criarPorDatas() {
    const n = Number(quantas);
    if (!/^\d{1,2}$/.test(quantas.trim()) || n < 2 || n > 24) {
      setErroDatas("Diga em quantas parcelas a indústria paga — de 2 a 24, como 3.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(primeira)) {
      setErroDatas("Escolha no calendário a data da primeira parcela.");
      return;
    }
    setErroDatas(null);
    const valores = dividirIgual(venda, n);
    setLinhas(valores.map((valor, i) => ({ vencimento: somarMeses(primeira, i), valor: paraCampo(valor) })));
    setGeracao((g) => g + 1);
  }

  /** Volta ao prazo do pedido, e às parcelas dele. */
  function voltarAoPedido() {
    if (!sugerido || !sugeridos) return;
    setDias(sugerido);
    setErroDias(null);
    if (sugeridos.length > 1) {
      setLinhas(gerar(sugeridos));
      setGeracao((g) => g + 1);
      setDivididoCom(sugerido);
    }
  }

  /** Em que pé estão os dias do campo, para a nota embaixo dele. */
  const situacaoDosDias = !sugerido
    ? null
    : dias === sugerido
      ? "do-pedido"
      : dias.trim() === ""
        ? "vazio"
        : dias === divididoCom
          ? "divididos"
          : "falta-dividir";

  const anteriores = linhas.slice(0, -1);
  const restante = restanteDaBase(
    venda,
    anteriores.map((l) => paraDecimal(l.valor)),
  );
  const restanteInvalido = linhas.length > 0 && restante.lessThanOrEqualTo(0);

  function mudar(indice: number, campo: keyof Linha, valor: string) {
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  }

  function adicionar() {
    // A nova entra antes da última e começa vazia: a última continua sendo o
    // restante, e a pessoa tira dela o que quiser pôr na nova.
    setLinhas((atual) => {
      const ultima = atual.at(-1);
      const nova = { vencimento: ultima?.vencimento ?? dataBase, valor: "" };
      return [...atual.slice(0, -1), nova, ...(ultima ? [ultima] : [])];
    });
    setGeracao((g) => g + 1);
  }

  function remover(indice: number) {
    setLinhas((atual) => atual.filter((_, i) => i !== indice));
    setGeracao((g) => g + 1);
  }

  /*
   * O rateio é o MESMO da tabela (`ratearComissao`): a casa fica com o resíduo,
   * então preposto + casa fecha no centavo com a comissão da parcela.
   */
  const comissao = (valor: Decimal) => {
    if (!percentual) return null;
    const r = ratearComissao(valor, percentual, percentualPreposto);
    return {
      total: formatarMoeda(r.total.toNumber()),
      fatias: percentualPreposto
        ? `preposto ${formatarMoeda(r.doPreposto.toNumber())} · casa ${formatarMoeda(r.doEscritorio.toNumber())}`
        : null,
    };
  };

  return (
    <div className="space-y-4">
      {!montando ? (
        /*
          O pedido já parcelado abre nas parcelas dele: quase sempre se vem
          trocar uma data ou um valor, não começar de novo.
        */
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-corpo text-tinta-2 leading-relaxed basis-64 grow">
            Estas são as {atuais.length} parcelas gravadas. Mude a data ou o valor de qualquer uma, logo
            abaixo.
          </p>
          <Botao
            type="button"
            variante="secundaria"
            tamanho="compacto"
            icone={RotateCcw}
            onClick={() => setMontando(true)}
            className={ACAO_NO_CELULAR}
          >
            Montar as parcelas de novo
          </Botao>
        </div>
      ) : (
        <div className="space-y-3">
          <Passo numero={1}>Como quer montar as parcelas?</Passo>

          <Escolhas
            nome="Como montar as parcelas"
            atual={modo}
            aoEscolher={(novo) => {
              setModo(novo);
              // Quem troca para as datas com parcelas já na tela parte delas:
              // o campo abre com a quantidade que está embaixo.
              if (novo === "datas" && linhas.length >= 2) setQuantas(String(linhas.length));
            }}
            opcoes={[
              {
                valor: "dias",
                icone: Hash,
                titulo: "Por dias depois da entrega",
                descricao: "Você escreve os dias, como 28/35/42, e o sistema calcula as datas.",
              },
              {
                valor: "datas",
                icone: CalendarDays,
                titulo: "Escolhendo as datas",
                descricao: "Você diz quantas parcelas são e escolhe a data de cada uma no calendário.",
              },
            ]}
          />

          {modo === "dias" && (
            <>
        {/* Pelo topo, com o espaço de um rótulo sobre o botão: o erro dos dias
            aparece embaixo da caixa, e pela base o botão desceria junto. */}
        <div className="flex flex-wrap items-start gap-3">
          <Campo
            id={idDias}
            rotulo="Dias a partir da entrega"
            erro={erroDias ?? undefined}
            value={dias}
            onChange={(e) => {
              setDias(e.currentTarget.value);
              setErroDias(null);
            }}
            onFocus={() => {
              selecionouAoTocar.current = false;
            }}
            onClick={(e) => {
              // Ainda com o prazo do pedido, o primeiro toque seleciona tudo: o que
              // se digita substitui. O segundo já põe o cursor onde se tocou.
              if (situacaoDosDias !== "do-pedido" || selecionouAoTocar.current) return;
              selecionouAoTocar.current = true;
              // `setSelectionRange`, e não `select()`: no Safari do iPhone, só ele seleciona.
              e.currentTarget.setSelectionRange(0, e.currentTarget.value.length);
            }}
            onKeyDown={(e) => {
              // Enter aqui divide, em vez de enviar o formulário de parcelas.
              if (e.key === "Enter") {
                e.preventDefault();
                dividir();
              }
            }}
            placeholder="28/35/42"
            // "decimal", e não "numeric": o teclado numérico do iPhone não tem a
            // barra. Com este vem a vírgula, e "28,35,42" lê igual
            // (`lerPrazoEmDias` aceita qualquer separador).
            inputMode="decimal"
            dica="Um número por parcela, quantos quiser: 30/60/90/120. No celular, separe com vírgula: 30,60,90,120."
            autoComplete="off"
            className="basis-48 grow"
          />
          <div className="max-sm:basis-full">
            <EspacoDoRotulo />
            <div className="flex items-center h-11">
              <Botao
                type="button"
                variante="secundaria"
                icone={Scissors}
                onClick={dividir}
                className="max-sm:w-full max-sm:justify-center"
              >
                Dividir em partes iguais
              </Botao>
            </div>
          </div>
        </div>

        {/*
          De onde vêm os dias, embaixo do campo — em cima, a nota que muda de
          tamanho ao digitar empurraria a caixa para baixo no meio da digitação.
          O prazo do pedido abre o campo só para começar: o pagamento quem decide
          é o representante, com o que combinou com a indústria.
        */}
        {situacaoDosDias && (
          <p
            role="note"
            aria-live="polite"
            className="rounded-suave bg-folha-2 px-4 py-3 text-corpo text-tinta-2 leading-relaxed"
          >
            {situacaoDosDias === "do-pedido" ? (
              <>
                <strong className="text-tinta numerico">{sugerido}</strong> é o prazo de pagamento do pedido, e
                vem preenchido só para começar. Quem decide as parcelas é você: apague e escreva os dias em que a
                indústria vai pagar.
              </>
            ) : (
              <>
                {situacaoDosDias === "vazio"
                  ? "Escreva os dias em que a indústria vai pagar, um por parcela. "
                  : situacaoDosDias === "falta-dividir"
                    ? "Para as parcelas seguirem estes dias, toque em “Dividir em partes iguais”. "
                    : "As parcelas seguem os seus dias. "}
                O prazo do pedido era <strong className="text-tinta numerico">{sugerido}</strong> —{" "}
                <button
                  type="button"
                  onClick={voltarAoPedido}
                  className="relative alvo-toque font-medium text-carimbo underline underline-offset-2
                    decoration-carimbo/35 hover:decoration-carimbo cursor-pointer"
                >
                  voltar a ele
                </button>
                .
              </>
            )}
          </p>
        )}
            </>
          )}

          {modo === "datas" && (
            <>
              {/* Pelo topo, como nos dias: o erro aparece embaixo da caixa. */}
              <div className="flex flex-wrap items-start gap-3">
                <Campo
                  rotulo="Quantas parcelas?"
                  erro={erroDatas ?? undefined}
                  value={quantas}
                  onChange={(e) => {
                    setQuantas(e.currentTarget.value);
                    setErroDatas(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criarPorDatas();
                    }
                  }}
                  numero="inteiro"
                  autoComplete="off"
                  placeholder="3"
                  className="basis-40 grow-0"
                />
                <CampoData
                  name="primeiraParcela"
                  rotulo="Data da primeira parcela"
                  defaultValue={primeira}
                  onChange={(valor) => {
                    setPrimeira(valor);
                    setErroDatas(null);
                  }}
                  atalhos={[]}
                  atalhosUteis={[]}
                  className="basis-56 grow sm:grow-0"
                />
                <div className="max-sm:basis-full">
                  <EspacoDoRotulo />
                  <div className="flex items-center h-11">
                    <Botao
                      type="button"
                      variante="secundaria"
                      icone={CalendarDays}
                      onClick={criarPorDatas}
                      className="max-sm:w-full max-sm:justify-center"
                    >
                      Criar parcelas
                    </Botao>
                  </div>
                </div>
              </div>
              <p role="note" className="rounded-suave bg-folha-2 px-4 py-3 text-corpo text-tinta-2 leading-relaxed">
                As parcelas nascem iguais, uma por mês a partir da primeira. Depois é só trocar a data de
                cada uma no calendário, logo abaixo — não precisa ser todo mês.
              </p>
            </>
          )}
        </div>
      )}

      {linhas.length > 0 && (
        <Formulario estado={estado} action={enviar} className="space-y-3">
          {montando && <Passo numero={2}>Confira as datas e os valores</Passo>}

          {/*
            Antes das parcelas, porque muda o mês de todas: há indústria que
            fatura até um dia e só paga a comissão no mês seguinte.
          */}
          {camposPagamento}

          {/*
            O nome de cada coluna, na mesma grade das linhas. No celular a
            parcela vira bloco, e cada campo já tem o rótulo dele para o leitor
            de tela — o cabeçalho sobraria.
          */}
          <div
            aria-hidden="true"
            className="grid grid-cols-[2.5rem_minmax(15rem,17rem)_minmax(9rem,1fr)_minmax(7rem,auto)_2rem]
              gap-3 text-mini font-medium text-tinta-3 max-sm:hidden"
          >
            <span />
            <span>Vence em</span>
            <span>Valor da venda</span>
            <span>Conta em</span>
            <span />
          </div>

          <ol className="space-y-2">
            {linhas.map((linha, i) => {
              const ultima = i === linhas.length - 1;
              const valor = ultima ? restante : paraDecimal(linha.valor);
              const rende = restanteInvalido ? null : comissao(valor);
              const vence = /^\d{4}-\d{2}-\d{2}$/.test(linha.vencimento) ? linha.vencimento : null;
              const recebe =
                vence && fechaNoDia !== null ? mesDoRecebimento(vence, fechaNoDia) : null;
              // O erro desta parcela — data ou valor —, dito logo embaixo dela.
              const erroDaLinha =
                erroDoCampo(estado, campoDaLinha("vencimento", i)) ??
                erroDoCampo(estado, campoDaLinha("base", i));

              return (
                /*
                  No celular, cada parcela vira um bloco de três faixas — data,
                  valor, e o mês e a comissão —, com o número à esquerda e o ×
                  à direita. A linha de cinco colunas pedia uns 616px, e na folha
                  do iPhone o valor e a comissão ficavam para o lado.
                */
                <li
                  key={`${geracao}-${i}`}
                  className="grid grid-cols-[2.5rem_minmax(15rem,17rem)_minmax(9rem,1fr)_minmax(7rem,auto)_2rem]
                    max-sm:grid-cols-[2rem_minmax(0,1fr)_2rem] max-sm:gap-x-2 max-sm:gap-y-2 items-center gap-3
                    max-sm:border-b max-sm:border-filete max-sm:pb-3 max-sm:last:border-b-0"
                >
                  <span className="text-mini text-tinta-3 numerico">
                    {i + 1}/{linhas.length}
                  </span>

                  <CampoData
                    name="vencimento"
                    rotulo={`Vencimento da parcela ${i + 1}`}
                    rotuloOculto
                    defaultValue={linha.vencimento}
                    onChange={(valor) => mudar(i, "vencimento", valor)}
                  />

                  {ultima ? (
                    /*
                      A última não se digita: é o que sobra da venda. É ela que
                      recebe o "restante para frente" quando as outras mudam.
                    */
                    <div className="max-sm:col-start-2">
                      <input type="hidden" name="base" value={restante.toFixed(2)} />
                      <div
                        className={`${CLASSE_CONTROLE} numerico flex justify-between ${
                          restanteInvalido ? "text-perigo" : "text-tinta-2"
                        }`}
                        aria-live="polite"
                      >
                        <span>{paraCampo(restante.abs())}</span>
                        <span className="text-mini text-tinta-3">restante</span>
                      </div>
                    </div>
                  ) : (
                    <CampoMoeda
                      name="base"
                      rotulo={`Valor da parcela ${i + 1}`}
                      defaultValue={linha.valor}
                      onChange={(e) => mudar(i, "valor", e.currentTarget.value)}
                      className="[&>span:first-child]:sr-only max-sm:col-start-2"
                    />
                  )}

                  <span className="text-mini text-tinta-3 leading-snug max-sm:col-start-2">
                    {recebe ? (
                      <>
                        vence {mesDe(linha.vencimento)}
                        <span className="block text-carimbo font-semibold">
                          → recebe {mesDe(`${recebe}-01`)}
                        </span>
                      </>
                    ) : (
                      mesDe(linha.vencimento)
                    )}
                    {rende && (
                      <>
                        <span className="block numerico">comissão {rende.total}</span>
                        {rende.fatias && <span className="block numerico">{rende.fatias}</span>}
                      </>
                    )}
                  </span>

                  {linhas.length > 2 && !ultima ? (
                    <button
                      type="button"
                      onClick={() => remover(i)}
                      aria-label={`Remover a parcela ${i + 1}`}
                      className="relative alvo-toque grid place-items-center size-8 rounded-full text-tinta-3 transition-colors
                        hover:bg-folha-2 hover:text-perigo cursor-pointer max-sm:col-start-3 max-sm:row-start-1"
                    >
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="max-sm:col-start-3 max-sm:row-start-1" />
                  )}

                  {erroDaLinha && (
                    <p
                      data-invalido=""
                      role="alert"
                      className="col-start-2 col-span-3 max-sm:col-span-1 -mt-1 text-mini text-perigo"
                    >
                      {erroDaLinha}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>

          {restanteInvalido && (
            <MensagemErro>
              As parcelas já somam {formatarMoeda(new Decimal(venda).minus(restante).toNumber())} — mais
              que a venda de {formatarMoeda(Number(venda))}. Diminua alguma para sobrar valor na
              última.
            </MensagemErro>
          )}
          <ErroGeral />
          <MensagemErro>{estadoDesfazer.erro}</MensagemErro>

          {/*
            Botões, todos — "mais uma parcela", "desfazer" e "cancelar" eram
            links de 17px, e passavam por texto de rodapé. No celular viram de
            altura cheia, um embaixo do outro; o desfazer, que apaga, vai por
            último e afastado, como o iOS afasta a ação destrutiva das outras.
          */}
          <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-2">
            <Botao
              type="submit"
              variante="secundaria"
              carregando={salvando}
              disabled={restanteInvalido}
              className="max-sm:w-full max-sm:justify-center max-sm:py-3"
            >
              {salvando ? "Salvando…" : "Salvar parcelas"}
            </Botao>
            <Botao
              type="button"
              variante="secundaria"
              tamanho="compacto"
              icone={Plus}
              onClick={adicionar}
              className={ACAO_NO_CELULAR}
            >
              Adicionar parcela
            </Botao>
            <Botao
              type="button"
              variante="secundaria"
              tamanho="compacto"
              onClick={aoFechar}
              className={ACAO_NO_CELULAR}
            >
              Cancelar
            </Botao>
            {desfazer && (
              <Botao
                type="submit"
                formAction={enviarDesfazer}
                onClick={perguntaDesfazer.aoClicar}
                variante="perigo"
                tamanho="compacto"
                icone={Undo2}
                carregando={desfazendo}
                className={`sm:ml-auto ${ACAO_NO_CELULAR} max-sm:order-last max-sm:mt-2`}
              >
                {desfazendo ? "Desfazendo…" : "Desfazer parcelamento"}
              </Botao>
            )}
            {perguntaDesfazer.janela}
          </div>

          <p className="text-mini text-tinta-3 leading-relaxed">
            Venda de {formatarMoeda(Number(venda))}. Toque na data para trocá-la no calendário. Mude o
            valor de qualquer parcela: a última fica com o restante. Cada parcela conta na comissão do
            mês em que a indústria a paga.
          </p>
        </Formulario>
      )}
    </div>
  );
}
