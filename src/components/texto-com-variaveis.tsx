"use client";

/**
 * Campo de texto que sugere variáveis ao abrir chave, como uma IDE.
 *
 * Feito para quem nunca viu `{numero}` na vida: digitar `{` abre, junto do
 * cursor, a lista dos dados que dá para usar — com o nome de gente ("Número do
 * pedido") e um exemplo do que vai sair. Continuar digitando filtra; setas e
 * Enter (ou o clique) inserem a variável inteira, chave fechada. O botão `{ }`
 * no canto faz o mesmo para quem não sabe do atalho, e ensina o atalho de
 * quebra: ele só escreve a chave.
 *
 * As regras (quando abrir, o que filtra, o que inserir) são as de
 * `lib/sugestao-variaveis.ts`; aqui só se mede onde desenhar.
 */

import { Braces } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";

import {
  filtrarVariaveis,
  gatilhoNoCursor,
  inserirVariavel,
  type Gatilho,
} from "@/lib/sugestao-variaveis";

import { CLASSE_CONTROLE, CLASSE_ERRO, Rotulo } from "./ui";

/**
 * Uma linha da lista de sugestões.
 *
 * Genérica de propósito: quem usa decide o que cada escolha escreve (`abre`, e
 * `fecha` quando é um par, como `{se x}` e `{fim}`) e o que a linha explica.
 */
export type VariavelSugerida = {
  /** Único na lista, e também o que o filtro compara, junto do rótulo. */
  nome: string;
  rotulo: string;
  /** A linha miúda de baixo: um exemplo, um aviso. */
  detalhe: string;
  /** O que vai ser escrito, mostrado em fonte de código antes do detalhe. */
  codigo: string;
  abre: string;
  fecha?: string;
  /** Título miúdo que separa as linhas em seções — "Dados do pedido". */
  grupo?: string;
};

type Controle = HTMLInputElement | HTMLTextAreaElement;

/*
 * Estilos que mudam onde o texto quebra e, portanto, onde o cursor está.
 * Copiá-los para um espelho invisível é o jeito conhecido de saber a posição
 * em pixels de um caractere dentro de um campo — o navegador não expõe isso.
 */
const ESTILOS_ESPELHADOS = [
  "boxSizing", "width", "borderTopWidth", "borderRightWidth", "borderBottomWidth",
  "borderLeftWidth", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
  "textTransform", "wordSpacing", "tabSize",
] as const;

/** Onde, dentro do campo, fica o caractere `indice` — já descontada a rolagem. */
function posicaoDoCaractere(campo: Controle, indice: number) {
  const estilo = getComputedStyle(campo);
  const espelho = document.createElement("div");
  for (const prop of ESTILOS_ESPELHADOS) espelho.style[prop] = estilo[prop];
  espelho.style.position = "absolute";
  espelho.style.visibility = "hidden";
  espelho.style.whiteSpace = campo instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  espelho.style.overflowWrap = "break-word";
  espelho.textContent = campo.value.slice(0, indice);

  const marca = document.createElement("span");
  marca.textContent = "​";
  espelho.appendChild(marca);
  document.body.appendChild(espelho);

  const linha = parseFloat(estilo.lineHeight) || parseFloat(estilo.fontSize) * 1.4;
  const posicao = {
    esquerda: marca.offsetLeft - campo.scrollLeft,
    baixo: marca.offsetTop - campo.scrollTop + linha,
  };
  espelho.remove();
  return posicao;
}

const LARGURA_LISTA = 336;

