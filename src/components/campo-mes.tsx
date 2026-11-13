"use client";

/**
 * Campo de MÊS, com a grade do ano inteiro — a mesma do `SeletorMes` do topo das
 * comissões e dos gráficos, e a mesma caixa do `CampoData`.
 *
 * Era um `<select>` nativo com os meses em fila: no Windows abria uma lista
 * cinza de treze linhas, fora da paleta e diferente de todo outro lugar do app
 * onde se escolhe mês. Aqui o mês é escolhido como no topo da tela: o ano com
 * as setas, os doze meses numa grade, o escolhido em azul e o de hoje com o
 * anel.
 *
 * Os meses fora do intervalo (`min`/`max`) aparecem, mas apagados e sem clique:
 * a grade continua com doze casas, e a pessoa vê que agosto existe e não pode
 * ser escolhido. `marcas` põem um ponto sob um mês e dizem embaixo o que ele é
 * ("mês do pedido") — o ponto do feriado no calendário, o da meta no seletor.
 *
 * No formulário sai `AAAA-MM` num input escondido. As contas são de string,
 * como no `SeletorMes`: `lib/comissao` traria o `decimal.js` para cá.
 *
 * Teclado: setas andam pelos meses (para cima e para baixo, uma fileira),
 * PageUp/PageDown trocam o ano, Enter escolhe, Esc fecha.
 */

import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { estiloDoLugar, LUGAR_INICIAL, medirLugar, useCamadaDeTopo } from "./camada-flutuante";
import { useCampoDoFormulario } from "./contexto-formulario";
import { focarSePuder } from "./foco";
import { CLASSE_CONTROLE, CLASSE_ERRO, RodapeCampo, Rotulo } from "./ui";

const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const MES_LONGO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "jan", "fev"… — sem o ponto de abreviação, como no `SeletorMes`. */
const CURTOS = Array.from({ length: 12 }, (_, i) =>
  MES_CURTO.format(new Date(Date.UTC(2000, i, 1))).replace(".", ""),
);

const LARGURA = 288;
/** O ano, três fileiras de meses e a legenda: abaixo disso não cabendo, abre para cima. */
const ALTURA = 230;

