"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Factory,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { sair } from "@/app/(entrada)/acoes";

import { AlternadorTema } from "./alternador-tema";
import { NomeQueCabe } from "./nome-que-cabe";
import { chegarPilula, partir } from "./viagem";
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

type Grupo = "dia" | "inicio" | "cadastros";

/**
 * A ORDEM importa — e é a mesma da barra, da esquerda para a direita.
 *
 * O Painel fica no MEIO: à esquerda o dia a dia (calendário, propostas,
 * pedidos), à direita os cadastros. Uma barra só, com os dois grupos separados
 * por divisórias e o Painel entre elas como âncora — dentro da barra, e não
 * flutuando fora dela. As diretrizes de navegação do Material 3 e da Apple
 * concordam: destino de navegação é sempre o mesmo tipo de item (ícone e
 * rótulo) num contêiner único; o botão central saltado é padrão de AÇÃO
 * ("criar"), e num destino ele lê como peça solta.
 *
 * A ordem define a direção do deslize ao trocar de aba: ir para um item mais à
 * direita empurra o conteúdo para a esquerda, como virar a página de um
 * fichário. Como a lista espelha a barra, sair do Painel para Pedidos desliza
 * para um lado e para Clientes, para o outro — sem regra especial para o meio.
 *
 * Os ícones são os mesmos do cabeçalho de cada página: a aba e a tela que ela
 * abre falam a mesma língua.
 *
 * Só os itens que ficam na BARRA principal entram aqui — Comissões, Gráficos
 * e Prepostos moram no menu do avatar (`ITENS_MENU`/`ITEM_PREPOSTOS`) e não
 * participam desse deslize.
 */
