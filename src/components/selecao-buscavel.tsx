"use client";

/**
 * A escolha de uma lista longa, digitando.
 *
 * O `<select>` nativo dá conta de dez opções e atrapalha em oitenta: achar um
 * cliente no meio da carteira inteira exigia rolar até ele, e a busca por tecla
 * do navegador só casa o COMEÇO do nome — quem lembra "Santa Bárbara" e não
 * "CASTRO & MACHI" não chega lá. Aqui a pessoa digita qualquer pedaço, de
 * qualquer palavra, e a lista encolhe junto.
 *
 * O que sai no formulário continua sendo o `id`, num input escondido: a Server
 * Action do outro lado não muda por causa disto.
 *
 * Fica de fora, de propósito, a lista curta — unidade e frete têm duas ou três
 * opções, e uma caixa de busca ali só acrescentaria um passo entre a pessoa e
 * a resposta.
 */

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CLASSE_CONTROLE, CLASSE_ERRO, RodapeCampo, Rotulo } from "./ui";

export type OpcaoBuscavel = {
  id: string;
  rotulo: string;
  /** A desempate: cidade do cliente, alíquota da indústria. Também é buscável. */
  detalhe?: string;
};

/**
 * Sem acento e sem caixa.
 *
 * "Sertãozinho" tem de aparecer para quem digitou "sertaozinho", e "CEPÊRA"
 * para quem digitou "cepera" — ninguém procura cliente com acento certo.
 */
function achatar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Casa quando TODOS os pedaços digitados aparecem, em qualquer ordem.
 *
 * É o que faz "albras embu" achar a ALBRAS de Embu sem obrigar a pessoa a
 * lembrar como o nome e a cidade estão escritos um em relação ao outro.
 */
function casa(opcao: OpcaoBuscavel, termos: string[]): boolean {
  const alvo = achatar(`${opcao.rotulo} ${opcao.detalhe ?? ""}`);
  return termos.every((termo) => alvo.includes(termo));
}

/** O quanto a lista gostaria de ocupar, o mínimo útil, e a folga da borda. */
const ALTURA_DESEJADA = 256;
const ALTURA_MINIMA = 120;
const FOLGA = 12;

/**
 * Para que lado a lista abre.
 *
 * `"auto"` serve ao campo solto no meio de um formulário, onde o espaço varia
 * e medir é melhor que adivinhar. Os outros dois são para quem SABE onde mora:
 * a linha de lançar item é a última coisa da página, embaixo dela nunca há
 * espaço, e deixar a medida decidir faria o mesmo campo abrir ora para um lado
 * ora para o outro conforme a rolagem — o controle parecendo dois controles.
 */
export type LadoDaLista = "auto" | "cima" | "baixo";

type Posicao = { paraCima: boolean; altura: number };

/**
 * Para que lado a lista abre, e de que tamanho.
 *
 * Abrir sempre para baixo quebrava justamente onde mais se usa: a linha de
 * lançar item fica no rodapé de uma página longa, e a lista nascia com uma
 * fatia de si mesma na tela — sete produtos no DOM, um visível. Quem olha
 * conclui que o cliente só tem um produto, e nem percebe que dá para digitar.
 */
function medir(campo: HTMLInputElement, lado: LadoDaLista): Posicao {
  const caixa = campo.getBoundingClientRect();
  const abaixo = window.innerHeight - caixa.bottom - FOLGA;
  const acima = caixa.top - FOLGA;

  // No automático, só sobe quando subir de fato ajuda: caber em cima E caber
  // pior embaixo. Com lado declarado, a medida decide só o TAMANHO.
  const paraCima =
    lado === "auto" ? abaixo < Math.min(ALTURA_DESEJADA, acima) && acima > abaixo : lado === "cima";

  const disponivel = paraCima ? acima : abaixo;

  // O piso ganha do espaço disponível de propósito: uma lista de vinte pixels
  // não serve a ninguém, e é melhor ela rolar por dentro.
  return { paraCima, altura: Math.max(ALTURA_MINIMA, Math.min(ALTURA_DESEJADA, disponivel)) };
}

