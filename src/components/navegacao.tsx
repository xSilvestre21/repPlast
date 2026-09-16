"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { ViewTransition, useEffect, useId, useRef, useState } from "react";

import { sair } from "@/app/(entrada)/acoes";

import { AlternadorTema } from "./alternador-tema";
import { Avatar } from "./ui";

/**
 * Avatar, seta e o menu que ele abre.
 *
 * O painel é ancorado no botão (`absolute`, `right-0`), não uma janela
 * central: é um atalho de navegação, não uma decisão que peça atenção da
 * tela inteira. Fecha ao clicar fora, com Escape, ou ao escolher um item —
 * o componente vive no layout e nunca desmonta entre páginas, então nada
 * além do próprio código fecharia o menu ao navegar.
 */
function MenuUsuario({
  nome,
  itensMenu,
}: {
  nome: string;
  itensMenu: { href: string; rotulo: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const painelId = useId();
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raizRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={painelId}
        title={nome}
        className="flex items-center gap-0.5 rounded-full py-0.5 pl-0.5 pr-1 text-tinta-3
          transition-colors cursor-pointer hover:bg-folha-2 hover:text-carimbo"
      >
        <Avatar nome={nome} pequeno />
        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden="true"
          className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div
          id={painelId}
          role="menu"
          className="folha absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden py-1"
        >
          {itensMenu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setAberto(false)}
              className="block px-3.5 py-2 text-corpo text-tinta-2 transition-colors
                hover:bg-folha-2 hover:text-tinta"
            >
              {item.rotulo}
            </Link>
          ))}

          <div role="separator" className="my-1 border-t border-filete" />

          <form action={sair}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-corpo
                text-tinta-2 transition-colors cursor-pointer hover:bg-folha-2 hover:text-carimbo"
            >
              <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * A ORDEM importa.
 *
 * É ela que define a direção do deslize ao trocar de aba: ir para um item mais
 * à direita empurra o conteúdo para a esquerda, como virar a página de um
 * fichário. Reordenar esta lista muda o significado da animação.
 *
 * Só os itens que ficam na BARRA principal entram aqui — Comissões, Gráficos
 * e Prepostos moraram no menu do avatar (`ITENS_MENU`/`ITEM_PREPOSTOS`) e não
 * participam desse deslize.
 */