const ITENS_PRINCIPAIS: { href: string; rotulo: string; grupo: Grupo; icone: LucideIcon }[] = [
  { href: "/calendario", rotulo: "Calendário", grupo: "dia", icone: CalendarDays },
  { href: "/orcamentos", rotulo: "Orçamentos", grupo: "dia", icone: FileText },
  { href: "/pedidos", rotulo: "Pedidos", grupo: "dia", icone: ScrollText },
  { href: "/", rotulo: "Painel", grupo: "inicio", icone: LayoutDashboard },
  { href: "/clientes", rotulo: "Clientes", grupo: "cadastros", icone: Users },
  { href: "/produtos", rotulo: "Produtos", grupo: "cadastros", icone: Package },
  { href: "/fornecedores", rotulo: "Fornecedores", grupo: "cadastros", icone: Factory },
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
 * Uma aba da barra: ícone e rótulo, como todas — o Painel inclusive.
 *
 * O Painel se distingue sem sair da família: fica no centro, entre as
 * divisórias, com rótulo em negrito e ícone um pouco maior, mesmo quando não
 * está selecionado — na cor da barra, sem fundo próprio (um fundo só dele lia
 * como uma segunda cápsula dentro da primeira). Selecionado, recebe a mesma
 * pílula preta das outras.
 *
 * Entre `md` e `xl` a barra não tem largura para sete rótulos: as abas dos
 * lados mostram só o ícone (o nome fica no `title` e no `aria-label`), e o
 * Painel, que é a âncora, mantém o dele. Abaixo de `md` a barra some e entra o
 * menu de três riscas (`MenuCelular`).
 *
 * `md`, e não `sm`: com as abas no centro exato do topo, o nome do escritório
 * fica com metade do que sobra ao lado delas, e de 640 a 767 px isso dava só
 * 112 px — o cadastro teria de recusar nomes comuns. Nessa faixa (celular
 * deitado, tablet pequeno) a gaveta serve tão bem quanto.
 *
 * `xl`, e não `lg`: com rótulo, as abas ocupam ~820 px, e o topo nunca passa
 * de 1104 (`max-w-6xl` menos o recuo). Em 1024 px elas invadiam o avatar e a
 * página ganhava rolagem lateral.
 */
function Aba({
  item,
  indice,
  indiceAtual,
}: {
  item: (typeof ITENS_PRINCIPAIS)[number];
  indice: number;
  indiceAtual: number;
}) {
  const ativo = indice === indiceAtual;
  const inicio = item.grupo === "inicio";
  const Icone = item.icone;

  /*
   * A página chega PRONTA quando a pessoa mostra que vai clicar.
   *
   * Por padrão o Next pré-carrega só o esqueleto (`loading.tsx`) de uma página
   * dinâmica: a troca deslizava para um bloco cinza, esperava o servidor e só
   * então o conteúdo aparecia — dois estalos em toda troca, e era isso que a
   * deixava pesada. Com o mouse em cima (ou o foco, ou o dedo), o link passa a
   * pré-carregar a página inteira; nos ~300 ms até o clique ela já está no
   * cliente, e o deslize leva o conteúdo de verdade, como no iOS.
   *
   * Só na intenção, e não para as sete abas assim que a tela abre: seriam sete
   * páginas montadas no servidor a cada visita, quase todas à toa. O que veio
   * vale por 30 s (`staleTimes.static`, em next.config.ts) — mais que isso e um
   * pedido lançado por um preposto demoraria a aparecer.
   */
  const [intencao, setIntencao] = useState(false);
  const mostrouIntencao = () => setIntencao(true);

  return (
    <li>
      <Link
        href={item.href}
        prefetch={intencao && !ativo ? true : null}
        onMouseEnter={mostrouIntencao}
        onFocus={mostrouIntencao}
        onTouchStart={mostrouIntencao}
        aria-current={ativo ? "page" : undefined}
        aria-label={item.rotulo}
        title={item.rotulo}
        onClick={() => partir(indice, indiceAtual)}
        // Sem `isolate`: a pílula (`-z-10`) desce para a camada da lista
        // inteira (ver o `ul`) e passa POR BAIXO dos rótulos de todas as abas
        // do caminho — nenhum some enquanto ela atravessa.
        className={`relative flex items-center gap-1.5 rounded-full py-1.5 text-corpo
          whitespace-nowrap transition-colors duration-200 ${
            inicio ? "px-3.5" : "px-2.5 xl:px-3"
          } ${
            ativo
              ? "text-papel font-semibold"
              : inicio
                ? "text-tinta font-semibold hover:bg-folha-2"
                : "text-tinta-2 font-medium hover:bg-folha-2 hover:text-tinta"
          }`}
      >
        {/*
          A pílula preta existe UMA vez na árvore, sempre dentro do item ativo.
          Ao trocar de aba ela desmonta aqui e monta ali — e, ao montar, sai de
          onde a antiga estava e desliza até aqui (`chegarPilula`).
        */}
        {ativo && <Pilula />}
        <Icone size={inicio ? 16 : 15} strokeWidth={ativo || inicio ? 2.25 : 1.75} aria-hidden="true" />
        <span className={inicio ? "" : "hidden xl:inline"}>{item.rotulo}</span>
      </Link>
    </li>
  );
}

/** A pílula preta da aba ativa, que chega deslizando de onde estava. */
function Pilula() {
  const pilula = useRef<HTMLSpanElement>(null);
  // De layout, antes da pintura: o primeiro quadro já a mostra no ponto de
  // partida, e não um piscar dela no destino.
  useLayoutEffect(() => {
    if (pilula.current) chegarPilula(pilula.current);
  }, []);
  return <span ref={pilula} aria-hidden="true" className="marca-nav -z-10" />;
}

/** A divisória fina entre os grupos — dentro da barra, sem quebrá-la. */
function Divisoria() {
  return <li aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-filete-forte" />;
}

/**
 * O menu do celular: três riscas que abrem uma gaveta pela esquerda.
 *
 * Na gaveta cabe o que a barra não cabe: os nomes por extenso, os dois grupos
 * com título ("Dia a dia", "Cadastros") e o Painel em cima, como ponto de
 * partida. Os itens do menu do avatar (Comissões, Gráficos…) entram no fim,
 * para o celular não depender de dois menus.
 *
 * É um `<dialog>` com `showModal()`, como o `Dialogo`: o navegador prende o
 * foco dentro, fecha no Esc e deixa o resto da página inerte. Fecha também ao
 * escolher um destino — a gaveta vive no layout e não desmonta ao navegar.
 */
function MenuCelular({
  itens,
  itensMenu,
  indiceAtual,
  nomeOrganizacao,
}: {
  itens: typeof ITENS_PRINCIPAIS;
  itensMenu: { href: string; rotulo: string }[];
  indiceAtual: number;
  nomeOrganizacao: string;
}) {
  const [aberto, setAberto] = useState(false);
  const gaveta = useRef<HTMLDialogElement>(null);
  const caminho = usePathname();

  useEffect(() => {
    const elemento = gaveta.current;
    if (!elemento) return;
    if (aberto && !elemento.open) elemento.showModal();
    if (!aberto && elemento.open) elemento.close();
  }, [aberto]);

  const grupos: { titulo: string | null; itens: typeof ITENS_PRINCIPAIS }[] = [
    { titulo: null, itens: itens.filter((i) => i.grupo === "inicio") },
    { titulo: "Dia a dia", itens: itens.filter((i) => i.grupo === "dia") },
    { titulo: "Cadastros", itens: itens.filter((i) => i.grupo === "cadastros") },
  ];

  const ITEM =
    "flex items-center gap-3 rounded-suave px-3 py-2.5 baixa:py-1.5 text-corpo transition-colors";

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir o menu"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        className="-ml-1.5 grid size-10 place-items-center rounded-full text-tinta-2 transition-colors
          hover:bg-folha-2 hover:text-tinta cursor-pointer"
      >
        <Menu size={20} strokeWidth={2} aria-hidden="true" />
      </button>

      <dialog
        ref={gaveta}
        onClose={() => setAberto(false)}
        // Clique no fundo escurecido fecha; a gaveta ocupa o resto do <dialog>.
        onClick={(evento) => {
          if (evento.target === gaveta.current) setAberto(false);
        }}
        aria-label="Menu"
        className="gaveta m-0 h-dvh max-h-none w-[min(20rem,85vw)] bg-folha text-tinta p-0
          shadow-[var(--sombra-alta)] backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
      >
        {aberto && (
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center justify-between gap-3 border-b border-filete px-4">
              <span className="min-w-0 font-extrabold tracking-[-0.03em]" title={nomeOrganizacao}>
                <NomeQueCabe nome={nomeOrganizacao} />
              </span>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar o menu"
                className="grid size-9 shrink-0 place-items-center rounded-full text-tinta-3
                  hover:bg-folha-2 hover:text-tinta cursor-pointer"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-3">
              {grupos.map(({ titulo, itens: doGrupo }) => (
                <div key={titulo ?? "inicio"} className={titulo ? "mt-4 baixa:mt-2" : ""}>
                  {titulo && <p className="rotulo px-3 mb-1 text-tinta-3">{titulo}</p>}
                  <ul className="space-y-0.5">
                    {doGrupo.map((item) => {
                      const ativo = itens.indexOf(item) === indiceAtual;
                      const Icone = item.icone;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={ativo ? "page" : undefined}
                            onClick={() => setAberto(false)}
                            className={`${ITEM} ${
                              ativo
                                ? "bg-tinta text-papel font-semibold"
                                : item.grupo === "inicio"
                                  ? "text-tinta font-semibold hover:bg-folha-2"
                                  : "text-tinta-2 hover:bg-folha-2 hover:text-tinta"
                            }`}
                          >
                            <Icone size={18} strokeWidth={ativo ? 2.25 : 1.75} aria-hidden="true" />
                            {item.rotulo}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div className="mt-4 baixa:mt-2 border-t border-filete pt-4 baixa:pt-2">
                <p className="rotulo px-3 mb-1 text-tinta-3">Mais</p>
                <ul className="space-y-0.5">
                  {itensMenu.map((item) => {
                    const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={ativo ? "page" : undefined}
                          onClick={() => setAberto(false)}
                          className={`${ITEM} ${
                            ativo
                              ? "bg-tinta text-papel font-semibold"
                              : "text-tinta-2 hover:bg-folha-2 hover:text-tinta"
                          }`}
                        >
                          {item.rotulo}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </nav>
          </div>
        )}
      </dialog>
    </div>
  );
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
  const indicePainel = itens.findIndex((item) => item.grupo === "inicio");
  const itensMenu = mostrarPrepostos ? [...ITENS_MENU, ITEM_PREPOSTOS] : ITENS_MENU;

  return (
    <header className="sticky top-0 z-40 barra-topo">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
        {/*
          Do `md` para cima, uma grade de três colunas: nome | abas | avatar,
          com as duas laterais do MESMO tamanho (`1fr` cada). É isso que deixa as
          abas no centro exato do topo, qualquer que seja o nome. Com `flex`, as
          abas ficavam no meio do que SOBRAVA entre o nome e o avatar — e um nome
          comprido as empurrava para a direita.
        */}
        <div
          className="flex h-14 items-center gap-x-3 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]
            md:gap-x-4"
        >
          {/* No celular a barra de abas não cabe: as três riscas abrem a gaveta. */}
          <MenuCelular
            itens={itens}
            itensMenu={itensMenu}
            indiceAtual={indiceAtual}
            nomeOrganizacao={nomeOrganizacao}
          />

          {/*
            O nome do escritório leva ao Painel — e faz a MESMA viagem que a aba
            dele: a mesma direção de deslize e a pílula indo até o Painel.

            Ele é quem cede espaço: fica com a coluna da esquerda — metade do
            que sobra ao lado das abas, que nunca encolhem (`auto` na grade) —,
            até 220 px. Ao contrário, um nome comprido empurrava as abas para
            cima do avatar. O que não
            couber não vira "…": a fonte encolhe e, se preciso, quebra em duas
            linhas (`NomeQueCabe`) — e o limite do cadastro
            (`escritorio-regras.ts`) é o que ainda cabe assim no pior caso.
          */}
          <Link
            href="/"
            onClick={() => partir(indicePainel, indiceAtual)}
            title={nomeOrganizacao}
            className="min-w-0 max-w-[50vw] justify-self-start font-extrabold tracking-[-0.03em]
              transition-colors hover:text-carimbo md:max-w-[min(220px,100%)]"
          >
            <NomeQueCabe nome={nomeOrganizacao} />
          </Link>

          {/*
            A barra de abas, do `md` para cima. Abaixo disso ela some, e não
            vira uma fila rolando de lado: com o Painel no meio, metade das abas
            ficava fora da tela, e quem estava em Fornecedores não via onde
            estava. A pílula com nome de view transition só existe aqui — a
            gaveta do celular não a repete, porque nome repetido faz o navegador
            abortar a animação.
          */}
          <nav aria-label="Principal" className="hidden md:block">
            {/*
              Sem fundo nem borda próprios: as abas ficam direto no fundo do
              topo. Uma cápsula cinza em volta delas pesava o cabeçalho — quem
              separa os grupos são as divisórias, e quem marca a aba atual é a
              pílula.
            */}
            <ul aria-label="Seções" className="relative isolate mx-auto flex w-max items-center gap-0.5">
              {itens.map((item, indice) => (
                <Fragment key={item.href}>
                  {/* A divisória antes do Painel e depois dele: os grupos se
                      separam DENTRO da barra, e o Painel fica entre eles. */}
                  {item.grupo === "inicio" && <Divisoria />}
                  <Aba item={item} indice={indice} indiceAtual={indiceAtual} />
                  {item.grupo === "inicio" && <Divisoria />}
                </Fragment>
              ))}
            </ul>
          </nav>

          <div className="ml-auto md:ml-0 md:justify-self-end flex items-center gap-1 shrink-0">
            <MenuUsuario nome={nomeUsuario} itensMenu={itensMenu} />
            <AlternadorTema />
          </div>
        </div>
      </div>
    </header>
  );
}
