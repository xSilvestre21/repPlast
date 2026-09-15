"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { ViewTransition } from "react";

import { sair } from "@/app/(entrada)/acoes";

import { AlternadorTema } from "./alternador-tema";
import { Avatar } from "./ui";

/**
 * Quem está logado, e a saída.
 *
 * O nome vem do layout, que já leu a sessão — evita uma segunda consulta e
 * mantém este componente sem acesso a dados.
 */
function MenuUsuario({ nome }: { nome: string }) {
  return (
    <div className="flex items-center gap-1">
      {/* O `title` vai no invólucro: o `Avatar` é `aria-hidden`, e sem ele o
          disco de iniciais não diria a quem pertence. */}
      <span title={nome} className="flex">
        <Avatar nome={nome} pequeno />
      </span>

      <form action={sair}>
        <button
          type="submit"
          title="Sair"
          className="grid place-items-center size-8 rounded-full text-tinta-3 cursor-pointer
            transition-colors hover:bg-folha-2 hover:text-carimbo"
        >
          <LogOut size={15} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Sair</span>
        </button>
      </form>
    </div>
  );
}

/**
 * A ORDEM importa.
 *
 * É ela que define a direção do deslize ao trocar de aba: ir para um item mais
 * à direita empurra o conteúdo para a esquerda, como virar a página de um
 * fichário. Reordenar esta lista muda o significado da animação.
 */
const ITENS = [
  { href: "/", rotulo: "Painel" },
  { href: "/orcamentos", rotulo: "Orçamentos" },
  { href: "/pedidos", rotulo: "Pedidos" },
  { href: "/comissoes", rotulo: "Comissões" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/produtos", rotulo: "Produtos" },
  { href: "/fornecedores", rotulo: "Fornecedores" },
];

/**
 * Entra no fim da fila, e só para o administrador de um escritório Plus.
 *
 * No fim porque a ordem é a direção do deslize: a aba de administrar a equipe é
 * a última coisa que se abre num dia de trabalho, e é de lá que o olho espera
 * voltar para a esquerda.
 */
const ITEM_PREPOSTOS = { href: "/prepostos", rotulo: "Prepostos" };

function estaAtivo(href: string, caminho: string) {
  // A raiz precisa de comparação exata: `startsWith("/")` casaria com todas as
  // rotas e deixaria o Painel sempre aceso.
  if (href === "/") return caminho === "/";
  return caminho === href || caminho.startsWith(`${href}/`);
}

export function Navegacao({
  nomeUsuario,
  mostrarPrepostos = false,
}: {
  nomeUsuario: string;
  mostrarPrepostos?: boolean;
}) {
  const caminho = usePathname();
  const itens = mostrarPrepostos ? [...ITENS, ITEM_PREPOSTOS] : ITENS;
  const indiceAtual = itens.findIndex((item) => estaAtivo(item.href, caminho));

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
            className="order-1 shrink-0 text-medio font-extrabold tracking-[-0.03em]
              transition-colors hover:text-carimbo"
          >
            RepPlast
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

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ativo ? "page" : undefined}
                      // A direção sai da posição na barra, não do histórico.
                      transitionTypes={[
                        indice > indiceAtual ? "nav-direita" : "nav-esquerda",
                      ]}
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
            <MenuUsuario nome={nomeUsuario} />
            <AlternadorTema />
          </div>
        </div>
      </div>
    </header>
  );
}