const ITENS_PRINCIPAIS = [
  { href: "/", rotulo: "Painel" },
  { href: "/orcamentos", rotulo: "Orçamentos" },
  { href: "/pedidos", rotulo: "Pedidos" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/produtos", rotulo: "Produtos" },
  { href: "/fornecedores", rotulo: "Fornecedores" },
];

/** Itens escondidos atrás do menu do avatar — não afetam o deslize das abas. */
const ITENS_MENU = [
  { href: "/comissoes", rotulo: "Comissões" },
  { href: "/graficos", rotulo: "Gráficos" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

/**
 * Entra no fim do menu, e só para o administrador de um escritório Plus.
 *
 * No fim porque, como nas abas principais, a ordem aqui é a do dia de
 * trabalho: administrar a equipe é a última coisa que se abre.
 */
const ITEM_PREPOSTOS = { href: "/prepostos", rotulo: "Prepostos" };

function estaAtivo(href: string, caminho: string) {
  // A raiz precisa de comparação exata: `startsWith("/")` casaria com todas as
  // rotas e deixaria o Painel sempre aceso.
  if (href === "/") return caminho === "/";
  return caminho === href || caminho.startsWith(`${href}/`);
}

/**
 * Quanto mais longe a aba de destino, mais tempo a pílula leva pra chegar lá.
 *
 * Sem isso, ir para a aba vizinha e ir para a do outro extremo da barra
 * animariam na mesma velocidade — e a pílula pareceria pular em vez de
 * varrer as abas do meio.
 */
function alcanceDe(distancia: number): "perto" | "media" | "longe" {
  if (distancia <= 1) return "perto";
  if (distancia <= 3) return "media";
  return "longe";
}

export function Navegacao({
  nomeUsuario,
  nomeOrganizacao,
  mostrarPrepostos = false,
}: {
  nomeUsuario: string;
  nomeOrganizacao: string;
  mostrarPrepostos?: boolean;
}) {
  const caminho = usePathname();
  const itens = ITENS_PRINCIPAIS;
  const indiceAtual = itens.findIndex((item) => estaAtivo(item.href, caminho));
  const itensMenu = mostrarPrepostos ? [...ITENS_MENU, ITEM_PREPOSTOS] : ITENS_MENU;

  return (
    // `view-transition-name` prende a barra: durante o deslize ela é o ponto
    // fixo que diz ao olho que quem se moveu foi o conteúdo, não a tela.
    <header
      className="sticky top-0 z-40 barra-topo"
      style={{ viewTransitionName: "barra-topo" }}
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
        {/*
          Uma linha no desktop, duas no celular — e a fila de abas é a mesma
          nos dois casos, movida por `order`. Renderizar duas listas (uma por
          tamanho de tela) duplicaria o nome de view transition do marcador, e
          nome repetido faz o navegador abortar a animação inteira.
        */}
        <div className="flex flex-wrap items-center gap-x-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
          <Link
            href="/"
            className="order-1 min-w-0 max-w-[45vw] truncate text-medio font-extrabold
              tracking-[-0.03em] transition-colors hover:text-carimbo sm:max-w-[220px]"
          >
            {nomeOrganizacao}
          </Link>

          {/*
            No celular a fila de abas ocupa a segunda linha inteira e rola
            sozinha. Manter os rótulos por extenso em vez de virar ícones é
            deliberado: são seis seções de nomes curtos, e o nome é mais
            rápido de reconhecer que o desenho.
          */}
          <nav className="order-3 w-full overflow-x-auto rolagem-limpa pt-1 pb-0.5
            sm:order-2 sm:w-auto sm:flex-1 sm:min-w-0 sm:pt-0 sm:pb-0">
            <ul className="flex items-center justify-start sm:justify-center gap-0.5">
              {itens.map((item, indice) => {
                const ativo = indice === indiceAtual;
                const direcao = indice > indiceAtual ? "nav-direita" : "nav-esquerda";
                const alcance = alcanceDe(Math.abs(indice - indiceAtual));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ativo ? "page" : undefined}
                      // A direção sai da posição na barra, não do histórico;
                      // o alcance sai da distância entre abas. O primeiro tipo
                      // move o conteúdo (`Pagina`), o segundo só ajusta a
                      // duração da pílula (ver `:active-view-transition-type`
                      // em globals.css) — nenhum dos dois lê o outro.
                      transitionTypes={[`${direcao}-${alcance}`, `nav-${alcance}`]}
                      // O tamanho do destino, medido na hora do clique: trava
                      // `width`/`height` da pílula em `globals.css` no valor
                      // final, para ela só andar de lado, nunca redimensionar
                      // em voo — encolher/crescer ENQUANTO desliza é o que
                      // fazia a viagem parecer arquear (ver comentário lá).
                      onClick={(evento) => {
                        const raiz = document.documentElement.style;
                        const retangulo = evento.currentTarget.getBoundingClientRect();
                        raiz.setProperty("--largura-pilula", `${retangulo.width}px`);
                        raiz.setProperty("--altura-pilula", `${retangulo.height}px`);
                      }}
                      className={`relative isolate block px-3.5 py-1.5 rounded-full text-corpo font-medium
                        whitespace-nowrap transition-colors duration-200 ${
                          ativo
                            ? "text-papel font-semibold"
                            : "text-tinta-2 hover:bg-folha-2 hover:text-tinta"
                        }`}
                    >
                      {/*
                        A pílula preta existe UMA vez na árvore, sempre dentro
                        do item ativo. Ao trocar de aba ele desmonta aqui e
                        monta ali — e como carrega um nome de view transition,
                        o navegador anima a viagem em vez de apagar e acender.
                      */}
                      {ativo && (
                        <ViewTransition name="marca-nav">
                          <span aria-hidden="true" className="marca-nav -z-10" />
                        </ViewTransition>
                      )}
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="order-2 ml-auto flex items-center gap-1 shrink-0 sm:order-3 sm:ml-0">
            <MenuUsuario nome={nomeUsuario} itensMenu={itensMenu} />
            <AlternadorTema />
          </div>
        </div>
      </div>
    </header>
  );
}
