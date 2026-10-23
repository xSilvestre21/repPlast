"use client";

/**
 * O índice das seções de Configurações e a busca entre os cartões.
 *
 * A página ficou comprida (perfil, escritório, e-mail, orçamento,
 * preferências), e rolar procurando "onde fica a assinatura" era o problema.
 * O índice leva direto à seção; a busca esconde o que não tem a palavra.
 *
 * A busca é feita no próprio DOM, e não numa lista de dados: os cartões são do
 * servidor (`page.tsx`) e chegam aqui como `children`. Cada `ItemConfiguracao`
 * é procurado pelo texto que mostra mais as palavras extras do `data-busca`,
 * sem acento nem maiúscula (`achatar`) — ninguém procura "orçamento" com
 * cedilha. Sem resultado numa seção, a seção some inteira, título junto.
 *
 * Cada termo tem de ser o COMEÇO de uma palavra, e não um pedaço qualquer:
 * "tema" achava "sistema", e "nome" achava "sobrenome" no cartão errado. O
 * hífen não conta — "email" acha "e-mail".
 */

import {
  FileText,
  type LucideIcon,
  Mail,
  Search,
  SlidersHorizontal,
  Store,
  UserRound,
} from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { achatar } from "@/components/selecao-buscavel";
import { CLASSE_CONTROLE, EstadoVazio } from "@/components/ui";

/** O ícone de cada seção, pelo nome — componente de ícone não atravessa do servidor. */
const ICONES = {
  perfil: UserRound,
  escritorio: Store,
  email: Mail,
  orcamento: FileText,
  preferencias: SlidersHorizontal,
} satisfies Record<string, LucideIcon>;

export type IconeSecao = keyof typeof ICONES;

export type SecaoDoIndice = { id: string; titulo: string; icone: IconeSecao };

/** Sem acento, sem maiúscula e sem hífen: "E-mail" e "email" são a mesma palavra. */
function normalizar(texto: string): string {
  return achatar(texto).replace(/-/g, "");
}