export function TextoComVariaveis({
  name,
  rotulo,
  variaveis,
  valor,
  aoMudar,
  linhas,
  erro,
}: {
  name: string;
  rotulo: string;
  variaveis: VariavelSugerida[];
  valor: string;
  aoMudar: (valor: string) => void;
  /** Ausente = campo de uma linha, como o assunto. */
  linhas?: number;
  erro?: boolean;
}) {
  const campoRef = useRef<Controle>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const idLista = useId();

  const [gatilho, setGatilho] = useState<Gatilho | null>(null);
  const [destaque, setDestaque] = useState(0);
  const [posicao, setPosicao] = useState({ esquerda: 0, baixo: 0 });
  /** Onde o cursor tem de ficar depois da próxima troca de valor. */
  const cursorPendente = useRef<number | null>(null);
  /** A chave que a pessoa dispensou com Esc — mexer o cursor não reabre. */
  const dispensada = useRef<number | null>(null);

  // O filtro ordena por relevância; aqui as seções voltam a ficar juntas, na
  // ordem em que vieram, para cada título aparecer uma vez só.
  const grupos = [...new Set(variaveis.map((v) => v.grupo))];
  const opcoes = gatilho
    ? filtrarVariaveis(variaveis, gatilho.termo).sort(
        (a, b) => grupos.indexOf(a.grupo) - grupos.indexOf(b.grupo),
      )
    : [];
  // Com espaço no termo e nada casando, a pessoa está escrevendo uma chave de
  // verdade, não procurando — a lista sai do caminho em vez de dizer "nada".
  const aberto = gatilho !== null && (opcoes.length > 0 || !gatilho.termo.includes(" "));

  /** Relê o cursor: abre, filtra ou fecha a lista conforme a chave antes dele. */
  function acompanhar() {
    const campo = campoRef.current;
    if (!campo) return;

    const novo = gatilhoNoCursor(campo.value, campo.selectionStart ?? 0);
    if (!novo || novo.inicio === dispensada.current) {
      setGatilho(null);
      return;
    }

    if (novo.inicio !== gatilho?.inicio || novo.termo !== gatilho.termo) setDestaque(0);
    setGatilho(novo);

    const lugar = posicaoDoCaractere(campo, novo.inicio);
    const largura = caixaRef.current?.clientWidth ?? LARGURA_LISTA;
    setPosicao({
      esquerda: Math.max(0, Math.min(lugar.esquerda, largura - LARGURA_LISTA)),
      baixo: Math.min(lugar.baixo, campo.clientHeight),
    });
  }

  /** Escreve e põe o cursor onde a pessoa espera, depois que o React desenhar. */
  function escrever(texto: string, cursor: number) {
    cursorPendente.current = cursor;
    aoMudar(texto);
  }

  /*
   * O cursor vai para o lugar certo logo depois que o React troca o valor —
   * trocar o valor joga o cursor para o fim, e um `requestAnimationFrame`
   * chegava tarde: quem digita rápido escrevia depois do `{fim}`. A lista se
   * atualiza sozinha pelo `onSelect` que o próprio `setSelectionRange` dispara.
   */
  /** A lista rola junto com a seta: o destaque nunca sai da vista. */
  useLayoutEffect(() => {
    if (!aberto) return;
    listaRef.current
      ?.querySelector(`[id="${idLista}-${destaque}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [aberto, destaque, idLista]);

  useLayoutEffect(() => {
    const campo = campoRef.current;
    const cursor = cursorPendente.current;
    if (!campo || cursor === null) return;
    cursorPendente.current = null;
    campo.focus();
    campo.setSelectionRange(cursor, cursor);
  });

  function escolher(variavel: VariavelSugerida) {
    const campo = campoRef.current;
    if (!campo || !gatilho) return;
    const resultado = inserirVariavel(
      campo.value,
      gatilho.inicio,
      campo.selectionStart ?? 0,
      variavel.abre,
      variavel.fecha,
    );
    setGatilho(null);
    escrever(resultado.texto, resultado.cursor);
  }

  /** O botão `{ }`: escreve a chave no cursor, e a lista abre sozinha. */
  function abrirChave() {
    const campo = campoRef.current;
    if (!campo) return;
    const inicio = campo.selectionStart ?? campo.value.length;
    const fim = campo.selectionEnd ?? inicio;
    dispensada.current = null;
    escrever(campo.value.slice(0, inicio) + "{" + campo.value.slice(fim), inicio + 1);
  }

  function aoTeclar(evento: React.KeyboardEvent<Controle>) {
    if (!aberto) return;

    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setDestaque((i) => (i + passo + opcoes.length) % Math.max(1, opcoes.length));
      return;
    }

    if ((evento.key === "Enter" || evento.key === "Tab") && opcoes[destaque]) {
      // Sem isto, o Enter também quebraria a linha — ou enviaria o formulário.
      evento.preventDefault();
      escolher(opcoes[destaque]);
      return;
    }

    if (evento.key === "Escape") {
      evento.preventDefault();
      dispensada.current = gatilho.inicio;
      setGatilho(null);
    }
  }

  const propsCampo = {
    name,
    value: valor,
    autoComplete: "off",
    spellCheck: false,
    role: "combobox",
    "aria-expanded": aberto,
    "aria-controls": idLista,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": aberto && opcoes[destaque] ? `${idLista}-${destaque}` : undefined,
    onChange: (evento: React.ChangeEvent<Controle>) => {
      // Chave nova digitada = pedido novo; a dispensa valia só para a antiga.
      if (evento.target.value.length > valor.length) dispensada.current = null;
      aoMudar(evento.target.value);
    },
    onSelect: acompanhar,
    onKeyDown: aoTeclar,
    onBlur: () => setGatilho(null),
    className: `${CLASSE_CONTROLE} pr-11 ${linhas ? "resize-y" : ""} ${erro ? CLASSE_ERRO : ""}`,
  };

  return (
    <div>
      <label htmlFor={`${idLista}-campo`}>
        <Rotulo>{rotulo}</Rotulo>
      </label>

      <div ref={caixaRef} className="relative">
        {linhas ? (
          <textarea
            {...propsCampo}
            id={`${idLista}-campo`}
            ref={campoRef as React.Ref<HTMLTextAreaElement>}
            rows={linhas}
          />
        ) : (
          <input
            {...propsCampo}
            id={`${idLista}-campo`}
            ref={campoRef as React.Ref<HTMLInputElement>}
            type="text"
          />
        )}

        <button
          type="button"
          title="Inserir um dado do pedido"
          aria-label="Inserir um dado do pedido"
          // Segura o foco no campo: é de lá que sai a posição do cursor.
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={abrirChave}
          className={`absolute right-2 ${linhas ? "top-2" : "top-1/2 -translate-y-1/2"}
            rounded-miudo p-1.5 text-tinta-3 transition-colors hover:bg-folha-2 hover:text-tinta`}
        >
          <Braces size={15} strokeWidth={2} aria-hidden="true" />
        </button>

        {aberto && (
          <div
            className="folha absolute z-50 mt-1 overflow-hidden"
            style={{ left: posicao.esquerda, top: posicao.baixo, width: LARGURA_LISTA }}
          >
            <ul
              ref={listaRef}
              id={idLista}
              role="listbox"
              className="max-h-80 overflow-y-auto py-1"
            >
              {opcoes.length === 0 && (
                <li className="px-3.5 py-2 text-corpo text-tinta-3">
                  Nenhum dado com esse nome.
                </li>
              )}

              {opcoes.map((variavel, i) => [
                variavel.grupo && variavel.grupo !== opcoes[i - 1]?.grupo && (
                  <li
                    key={`grupo-${variavel.grupo}`}
                    role="presentation"
                    className="px-3.5 pt-2 pb-1 text-mini font-semibold uppercase tracking-wide text-tinta-3"
                  >
                    {variavel.grupo}
                  </li>
                ),
                <li
                  key={variavel.nome}
                  id={`${idLista}-${i}`}
                  role="option"
                  aria-selected={i === destaque}
                  onMouseDown={(evento) => evento.preventDefault()}
                  // `onMouseMove`, não `onMouseEnter`: com a seta a lista rola por
                  // baixo do ponteiro parado, e o item que passa sob ele não pode
                  // roubar o destaque de quem está no teclado.
                  onMouseMove={() => destaque !== i && setDestaque(i)}
                  onClick={() => escolher(variavel)}
                  className={`cursor-pointer border-l-2 px-3.5 py-2 transition-colors ${
                    i === destaque ? "border-carimbo bg-carimbo-fraco" : "border-transparent"
                  }`}
                >
                  <div className="text-corpo text-tinta">{variavel.rotulo}</div>
                  <div className="text-mini text-tinta-3">
                    <code className="text-tinta-2">{variavel.codigo}</code> · {variavel.detalhe}
                  </div>
                </li>,
              ])}
            </ul>

            <div className="border-t border-filete px-3.5 py-1.5 text-mini text-tinta-3">
              ↑↓ escolher · Enter inserir · Esc fechar
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
