"use client";

/**
 * Campo de data com calendário próprio, no lugar do `<input type="date">`.
 *
 * O nativo muda de cara a cada navegador, fala a língua do sistema e não
 * aceita a paleta do app — no Windows escuro, abria um calendário branco no
 * meio da tela. Este mostra a data como se fala ("Sex., 09 de out. de 2026 ·
 * em 10 dias"), abre um mês inteiro em português e traz atalhos para os prazos
 * de sempre — em dias corridos ou úteis, pulando fim de semana e feriado —,
 * que é como o prazo de entrega é combinado com a indústria. Os feriados do mês
 * aparecem marcados na grade e listados embaixo dela.
 *
 * Quem já sabe a data DIGITA, como no `CampoHora`: no topo do calendário há
 * uma caixa, e "15102026" vira "15/10/2026" sem a pessoa escrever as barras
 * (`mascararData`). Data completa é PRÉVIA — o calendário pula para o mês e
 * acende o dia. Vira valor ao confirmar: Enter ou clique fora. Esc desiste.
 * Clicar num dia ou num atalho continua escolhendo na hora.
 *
 * Aberto com o mouse ou o teclado, a caixa já vem focada e selecionada: é só
 * sair digitando. Com o dedo não — o teclado do celular subiria por cima do
 * calendário, que é o jeito de quem está no celular; quer digitar, toca nela.
 *
 * No formulário continua saindo `aaaa-mm-dd` num input escondido: a Server
 * Action do outro lado não muda. As contas são as de `lib/calendario.ts`.
 *
 * Teclado: digitar e Enter confirma; seta para baixo desce para a grade, onde
 * as setas andam pelos dias, PageUp/PageDown trocam o mês e Enter escolhe; Esc
 * fecha e devolve o foco ao campo.
 */

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  dataCompleta,
  dataCurta,
  dataDigitada,
  dataPorExtenso,
  dataValida,
  diasUteisEntre,
  distanciaDeHoje,
  ehFimDeSemana,
  feriadosDoAno,
  hojeIso,
  inicioDoMes,
  lerData,
  mascararData,
  nomeDoFeriado,
  nomeDoMes,
  semanasDoMes,
  somarDias,
  somarDiasUteis,
  somarMeses,
  type DataIso,
} from "@/lib/calendario";

import {
  estiloDoLugar,
  LUGAR_INICIAL,
  medirLugar,
  useCamadaDeTopo,
} from "./camada-flutuante";
import { useCampoDoFormulario } from "./contexto-formulario";
import { focarSePuder } from "./foco";
import { CLASSE_CONTROLE, CLASSE_ERRO, RodapeCampo, Rotulo } from "./ui";

const DIAS_DA_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOMES_DOS_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Espaço que o calendário aberto ocupa — abaixo dele não cabendo, abre para cima. */
const ALTURA_CALENDARIO = 560;
const LARGURA_CALENDARIO = 304;

