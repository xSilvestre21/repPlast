"use client";

/**
 * Campo de hora com seletor próprio, no lugar do `<input type="time">`.
 *
 * Irmão do `CampoData`, e pelo mesmo motivo: o nativo muda de cara a cada
 * navegador, abre um relógio que não segue a paleta do sistema e, no Windows,
 * é uma caixinha de setas. Aqui a hora aparece como se fala ("14:30 · tarde"),
 * e o cartão que abre mostra os horários de meia em meia hora, separados em
 * manhã, tarde e noite — compromisso de representante quase sempre cai num
 * desses. Para o que não cai, dá para DIGITAR — o cartão abre com o campo de
 * cima focado e selecionado, então é só sair escrevendo "930" ou "14h30" — ou
 * usar o ajuste fino, que anda de hora em hora e de 5 em 5 minutos.
 *
 * Vazio é "o dia inteiro", como antes. No formulário continua saindo `HH:MM`
 * (ou vazio) num input escondido: a Server Action do outro lado não muda.
 *
 * Dentro do cartão tudo é PRÉVIA — digitar e o ajuste fino mexem só nela.
 * Vira valor ao confirmar: Enter, clique num horário, "Pronto" ou clique
 * fora. Esc desiste e deixa como estava. Sem isso, o "2" de quem ia digitar
 * "25h" (que não existe) já tinha virado 02:00 quando o aviso aparecia.
 *
 * Teclado: digitar e Enter confirma; seta para baixo desce para a grade, onde
 * as setas andam pelos horários e Enter escolhe; Esc fecha e devolve o foco
 * ao campo.
 */

import { Clock, Minus, Plus, Sun, Sunrise, Sunset, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  estiloDoLugar,
  LUGAR_INICIAL,
  medirLugar,
  useCamadaDeTopo,
} from "./camada-flutuante";
import { horaCompleta, lerHora, mascararHora } from "@/lib/hora";

import { useCampoDoFormulario } from "./contexto-formulario";
import { CLASSE_CONTROLE, CLASSE_ERRO, RodapeCampo, Rotulo, Segmentado } from "./ui";

type Periodo = "manha" | "tarde" | "noite";

/** Os horários de cada período, de meia em meia hora. */
const PERIODOS: Record<Periodo, { rotulo: string; de: number; ate: number }> = {
  manha: { rotulo: "Manhã", de: 6, ate: 12 },
  tarde: { rotulo: "Tarde", de: 12, ate: 18 },
  noite: { rotulo: "Noite", de: 18, ate: 23 },
};

const ICONE_DO_PERIODO = { manha: Sunrise, tarde: Sun, noite: Sunset };

const LARGURA = 296;
const ALTURA = 400;
/** Colunas da grade — as setas para cima e para baixo pulam esse tanto. */
const COLUNAS = 4;