export function SelecaoBuscavel({
  name,
  rotulo,
  opcoes,
  value,
  defaultValue = "",
  aoEscolher,
  required,
  dica,
  erro,
  placeholder = "Escolha…",
  vazio = "Nada encontrado.",
  lado = "auto",
  className = "",
}: {
  name: string;
  rotulo: string;
  opcoes: OpcaoBuscavel[];
  /** Presente = controlado pelo pai, como no `<select>` do React. */
  value?: string;
  defaultValue?: string;
  aoEscolher?: (id: string) => void;
  required?: boolean;
  dica?: string;
  erro?: string;
  placeholder?: string;
  /** O que a lista diz quando o filtro não deixou nada. */
  vazio?: string;
  /** Fixa o lado onde a lista abre. Ver `LadoDaLista`. */
  lado?: LadoDaLista;
  className?: string;
}) {
  const controlado = value !== undefined;
  const [interno, setInterno] = useState(defaultValue);
  const idSelecionado = controlado ? value : interno;

  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);

  /*
   * `null` é "ainda não digitei nada".
   *
   * O texto da caixa não é guardado: ele é o filtro quando existe um, e o
   * rótulo do escolhido quando não existe. Guardar os dois no mesmo estado
   * obrigaria a reescrever o texto sempre que a escolha mudasse — inclusive
   * quando quem muda é o pai, como a linha de item que zera o produto depois de
   * lançar. Derivar dispensa essa sincronização.
   *
   * Também é o que faz abrir NÃO filtrar: com `null`, a lista vem inteira em
   * vez de encolher para o único item já escolhido.
   */
  const [filtro, setFiltro] = useState<string | null>(null);
  const [posicao, setPosicao] = useState<Posicao>({
    paraCima: false,
    altura: ALTURA_DESEJADA,
  });

  const raizRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const idCampo = useId();
  const idLista = useId();

  const rotuloSelecionado = useMemo(
    () => opcoes.find((o) => o.id === idSelecionado)?.rotulo ?? "",
    [opcoes, idSelecionado],
  );

  const filtradas = useMemo(() => {
    const termos = achatar(filtro ?? "")
      .split(/\s+/)
      .filter(Boolean);
    if (termos.length === 0) return opcoes;
    return opcoes.filter((o) => casa(o, termos));
  }, [opcoes, filtro]);

  /*
   * `required` num input escondido é ignorado pelo navegador, então a validação
   * mora na caixa visível — que é também onde o balão de erro precisa aparecer.
   * Cobre os dois jeitos de chegar sem escolha: não mexer no campo, e digitar
   * um texto que não é opção nenhuma.
   */
  useEffect(() => {
    campoRef.current?.setCustomValidity(
      required && !idSelecionado ? "Escolha uma opção da lista." : "",
    );
  }, [required, idSelecionado]);

  /*
   * A medida envelhece: rolar a página ou mudar o tamanho da janela com a lista
   * aberta muda o lado que cabe. Assinar os dois eventos é mais barato que
   * fechar a lista a cada rolagem, que é o que o teclado faria a pessoa perder.
   */
  useEffect(() => {
    if (!aberto) return;

    const recalcular = () => {
      if (campoRef.current) setPosicao(medir(campoRef.current, lado));
    };

    // `true` na captura: quem rola pode ser um contêiner interno, não a janela.
    window.addEventListener("scroll", recalcular, true);
    window.addEventListener("resize", recalcular);
    return () => {
      window.removeEventListener("scroll", recalcular, true);
      window.removeEventListener("resize", recalcular);
    };
  }, [aberto, lado]);

  /** Rolar junto: navegar de seta não pode levar o destaque para fora da vista. */
  useEffect(() => {
    if (!aberto) return;
    listaRef.current?.children[destaque]?.scrollIntoView({ block: "nearest" });
  }, [aberto, destaque]);

  function abrir() {
    if (aberto) return;
    if (campoRef.current) setPosicao(medir(campoRef.current, lado));
    setAberto(true);
    setFiltro(null);
    setDestaque(Math.max(0, opcoes.findIndex((o) => o.id === idSelecionado)));
    // Selecionado por inteiro: a primeira tecla troca o rótulo pelo filtro.
    requestAnimationFrame(() => campoRef.current?.select());
  }

  /** Fechar joga o filtro fora, e a caixa volta a mostrar o escolhido sozinha. */
  function fechar() {
    setAberto(false);
    setFiltro(null);
  }

  function escolher(opcao: OpcaoBuscavel) {
    if (!controlado) setInterno(opcao.id);
    aoEscolher?.(opcao.id);
    fechar();
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      if (!aberto) return abrir();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      setDestaque((i) => Math.min(filtradas.length - 1, Math.max(0, i + passo)));
      return;
    }

    if (evento.key === "Enter" && aberto) {
      // Sem isto, o Enter que escolhe também enviaria o formulário.
      evento.preventDefault();
      const escolhida = filtradas[destaque];
      if (escolhida) escolher(escolhida);
      return;
    }

    if (evento.key === "Escape" && aberto) {
      evento.preventDefault();
      fechar();
    }
  }

  return (
    <div
      ref={raizRef}
      className={className}
      onBlur={(evento) => {
        // Sair do conjunto fecha; andar entre a caixa e a lista, não.
        if (!raizRef.current?.contains(evento.relatedTarget)) fechar();
      }}
    >
      <label htmlFor={idCampo}>
        <Rotulo>{rotulo}</Rotulo>
      </label>

      <input type="hidden" name={name} value={idSelecionado} />

      {/*
        A lista pendura na CAIXA, não no campo inteiro: com a dica por baixo,
        ancorar na raiz abriria o painel um parágrafo abaixo de onde se digita.
      */}
      <div className="relative">
        <input
          ref={campoRef}
          id={idCampo}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={aberto && filtradas[destaque] ? `${idLista}-${destaque}` : undefined}
          aria-invalid={erro ? true : undefined}
          placeholder={placeholder}
          value={filtro ?? rotuloSelecionado}
          onChange={(evento) => {
            setFiltro(evento.target.value);
            setDestaque(0);
            if (!aberto) setAberto(true);
          }}
          onMouseDown={abrir}
          onFocus={abrir}
          onKeyDown={aoTeclar}
          className={`${CLASSE_CONTROLE} pr-9 ${erro ? CLASSE_ERRO : ""}`}
        />
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden="true"
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none
            transition-transform duration-150 ${aberto ? "rotate-180" : ""}`}
        />

        {aberto && (
          <ul
            ref={listaRef}
            id={idLista}
            role="listbox"
            style={{ maxHeight: posicao.altura }}
            className={`folha absolute left-0 right-0 z-50 overflow-y-auto py-1 ${
              posicao.paraCima ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            {filtradas.length === 0 && (
              <li className="px-3.5 py-2 text-corpo text-tinta-3">{vazio}</li>
            )}

            {filtradas.map((opcao, i) => (
              <li
                key={opcao.id}
                id={`${idLista}-${i}`}
                role="option"
                aria-selected={opcao.id === idSelecionado}
                // O mousedown tiraria o foco da caixa e fecharia a lista antes do
                // clique acontecer — segurar o foco aqui é o que faz o clique valer.
                onMouseDown={(evento) => evento.preventDefault()}
                onMouseEnter={() => setDestaque(i)}
                onClick={() => escolher(opcao)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2
                  text-corpo transition-colors ${
                    i === destaque ? "bg-folha-2 text-tinta" : "text-tinta-2"
                  }`}
              >
                <span className={opcao.id === idSelecionado ? "font-semibold" : ""}>
                  {opcao.rotulo}
                </span>
                {opcao.detalhe && (
                  <span className="shrink-0 text-mini text-tinta-3">{opcao.detalhe}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <RodapeCampo erro={erro} dica={dica} />
    </div>
  );
}