export function CampoData({
  name,
  rotulo,
  defaultValue = "",
  dica,
  erro: erroExplicito,
  disabled = false,
  atalhos = [7, 15, 30, 45],
  atalhosUteis = [5, 10, 15, 20],
  rotuloOculto = false,
  className,
  onChange,
}: {
  name: string;
  rotulo: string;
  defaultValue?: string;
  dica?: string;
  /** Sem ele, o erro vem do `Formulario` pelo `name`. */
  erro?: string;
  disabled?: boolean;
  /** Prazos em dias corridos a partir de hoje, oferecidos como botões. */
  atalhos?: number[];
  /** Os mesmos botões quando a pessoa conta em dias úteis. */
  atalhosUteis?: number[];
  /**
   * Rótulo só para leitor de tela — numa linha de tabela, o cabeçalho da
   * coluna já diz o que é.
   */
  rotuloOculto?: boolean;
  className?: string;
  /** Avisa a cada data escolhida (ou tirada), para quem faz conta com ela. */
  onChange?: (valor: string) => void;
}) {
  const doFormulario = useCampoDoFormulario(name);
  const erro = erroExplicito ?? doFormulario.erro;
  const [valor, setValorInterno] = useState(dataValida(defaultValue) ? defaultValue : "");
  const setValor = (novo: string) => {
    setValorInterno(novo);
    onChange?.(novo);
  };
  /** Data que já passou (entrega, pagamento) não tem prazo a contar. */
  const comAtalhos = atalhos.length > 0 || atalhosUteis.length > 0;
  const [aberto, setAberto] = useState(false);
  /** Onde o calendário se desenha, em coordenadas da PÁGINA (ver `medir`). */
  const [lugar, setLugar] = useState(LUGAR_INICIAL);
  const paraCima = lugar.paraCima;
  /** O dia com o foco do teclado; o mês mostrado é sempre o dele. */
  const [foco, setFoco] = useState<DataIso>(valor || hojeIso());
  /**
   * Como os atalhos contam. "15 dias úteis" é como muita indústria promete
   * prazo — e fazer essa conta de cabeça, pulando sábado, domingo e feriado,
   * é onde o erro de um dia entra.
   */
  const [contagem, setContagem] = useState<"corridos" | "uteis">("corridos");
  /** A data que o calendário mostra acesa enquanto está aberto — ainda não é o valor. */
  const [previa, setPrevia] = useState<DataIso | "">("");
  /** O texto da caixa de digitar, como está — pode estar no meio de "15/10/2". */
  const [digitado, setDigitado] = useState("");
  const [naoEntendi, setNaoEntendi] = useState(false);

  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const calendarioRef = useRef<HTMLDivElement>(null);
  const digitarRef = useRef<HTMLInputElement>(null);
  /** Aberto com o dedo: a caixa de digitar não ganha o foco (ver o topo). */
  const abertoComODedo = useRef(false);
  /**
   * O foco está andando pela grade (setas, PageUp): o dia novo recebe o foco.
   * Fora dela não — digitar uma data muda o dia destacado, e o foco sairia da
   * caixa no meio da digitação.
   */
  const focoNaGrade = useRef(false);
  const idCalendario = useId();

  const hoje = hojeIso();
  const distancia = valor
    ? distanciaDeHoje(valor, hoje) +
      (valor > somarDias(hoje, 1) ? ` (${diasUteisEntre(hoje, valor)} úteis)` : "")
    : "";
  const resumo = valor ? `${dataPorExtenso(valor)} · ${distancia}` : undefined;

  /**
   * Para que lado abre e onde, a partir da caixa do campo.
   *
   * Sobe só se couber INTEIRO em cima — descontada a barra do topo, que é fixa
   * e cobriria o título do mês. Não cabendo em lado nenhum, desce: a página
   * rola, e o efeito abaixo traz o calendário inteiro para a vista.
   *
   * A posição é da página (janela + rolagem) porque o calendário mora no
   * `<body>`: assim ele rola junto com o campo sem precisar ouvir a rolagem.
   */
  function medir() {
    if (!botaoRef.current) return;
    setLugar(
      medirLugar(botaoRef.current, {
        largura: LARGURA_CALENDARIO,
        altura: ALTURA_CALENDARIO,
        alinhar: "esquerda",
      }),
    );
  }

  function abrir() {
    medir();
    setFoco(valor || hoje);
    setPrevia(valor);
    setDigitado(dataDigitada(valor));
    setNaoEntendi(false);
    focoNaGrade.current = false;
    setAberto(true);
  }

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) focarSePuder(botaoRef.current);
  }

  function escolher(iso: DataIso) {
    setValor(iso);
    fechar();
  }

  /** O que está na caixa, se der para entender: vazio é "sem data"; ilegível é `null`. */
  function dataDaCaixa(): DataIso | null {
    return digitado.trim() === "" ? "" : lerData(digitado, hoje);
  }

  /** Enter: confirma o que está na caixa, ou avisa que não deu. */
  function confirmar() {
    const data = dataDaCaixa();
    if (data === null) setNaoEntendi(true);
    else escolher(data);
  }

  /**
   * Enquanto digita, a data já completa entra na prévia: o calendário vai para
   * o mês dela e acende o dia. O aviso de "não existe" só aparece no Enter — no
   * meio de "15/10/2" a data ainda não está errada, só incompleta.
   */
  function aoDigitar(texto: string) {
    const pontuado = mascararData(texto);
    setDigitado(pontuado);
    setNaoEntendi(false);
    const data = dataCompleta(pontuado);
    if (data) {
      setPrevia(data);
      setFoco(data);
    }
  }

  function aoTeclarNaDigitacao(evento: React.KeyboardEvent<HTMLInputElement>) {
    // Apagar logo depois da barra leva o dígito junto: sem isso a máscara a
    // poria de volta, e o Backspace pareceria não funcionar.
    const caixa = evento.currentTarget;
    if (
      evento.key === "Backspace" &&
      digitado.endsWith("/") &&
      caixa.selectionStart === digitado.length &&
      caixa.selectionEnd === digitado.length
    ) {
      evento.preventDefault();
      aoDigitar(digitado.slice(0, -2));
      return;
    }

    if (evento.key === "Enter") {
      // Dentro de um formulário, Enter enviaria tudo — aqui ele confirma a data.
      evento.preventDefault();
      confirmar();
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      focoNaGrade.current = true;
      gradeRef.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
    }
  }

  /*
   * Clique fora também confirma — quem digitou e clicou no formulário espera
   * ver a data lá. O que não deu para entender fica de fora: o calendário já
   * está fechando e não tem onde avisar, então vale o que já era.
   */
  const aoClicarFora = useRef(() => {});
  useEffect(() => {
    aoClicarFora.current = () => {
      const data = dataDaCaixa();
      if (data !== null && data !== valor) setValor(data);
      setAberto(false);
    };
  });

  useCamadaDeTopo(calendarioRef, lugar, aberto, medir);

  /* Clique fora fecha, sem roubar o foco de onde a pessoa clicou. */
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target as Node;
      // O calendário está no <body>, fora da raiz: os dois contam como "dentro".
      if (!raizRef.current?.contains(alvo) && !calendarioRef.current?.contains(alvo)) {
        aoClicarFora.current();
      }
    };
    document.addEventListener("pointerdown", fora);
    // Janela mudou de tamanho: o campo andou, o calendário vai atrás.
    window.addEventListener("resize", medir);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("resize", medir);
    };
  }, [aberto]);

  const semanas = semanasDoMes(foco);
  const mesMostrado = inicioDoMes(foco).slice(0, 7);
  const feriadosDoMes = [...feriadosDoAno(Number(mesMostrado.slice(0, 4)))]
    .filter(([dia]) => dia.startsWith(mesMostrado))
    .sort(([a], [b]) => a.localeCompare(b));

  /*
   * Aberto para baixo sem espaço, rola o mínimo para ele caber na tela — e de
   * novo quando ele muda de altura (outro mês com mais feriados, outra contagem).
   */
  useEffect(() => {
    if (aberto && !paraCima) calendarioRef.current?.scrollIntoView({ block: "nearest" });
  }, [aberto, paraCima, mesMostrado, contagem]);

  /*
   * Abriu com o mouse ou o teclado: o foco vai para a caixa de digitar, com o
   * texto selecionado — o primeiro número digitado já substitui o que estava.
   */
  useEffect(() => {
    if (!aberto || abertoComODedo.current) return;
    digitarRef.current?.focus({ preventScroll: true });
    digitarRef.current?.select();
  }, [aberto]);

  /*
   * Andando pela grade, o foco do teclado acompanha o dia destacado, inclusive
   * ao trocar de mês. Só o do teclado: com o dedo, o dia não vem aceso (`foco.ts`).
   */
  useEffect(() => {
    if (!aberto || !focoNaGrade.current) return;
    focarSePuder(gradeRef.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`));
  }, [aberto, foco]);

  function aoTeclarNaGrade(evento: React.KeyboardEvent) {
    const passos: Record<string, () => DataIso> = {
      ArrowLeft: () => somarDias(foco, -1),
      ArrowRight: () => somarDias(foco, 1),
      ArrowUp: () => somarDias(foco, -7),
      ArrowDown: () => somarDias(foco, 7),
      PageUp: () => somarMeses(foco, -1),
      PageDown: () => somarMeses(foco, 1),
    };
    const passo = passos[evento.key];
    if (passo) {
      evento.preventDefault();
      setFoco(passo());
    }
  }

  return (
    <div
      ref={raizRef}
      className={`relative ${className ?? ""}`}
      onKeyDown={(evento) => {
        if (evento.key === "Escape" && aberto) {
          evento.preventDefault();
          fechar();
        }
      }}
    >
      {rotuloOculto ? <span className="sr-only">{rotulo}</span> : <Rotulo>{rotulo}</Rotulo>}
      {/* Desabilitado como o nativo: campo travado não vai no formulário. */}
      <input type="hidden" name={name} value={valor} disabled={disabled} />

      <button
        ref={botaoRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={idCalendario}
        aria-label={`${rotulo}: ${valor ? dataPorExtenso(valor) : "sem data"}`}
        // Botão não aceita `aria-invalid`; o `Formulario` acha o campo por aqui.
        data-invalido={erro ? "" : undefined}
        aria-describedby={erro || dica ? `${idCalendario}-rodape` : undefined}
        disabled={disabled}
        onPointerDown={(evento) => {
          abertoComODedo.current = evento.pointerType === "touch";
        }}
        onKeyDown={() => {
          abertoComODedo.current = false;
        }}
        onClick={() => (aberto ? fechar() : abrir())}
        className={`${CLASSE_CONTROLE} ${erro ? CLASSE_ERRO : ""} flex items-center gap-2.5 text-left`}
      >
        <CalendarDays
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className="shrink-0 text-tinta-3"
        />
        {valor ? (
          // Em coluna estreita o fim é cortado com reticências; o texto inteiro
          // fica no `title`, ao passar o mouse.
          <span className="min-w-0 truncate" title={resumo}>
            <span className="text-tinta">{dataCurta(valor, hoje)}</span>
            <span className="text-tinta-3"> · {distancia}</span>
          </span>
        ) : (
          <span className="text-tinta-3">Escolher data</span>
        )}
      </button>

      <RodapeCampo erro={erro} dica={dica} id={`${idCalendario}-rodape`} />

      {/*
        No <body>, e não ao lado do campo: cada bloco da página entra com uma
        animação de opacidade, que abre uma camada própria — e o cartão seguinte
        era pintado POR CIMA do calendário, qualquer que fosse o z-index dele.
      */}
      {aberto &&
        createPortal(
          <div
            ref={calendarioRef}
            id={idCalendario}
            role="dialog"
            aria-label={`Escolher ${rotulo.toLowerCase()}`}
            popover={lugar.emDialogo ? "manual" : undefined}
            style={estiloDoLugar(lugar, LARGURA_CALENDARIO)}
            className="folha absolute z-50 scroll-mb-4 scroll-mt-20 p-3"
            onFocus={(evento) => {
              focoNaGrade.current = gradeRef.current?.contains(evento.target) ?? false;
            }}
          >
            {/*
              A data, grande — e é aqui que se digita, como na hora. Parece o
              número de resposta, não uma caixa de formulário: o traço azul
              embaixo só acende com o foco.
            */}
            <div className="px-1 pb-3">
              <div className="flex items-baseline justify-between gap-3">
                <input
                  ref={digitarRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={digitado}
                  onChange={(evento) => aoDigitar(evento.target.value)}
                  onKeyDown={aoTeclarNaDigitacao}
                  placeholder="dd/mm/aaaa"
                  aria-label={`${rotulo}: digitar a data`}
                  aria-invalid={naoEntendi || undefined}
                  aria-describedby={`${idCalendario}-digitar`}
                  // Sem o contorno de foco global: aqui o traço azul embaixo
                  // é o indicador. Inline porque a regra global, fora das
                  // camadas, vence o `outline-none` do Tailwind.
                  style={{ outline: "none" }}
                  className={`w-0 min-w-0 flex-1 bg-transparent text-forte font-bold text-tinta numerico
                    placeholder:font-normal placeholder:text-tinta-3 border-b-2 transition-colors ${
                      naoEntendi ? "border-perigo" : "border-transparent focus:border-carimbo"
                    }`}
                />
                <span className="shrink-0 text-mini text-tinta-3" aria-live="polite">
                  {previa ? distanciaDeHoje(previa, hoje) : "sem data"}
                </span>
              </div>
              <p
                id={`${idCalendario}-digitar`}
                className={`mt-1 text-mini ${naoEntendi ? "text-perigo" : "text-tinta-3"}`}
              >
                {naoEntendi
                  ? "Essa data não existe. Digite dia, mês e ano só com números, como 15102026."
                  : "Digite só os números — 15102026 vira 15/10/2026 — e Enter, ou escolha abaixo."}
              </p>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => setFoco(somarMeses(foco, -1))}
                className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className="text-corpo font-semibold text-tinta" aria-live="polite">
                {nomeDoMes(foco)}
              </span>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => setFoco(somarMeses(foco, 1))}
                className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta"
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div ref={gradeRef} role="grid" onKeyDown={aoTeclarNaGrade}>
              <div role="row" className="grid grid-cols-7">
                {DIAS_DA_SEMANA.map((letra, i) => (
                  <span
                    key={i}
                    role="columnheader"
                    aria-label={NOMES_DOS_DIAS[i]}
                    className="py-1 text-center text-mini font-semibold text-tinta-3"
                  >
                    {letra}
                  </span>
                ))}
              </div>

              {semanas.map((semana) => (
                <div key={semana[0]} role="row" className="grid grid-cols-7 gap-y-0.5">
                  {semana.map((dia) => {
                    const doMes = dia.slice(0, 7) === mesMostrado;
                    const escolhido = dia === previa;
                    const ehHoje = dia === hoje;
                    const feriado = nomeDoFeriado(dia);
                    return (
                      <button
                        key={dia}
                        type="button"
                        role="gridcell"
                        data-dia={dia}
                        tabIndex={dia === foco ? 0 : -1}
                        aria-selected={escolhido}
                        aria-current={ehHoje ? "date" : undefined}
                        aria-label={`${dataPorExtenso(dia)}${feriado ? `, feriado: ${feriado}` : ""}`}
                        title={feriado ?? undefined}
                        onClick={() => escolher(dia)}
                        className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-corpo
                        numerico transition-colors outline-none
                        focus-visible:ring-2 focus-visible:ring-carimbo
                        ${
                          escolhido
                            ? "bg-carimbo font-semibold text-folha"
                            : `hover:bg-folha-2 ${
                                ehHoje
                                  ? "font-semibold text-carimbo ring-1 ring-inset ring-carimbo"
                                  : ""
                              } ${
                                !doMes
                                  ? "text-tinta-3 opacity-50"
                                  : ehFimDeSemana(dia) || feriado
                                    ? "text-tinta-3"
                                    : "text-tinta"
                              }`
                        }`}
                      >
                        {Number(dia.slice(8))}
                        {feriado && (
                          <span
                            aria-hidden="true"
                            className={`absolute bottom-1 h-1 w-1 rounded-full ${
                              escolhido ? "bg-folha" : "bg-perigo"
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {feriadosDoMes.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-mini text-tinta-3">
                {feriadosDoMes.map(([dia, nome]) => (
                  <li key={dia} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-perigo" />
                    <span className="numerico">{Number(dia.slice(8))}</span> {nome}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 border-t border-filete pt-3">
              {comAtalhos && (
              <>
              <div
                role="group"
                aria-label="Contar prazo em"
                className="mb-2 inline-flex rounded-full border border-filete p-0.5 text-mini"
              >
                {(
                  [
                    ["corridos", "Dias corridos"],
                    ["uteis", "Dias úteis"],
                  ] as const
                ).map(([modo, texto]) => (
                  <button
                    key={modo}
                    type="button"
                    aria-pressed={contagem === modo}
                    onClick={() => setContagem(modo)}
                    className={`rounded-full px-2.5 py-0.5 transition-colors ${
                      contagem === modo
                        ? "bg-folha-2 font-semibold text-tinta"
                        : "text-tinta-3 hover:text-tinta"
                    }`}
                  >
                    {texto}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(contagem === "uteis" ? atalhosUteis : atalhos).map((dias) => {
                  const alvo =
                    contagem === "uteis" ? somarDiasUteis(hoje, dias) : somarDias(hoje, dias);
                  return (
                    <button
                      key={dias}
                      type="button"
                      title={dataCurta(alvo)}
                      onClick={() => escolher(alvo)}
                      className={`rounded-full border px-2.5 py-1 text-mini transition-colors ${
                        alvo === previa
                          ? "border-carimbo bg-carimbo-fraco text-carimbo"
                          : "border-filete text-tinta-2 hover:border-carimbo hover:text-tinta"
                      }`}
                    >
                      {dias}{" "}
                      {contagem === "uteis"
                        ? dias === 1 ? "útil" : "úteis"
                        : dias === 1 ? "dia" : "dias"}
                    </button>
                  );
                })}
              </div>
              </>
              )}

              <div className={`${comAtalhos ? "mt-2.5 " : ""}flex items-center justify-between text-mini`}>
                <button
                  type="button"
                  onClick={() => escolher(hoje)}
                  className="text-carimbo hover:underline"
                >
                  Hoje
                </button>
                {valor && (
                  <button
                    type="button"
                    onClick={() => {
                      setValor("");
                      fechar();
                    }}
                    className="flex items-center gap-1 text-tinta-3 hover:text-tinta"
                  >
                    <X size={12} strokeWidth={2} aria-hidden="true" />
                    Tirar a data
                  </button>
                )}
              </div>
            </div>
          </div>,
          lugar.destino ?? document.body,
        )}
    </div>
  );
}