/** As palavras do texto, já normalizadas. */
function palavras(texto: string): string[] {
  return normalizar(texto).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Todo termo começa alguma palavra do texto. */
export function bateComBusca(texto: string, busca: string): boolean {
  const termos = palavras(busca);
  if (termos.length === 0) return true;
  const doTexto = palavras(texto);
  return termos.every((termo) => doTexto.some((palavra) => palavra.startsWith(termo)));
}

/** Quanto abaixo do topo da janela a seção "começa" — a barra fixa tem 56 px. */
const LINHA_DO_TOPO = 96;

export function SecoesConfiguracao({
  secoes,
  children,
}: {
  secoes: SecaoDoIndice[];
  children: ReactNode;
}) {
  const conteudo = useRef<HTMLDivElement>(null);
  const faixa = useRef<HTMLElement>(null);
  const [busca, setBusca] = useState("");
  /** As seções com algum cartão à vista; `null` sem busca (todas). */
  const [comResultado, setComResultado] = useState<Set<string> | null>(null);
  const [ativa, setAtiva] = useState(secoes[0]?.id ?? "");
  /** A seção a rolar depois que a busca for limpa (clique no índice durante a busca). */
  const alvo = useRef<string | null>(null);

  // Filtra. Roda também quando os cartões mudam (salvar revalida a página).
  useEffect(() => {
    const raiz = conteudo.current;
    if (!raiz) return;

    const semBusca = palavras(busca).length === 0;
    const achadas = new Set<string>();

    for (const secao of raiz.querySelectorAll<HTMLElement>("[data-secao]")) {
      let algum = false;
      for (const item of secao.querySelectorAll<HTMLElement>("[data-busca]")) {
        const bate = bateComBusca(`${item.dataset.busca ?? ""} ${item.textContent ?? ""}`, busca);
        item.hidden = !bate;
        algum ||= bate;
      }
      secao.hidden = !algum;
      if (algum) achadas.add(secao.dataset.secao ?? "");
    }

    setComResultado(semBusca ? null : achadas);

    // Clique no índice com a busca escondendo a seção: limpou, agora rola.
    if (alvo.current && semBusca) {
      irPara(alvo.current);
      alvo.current = null;
    }
  }, [busca, children]);

  // A seção em que a leitura está: a última cujo começo já passou da linha do topo.
  useEffect(() => {
    let quadro = 0;
    function medir() {
      quadro = 0;
      const raiz = conteudo.current;
      if (!raiz) return;
      const visiveis = [...raiz.querySelectorAll<HTMLElement>("[data-secao]:not([hidden])")];
      let atual = "";
      for (const secao of visiveis) {
        if (!atual || secao.getBoundingClientRect().top <= LINHA_DO_TOPO) atual = secao.id;
      }
      // No fim da página, a última seção é a atual mesmo sem chegar à linha do
      // topo — curta como Preferências, ela nunca chegaria, e o índice ficaria
      // marcando a anterior com a pessoa lendo esta.
      const noFim = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (noFim && visiveis.length > 0) atual = visiveis[visiveis.length - 1].id;
      if (atual) setAtiva(atual);
    }
    function aoRolar() {
      if (!quadro) quadro = requestAnimationFrame(medir);
    }
    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [comResultado]);

  // No celular o índice é uma faixa que rola de lado: a seção atual não pode
  // ficar fora dela. Na coluna da tela larga não há o que rolar.
  useEffect(() => {
    const nav = faixa.current;
    const item = nav?.querySelector<HTMLElement>(`a[href="#${ativa}"]`);
    if (!nav || !item || nav.scrollWidth <= nav.clientWidth) return;
    const fora = item.offsetLeft < nav.scrollLeft || item.offsetLeft + item.offsetWidth > nav.scrollLeft + nav.clientWidth;
    if (fora) nav.scrollTo({ left: item.offsetLeft - 16, behavior: suave() ? "smooth" : "auto" });
  }, [ativa]);

  function aoClicar(evento: MouseEvent<HTMLAnchorElement>, id: string) {
    evento.preventDefault();
    if (comResultado && !comResultado.has(id)) {
      alvo.current = id;
      setBusca("");
      return;
    }
    irPara(id);
  }

  const nada = comResultado !== null && comResultado.size === 0;

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <aside className="mb-5 lg:mb-0">
        <div className="lg:sticky lg:top-20 space-y-3">
          <label className="block">
            <span className="sr-only">Buscar nas configurações</span>
            <div className="relative">
              <Search
                size={15}
                strokeWidth={2}
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
              />
              <input
                type="search"
                autoComplete="off"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar configuração"
                className={`${CLASSE_CONTROLE} pl-10`}
              />
            </div>
          </label>

          {/* No celular, uma faixa que rola de lado; na tela larga, a coluna. */}
          <nav ref={faixa} aria-label="Seções das configurações" className="rolagem-limpa relative -mx-4 px-4 overflow-x-auto lg:mx-0 lg:px-0">
            <ul className="flex gap-1.5 lg:flex-col lg:gap-0.5">
              {secoes.map((secao) => {
                const Icone = ICONES[secao.icone];
                const vazia = comResultado !== null && !comResultado.has(secao.id);
                const atual = !vazia && ativa === secao.id;
                return (
                  <li key={secao.id} className="shrink-0">
                    <a
                      href={`#${secao.id}`}
                      onClick={(evento) => aoClicar(evento, secao.id)}
                      aria-current={atual ? "location" : undefined}
                      className={`flex items-center gap-2 whitespace-nowrap rounded-suave px-3 py-2 text-corpo
                        transition-colors ${
                          atual
                            ? "bg-folha-2 text-tinta font-semibold"
                            : vazia
                              ? "text-tinta-3/60 hover:text-tinta-2"
                              : "text-tinta-2 hover:bg-folha-2 hover:text-tinta"
                        }`}
                    >
                      <Icone size={15} strokeWidth={2} aria-hidden="true" />
                      {secao.titulo}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </aside>

      <div ref={conteudo} className="min-w-0 space-y-10 palco">
        {nada && (
          <EstadoVazio icone={Search} titulo="Nada encontrado">
            Nenhuma configuração fala de “{busca.trim()}”. Tente outra palavra, como senha, plano ou
            assinatura.
          </EstadoVazio>
        )}
        {children}
      </div>
    </div>
  );
}

function irPara(id: string) {
  const secao = document.getElementById(id);
  if (!secao) return;
  secao.scrollIntoView({ behavior: suave() ? "smooth" : "auto", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

/** Quem desligou as animações na conta rola sem deslizar. */
function suave(): boolean {
  return document.documentElement.dataset.animacoes !== "desativadas";
}