const HORA_VALIDA = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutosDe(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function horaDe(minutos: number): string {
  const total = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Madrugada conta como noite: é o período em que ela aparece no ajuste. */
function periodoDe(hora: string): Periodo {
  const h = Number(hora.slice(0, 2));
  if (h >= 6 && h < 12) return "manha";
  if (h >= 12 && h < 18) return "tarde";
  return "noite";
}

function rotuloDoPeriodo(hora: string): string {
  const h = Number(hora.slice(0, 2));
  if (h < 6) return "madrugada";
  return { manha: "manhã", tarde: "tarde", noite: "noite" }[periodoDe(hora)];
}

function horariosDo(periodo: Periodo): string[] {
  const { de, ate } = PERIODOS[periodo];
  const lista: string[] = [];
  for (let m = de * 60; m < ate * 60; m += 30) lista.push(horaDe(m));
  return lista;
}

export function CampoHora({
  name,
  rotulo,
  defaultValue = "",
  dica,
  erro: erroExplicito,
  className,
}: {
  name: string;
  rotulo: string;
  defaultValue?: string;
  dica?: string;
  /** Sem ele, o erro vem do `Formulario` pelo `name`. */
  erro?: string;
  className?: string;
}) {
  const doFormulario = useCampoDoFormulario(name);
  const erro = erroExplicito ?? doFormulario.erro;
  // Recusado o envio, volta o que a pessoa tinha escolhido — o React limpa o
  // formulário a cada envio, e um input escondido não se lembra sozinho.
  const inicial = doFormulario.valorDigitado ?? defaultValue;
  const [valor, setValor] = useState(HORA_VALIDA.test(inicial) ? inicial : "");
  const [aberto, setAberto] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("manha");
  const [lugar, setLugar] = useState(LUGAR_INICIAL);
  /** A hora que o cartão mostra enquanto está aberto — ainda não é o valor. */
  const [previa, setPrevia] = useState("");
  /** O texto da caixa de digitar, como está — pode estar no meio de "14h3". */
  const [digitado, setDigitado] = useState("");
  const [naoEntendi, setNaoEntendi] = useState(false);

  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const digitarRef = useRef<HTMLInputElement>(null);
  const idCartao = useId();

  /**
   * Alinhado pela DIREITA do campo: a hora fica na coluna da direita do
   * formulário, e alinhado à esquerda o cartão sairia da janela.
   */
  function medir() {
    if (!botaoRef.current) return;
    setLugar(medirLugar(botaoRef.current, { largura: LARGURA, altura: ALTURA, alinhar: "direita" }));
  }

  function abrir() {
    medir();
    // Sem hora escolhida, abre no período de agora — é o mais provável.
    setPeriodo(periodoDe(valor || horaDe(new Date().getHours() * 60)));
    setPrevia(valor);
    setDigitado(valor);
    setNaoEntendi(false);
    setAberto(true);
  }

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) botaoRef.current?.focus();
  }

  function escolher(hora: string) {
    setValor(hora);
    fechar();
  }

  /**
   * O que está na caixa, se der para entender: vazio é "o dia inteiro";
   * ilegível é `null`.
   */
  function horaDaCaixa(): string | null {
    return digitado.trim() === "" ? "" : lerHora(digitado);
  }

  /** Enter e "Pronto": confirma o que está na caixa, ou avisa que não deu. */
  function confirmar() {
    const hora = horaDaCaixa();
    if (hora === null) setNaoEntendi(true);
    else escolher(hora);
  }

  /*
   * Clique fora também confirma — quem ajustou e clicou no formulário espera
   * ver a hora lá. O que não deu para entender fica de fora: o cartão já está
   * fechando e não tem onde avisar, então vale o que já era.
   */
  const aoClicarFora = useRef(() => {});
  useEffect(() => {
    aoClicarFora.current = () => {
      const hora = horaDaCaixa();
      if (hora !== null) setValor(hora);
      setAberto(false);
    };
  });

  /** Ajuste fino: mexe na prévia e não fecha, para dar vários toques seguidos. */
  function ajustar(minutos: number) {
    const base = previa || `${String(PERIODOS[periodo].de).padStart(2, "0")}:00`;
    const nova = horaDe(minutosDe(base) + minutos);
    setPrevia(nova);
    setDigitado(nova);
    setNaoEntendi(false);
    setPeriodo(periodoDe(nova));
  }

  /**
   * Enquanto digita, a hora já completa entra na prévia: o número da grade e a
   * aba do período acompanham. O aviso de "não entendi" só aparece no Enter — no
   * meio de "14h3" a hora ainda não está errada, só incompleta.
   */
  function aoDigitar(texto: string) {
    // Os dois-pontos entram sozinhos: "1430" aparece "14:30" já digitando.
    const pontuado = mascararHora(texto);
    setDigitado(pontuado);
    setNaoEntendi(false);
    const hora = horaCompleta(pontuado);
    if (hora) {
      setPrevia(hora);
      setPeriodo(periodoDe(hora));
    }
  }

  function aoTeclarNaDigitacao(evento: React.KeyboardEvent<HTMLInputElement>) {
    // Apagar logo depois dos dois-pontos leva o dígito junto: sem isso a
    // máscara os poria de volta, e o Backspace pareceria não funcionar.
    const caixa = evento.currentTarget;
    if (
      evento.key === "Backspace" &&
      digitado.endsWith(":") &&
      caixa.selectionStart === digitado.length &&
      caixa.selectionEnd === digitado.length
    ) {
      evento.preventDefault();
      aoDigitar(digitado.slice(0, -2));
      return;
    }

    if (evento.key === "Enter") {
      // Dentro de um formulário, Enter enviaria tudo — aqui ele confirma a hora.
      evento.preventDefault();
      confirmar();
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      const grade = gradeRef.current;
      (grade?.querySelector<HTMLButtonElement>("[aria-pressed=true]") ??
        grade?.querySelector<HTMLButtonElement>("button"))?.focus();
    }
  }

  useCamadaDeTopo(cartaoRef, lugar, aberto, medir);

  /* Clique fora fecha, sem roubar o foco de onde a pessoa clicou. */
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target as Node;
      if (!raizRef.current?.contains(alvo) && !cartaoRef.current?.contains(alvo)) {
        aoClicarFora.current();
      }
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("resize", medir);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("resize", medir);
    };
  }, [aberto]);

  /* Abriu: o foco vai para a caixa de digitar, com o texto selecionado — o
     primeiro número digitado já substitui o que estava. */
  useEffect(() => {
    if (!aberto) return;
    if (!lugar.paraCima) cartaoRef.current?.scrollIntoView({ block: "nearest" });
    digitarRef.current?.focus();
    digitarRef.current?.select();
  }, [aberto, lugar.paraCima]);

  function aoTeclarNaGrade(evento: React.KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -COLUNAS,
      ArrowDown: COLUNAS,
    };
    const passo = passos[evento.key];
    if (passo === undefined) return;
    evento.preventDefault();
    const botoes = [...evento.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
    botoes[Math.max(0, Math.min(botoes.length - 1, atual + passo))]?.focus();
  }

  const horarios = horariosDo(periodo);

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
      <Rotulo>{rotulo}</Rotulo>
      <input type="hidden" name={name} value={valor} />

      <button
        ref={botaoRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={idCartao}
        aria-label={`${rotulo}: ${valor || "o dia inteiro"}`}
        data-invalido={erro ? "" : undefined}
        aria-describedby={erro || dica ? `${idCartao}-rodape` : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        className={`${CLASSE_CONTROLE} ${erro ? CLASSE_ERRO : ""} flex items-center gap-2.5 text-left`}
      >
        <Clock size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-tinta-3" />
        {valor ? (
          <span className="min-w-0 truncate">
            <span className="text-tinta numerico">{valor}</span>
            <span className="text-tinta-3"> · {rotuloDoPeriodo(valor)}</span>
          </span>
        ) : (
          <span className="text-tinta-3">Dia inteiro</span>
        )}
      </button>

      <RodapeCampo erro={erro} dica={dica} id={`${idCartao}-rodape`} />

      {/* Por cima de tudo, inclusive de janela modal — ver `camada-flutuante.ts`. */}
      {aberto &&
        createPortal(
          <div
            ref={cartaoRef}
            id={idCartao}
            role="dialog"
            aria-label={`Escolher ${rotulo.toLowerCase()}`}
            popover={lugar.emDialogo ? "manual" : undefined}
            style={estiloDoLugar(lugar, LARGURA)}
            className="folha surgir absolute z-50 scroll-mb-4 scroll-mt-20 p-3"
          >
            {/*
              O escolhido, grande — e é aqui que se digita. Parece o número de
              resposta, não uma caixa de formulário: o traço azul embaixo só
              acende com o foco.
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
                  placeholder="--:--"
                  aria-label={`Digitar a ${rotulo.toLowerCase()}`}
                  aria-invalid={naoEntendi || undefined}
                  aria-describedby={`${idCartao}-digitar`}
                  // Sem o contorno de foco global: aqui o traço azul embaixo
                  // é o indicador. Inline porque a regra global, fora das
                  // camadas, vence o `outline-none` do Tailwind.
                  style={{ outline: "none" }}
                  className={`w-32 min-w-0 bg-transparent text-cifra font-bold text-tinta numerico
                    placeholder:text-tinta-3 border-b-2 transition-colors ${
                      naoEntendi ? "border-perigo" : "border-transparent focus:border-carimbo"
                    }`}
                />
                <span className="text-mini text-tinta-3 shrink-0" aria-live="polite">
                  {previa ? `da ${rotuloDoPeriodo(previa)}` : "o dia inteiro"}
                </span>
              </div>
              <p
                id={`${idCartao}-digitar`}
                className={`mt-1 text-mini ${naoEntendi ? "text-perigo" : "text-tinta-3"}`}
              >
                {naoEntendi
                  ? "Essa hora não existe. Digite de 00:00 a 23:59, como 14:30."
                  : "Digite só os números — 1430 vira 14:30 — e Enter, ou escolha abaixo."}
              </p>
            </div>

            <Segmentado
              nome="Período do dia"
              className="w-full [&>button]:flex-1"
              atual={periodo}
              aoEscolher={setPeriodo}
              opcoes={(Object.keys(PERIODOS) as Periodo[]).map((p) => {
                const Icone = ICONE_DO_PERIODO[p];
                return {
                  valor: p,
                  rotulo: (
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Icone size={13} strokeWidth={2} aria-hidden="true" />
                      {PERIODOS[p].rotulo}
                    </span>
                  ),
                };
              })}
            />

            <div
              ref={gradeRef}
              role="group"
              aria-label={`Horários da ${PERIODOS[periodo].rotulo.toLowerCase()}`}
              onKeyDown={aoTeclarNaGrade}
              className="mt-3 grid grid-cols-4 gap-1.5"
            >
              {horarios.map((hora) => {
                const escolhido = hora === previa;
                return (
                  <button
                    key={hora}
                    type="button"
                    aria-pressed={escolhido}
                    onClick={() => escolher(hora)}
                    className={`rounded-full py-1.5 text-rotulo numerico transition-colors outline-none
                      focus-visible:ring-2 focus-visible:ring-carimbo ${
                        escolhido
                          ? "bg-carimbo font-semibold text-sobre-carimbo"
                          : "bg-folha-2 text-tinta hover:bg-carimbo-fraco hover:text-carimbo"
                      }`}
                  >
                    {hora}
                  </button>
                );
              })}
            </div>

            {/* Ajuste fino: para o 9h10 que a grade de meia hora não tem. */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-filete pt-3">
              <span className="text-mini text-tinta-3 whitespace-nowrap">Ajustar</span>
              <div className="flex items-center gap-3">
                <Passo rotulo="hora" aoMenos={() => ajustar(-60)} aoMais={() => ajustar(60)} />
                <Passo rotulo="5 min" aoMenos={() => ajustar(-5)} aoMais={() => ajustar(5)} />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-mini">
              <button
                type="button"
                onClick={() => escolher("")}
                className="flex items-center gap-1 text-tinta-3 hover:text-tinta"
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
                Dia inteiro
              </button>
              <button
                type="button"
                onClick={confirmar}
                className="rounded-full bg-tinta px-3.5 py-1.5 font-semibold text-papel transition-transform hover:-translate-y-px"
              >
                Pronto
              </button>
            </div>
          </div>,
          lugar.destino ?? document.body,
        )}
    </div>
  );
}

function Passo({
  rotulo,
  aoMenos,
  aoMais,
}: {
  rotulo: string;
  aoMenos: () => void;
  aoMais: () => void;
}) {
  const classe =
    "grid place-items-center size-6 rounded-full border border-filete text-tinta-2 transition-colors hover:border-carimbo hover:text-carimbo";
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={`Ajustar ${rotulo}`}>
      <button type="button" onClick={aoMenos} aria-label={`Menos ${rotulo}`} className={classe}>
        <Minus size={12} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <span className="text-mini text-tinta-2 w-9 text-center">{rotulo}</span>
      <button type="button" onClick={aoMais} aria-label={`Mais ${rotulo}`} className={classe}>
        <Plus size={12} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}