/** "2026-11" + 3 → "2027-02". */
function deslocar(mes: string, meses: number): string {
  const [ano, m] = mes.split("-").map(Number);
  const total = ano * 12 + (m - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function distancia(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** "novembro de 2026". */
export function nomeDoMesDoCampo(mes: string): string {
  return MES_LONGO.format(new Date(`${mes}-01T00:00:00Z`));
}

/** "este mês", "mês que vem", "daqui a 3 meses" — como o `CampoData` diz "em 10 dias". */
function quandoE(mes: string, hoje: string): string {
  const n = distancia(hoje, mes);
  if (n === 0) return "este mês";
  if (n === 1) return "mês que vem";
  if (n === -1) return "mês passado";
  return n > 1 ? `daqui a ${n} meses` : `há ${-n} meses`;
}

export function CampoMes({
  name,
  rotulo,
  defaultValue,
  hoje,
  min,
  max,
  marcas = [],
  dica,
  erro: erroExplicito,
  className = "",
  onChange,
}: {
  name: string;
  rotulo: string;
  /** "AAAA-MM" com que o campo nasce. */
  defaultValue: string;
  /** "AAAA-MM" de hoje, do servidor: o anel na grade e o "daqui a 2 meses". */
  hoje: string;
  /** Primeiro e último mês que podem ser escolhidos ("AAAA-MM"). */
  min?: string;
  max?: string;
  /** Meses com o ponto, e o que o ponto quer dizer: "mês do pedido". */
  marcas?: { mes: string; texto: string }[];
  dica?: string;
  /** Sem ele, o erro vem do `Formulario` pelo `name`. */
  erro?: string;
  className?: string;
  /** Avisa a cada mês escolhido, para quem mostra o que ele faz. */
  onChange?: (mes: string) => void;
}) {
  const doFormulario = useCampoDoFormulario(name);
  const erro = erroExplicito ?? doFormulario.erro;
  const [valor, setValor] = useState(defaultValue);
  const [aberto, setAberto] = useState(false);
  const [lugar, setLugar] = useState(LUGAR_INICIAL);
  /** O mês com o foco do teclado; o ano mostrado é sempre o dele. */
  const [foco, setFoco] = useState(defaultValue);

  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const dentro = (mes: string) => (!min || mes >= min) && (!max || mes <= max);
  /** O mês mais perto de `mes` que pode ser escolhido. */
  const limitar = (mes: string) => (min && mes < min ? min : max && mes > max ? max : mes);

  function medir() {
    if (!botaoRef.current) return;
    setLugar(medirLugar(botaoRef.current, { largura: LARGURA, altura: ALTURA, alinhar: "esquerda" }));
  }

  function abrir() {
    medir();
    setFoco(valor);
    setAberto(true);
  }

  function fechar(devolverFoco = true) {
    setAberto(false);
    if (devolverFoco) focarSePuder(botaoRef.current);
  }

  function escolher(mes: string) {
    setValor(mes);
    onChange?.(mes);
    fechar();
  }

  useCamadaDeTopo(cartaoRef, lugar, aberto, medir);

  // Clique fora fecha; a janela mudou de tamanho, o cartão vai atrás do campo.
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target as Node;
      if (!raizRef.current?.contains(alvo) && !cartaoRef.current?.contains(alvo)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("resize", medir);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("resize", medir);
    };
  }, [aberto]);

  const ano = Number(foco.slice(0, 4));

  useEffect(() => {
    if (aberto && !lugar.paraCima) cartaoRef.current?.scrollIntoView({ block: "nearest" });
  }, [aberto, lugar.paraCima]);

  // O foco do teclado acompanha o mês destacado, inclusive ao trocar de ano.
  useEffect(() => {
    if (!aberto) return;
    focarSePuder(gradeRef.current?.querySelector<HTMLButtonElement>(`[data-mes="${foco}"]`));
  }, [aberto, foco]);

  function aoTeclarNaGrade(evento: React.KeyboardEvent) {
    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -4,
      ArrowDown: 4,
      PageUp: -12,
      PageDown: 12,
    };
    const passo = passos[evento.key];
    if (passo) {
      evento.preventDefault();
      setFoco(limitar(deslocar(foco, passo)));
    }
  }

  // O ano anterior (ou o seguinte) só se abre se tiver algum mês que se escolhe.
  const temAnoAntes = !min || Number(min.slice(0, 4)) < ano;
  const temAnoDepois = !max || Number(max.slice(0, 4)) > ano;
  const marcasDoAno = marcas.filter((m) => m.mes.startsWith(`${ano}-`));

  return (
    <div
      ref={raizRef}
      className={`relative ${className}`}
      onKeyDown={(evento) => {
        if (evento.key === "Escape" && aberto) {
          evento.preventDefault();
          // Esc dentro da folha do celular fecharia a folha inteira junto.
          evento.stopPropagation();
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
        aria-controls={id}
        aria-label={`${rotulo}: ${nomeDoMesDoCampo(valor)}`}
        data-invalido={erro ? "" : undefined}
        aria-describedby={erro || dica ? `${id}-rodape` : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        className={`${CLASSE_CONTROLE} ${erro ? CLASSE_ERRO : ""} flex items-center gap-2.5 text-left cursor-pointer`}
      >
        <CalendarRange size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-tinta-3" />
        <span className="min-w-0 truncate">
          <span className="text-tinta first-letter:uppercase inline-block">{nomeDoMesDoCampo(valor)}</span>
          <span className="text-tinta-3"> · {quandoE(valor, hoje)}</span>
        </span>
      </button>

      <RodapeCampo erro={erro} dica={dica} id={`${id}-rodape`} />

      {/* No <body> (ou na janela aberta), pelo motivo do portal do `CampoData`. */}
      {aberto &&
        createPortal(
          <div
            ref={cartaoRef}
            id={id}
            role="dialog"
            aria-label={`Escolher: ${rotulo.toLowerCase()}`}
            popover={lugar.emDialogo ? "manual" : undefined}
            style={estiloDoLugar(lugar, LARGURA)}
            className="folha absolute z-50 scroll-mb-4 scroll-mt-20 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Ano anterior"
                disabled={!temAnoAntes}
                onClick={() => setFoco(limitar(deslocar(foco, -12)))}
                className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta
                  cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className="text-corpo font-semibold text-tinta numerico" aria-live="polite">
                {ano}
              </span>
              <button
                type="button"
                aria-label="Próximo ano"
                disabled={!temAnoDepois}
                onClick={() => setFoco(limitar(deslocar(foco, 12)))}
                className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta
                  cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div
              ref={gradeRef}
              role="group"
              aria-label={`Meses de ${ano}`}
              onKeyDown={aoTeclarNaGrade}
              className="grid grid-cols-4 gap-1"
            >
              {CURTOS.map((curto, i) => {
                const mes = `${ano}-${String(i + 1).padStart(2, "0")}`;
                const pode = dentro(mes);
                const escolhido = mes === valor;
                const ehHoje = mes === hoje;
                const marca = marcas.find((m) => m.mes === mes);

                return (
                  <button
                    key={mes}
                    type="button"
                    data-mes={mes}
                    disabled={!pode}
                    tabIndex={mes === foco ? 0 : -1}
                    aria-pressed={escolhido}
                    aria-current={ehHoje ? "date" : undefined}
                    aria-label={`${nomeDoMesDoCampo(mes)}${marca ? `, ${marca.texto}` : ""}`}
                    onClick={() => escolher(mes)}
                    className={`relative flex h-9 items-center justify-center rounded-full text-corpo transition-colors
                      outline-none focus-visible:ring-2 focus-visible:ring-carimbo ${
                        escolhido
                          ? "bg-carimbo font-semibold text-folha"
                          : !pode
                            ? "text-tinta-3 opacity-40 cursor-not-allowed"
                            : `text-tinta hover:bg-folha-2 cursor-pointer ${
                                ehHoje ? "font-semibold text-carimbo ring-1 ring-inset ring-carimbo" : ""
                              }`
                      }`}
                  >
                    {curto}
                    {marca && (
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1 h-1 w-1 rounded-full ${escolhido ? "bg-folha" : "bg-tinta-2"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {marcasDoAno.length > 0 && (
              <ul className="mt-2 space-y-0.5 border-t border-filete pt-2 text-mini text-tinta-3">
                {marcasDoAno.map((m) => (
                  <li key={m.mes} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-tinta-2" />
                    {CURTOS[Number(m.mes.slice(5)) - 1]}: {m.texto}
                  </li>
                ))}
              </ul>
            )}
          </div>,
          lugar.destino ?? document.body,
        )}
    </div>
  );
}
