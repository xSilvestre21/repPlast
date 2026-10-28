import type { Metadata, Viewport } from "next";

import { SCRIPT_TEMA } from "@/components/alternador-tema";
import { sessaoAtual } from "@/lib/sessao";

import { classesDasFontes } from "./fontes";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepPlast",
  description: "Pedidos e comissões para representantes de embalagens plásticas",
  /*
   * Instalado na tela inicial do iPhone, abre em tela cheia com o nome
   * "RepPlast" embaixo do ícone (`apple-icon.png`). O Android lê o mesmo do
   * manifesto (`manifest.ts`).
   */
  appleWebApp: {
    capable: true,
    title: "RepPlast",
    statusBarStyle: "default",
  },
};

/**
 * A cor da barra do navegador e da barra de status do app instalado: o
 * `--papel` de cada tema (`globals.css`), para a barra emendar no fundo da
 * página em vez de aparecer como uma faixa de outra cor.
 *
 * Segue o tema do aparelho. Quem escolheu o tema no sistema diferente do
 * aparelho vê a barra na cor do aparelho — o navegador lê esta tag antes de
 * qualquer script rodar.
 */
export const viewport: Viewport = {
  // No Android, o teclado encolhe a página em vez de cobri-la: a folha que
  // sobe de baixo e o campo focado ficam acima dele. O iPhone ignora isto —
  // lá quem faz a conta é a própria folha (`folha-de-baixo.tsx`).
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
};

/**
 * Nada aqui pode ser prerenderizado.
 *
 * Toda página é específica de um escritório, e o conteúdo depende do tenant da
 * requisição. Sem isto o Next executa as consultas durante o build e congela o
 * resultado — a lista de fornecedores nasceria desatualizada e, pior, os dados
 * de um escritório ficariam embutidos no bundle servido a todos.
 */
export const dynamic = "force-dynamic";

/**
 * Layout raiz: só o essencial que vale para TODA página, logada ou não.
 *
 * A navegação e o guarda de sessão vivem em `(app)/layout.tsx`, porque as
 * telas de login e cadastro não têm nem uma nem outro. `sessaoAtual()` é
 * chamada aqui só para ler a preferência de animação — é `cache()` do React,
 * então não duplica a consulta ao banco dentro da mesma requisição; quem
 * exige sessão de verdade (redirecionar sem uma) continua sendo o layout de
 * `(app)`.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sessao = await sessaoAtual();

  return (
    <html
      lang="pt-BR"
      className={`${classesDasFontes} h-full antialiased`}
      // O tema escolhido é aplicado pelo script abaixo, antes da pintura.
      // Animação é preferência de conta: já vem pronta do servidor, sem
      // script nem flash — ausente (sem sessão) significa animações ligadas.
      data-animacoes={sessao?.reduzirAnimacoes ? "desativadas" : undefined}
      suppressHydrationWarning
    >
      <head>
        {/*
          Padrão documentado pelo Next para evitar o flash de tema
          (docs/app/guides/preventing-flash-before-hydration).

          O React avisa no console que "scripts dentro de componentes nunca
          executam na renderização do cliente". O aviso é verdadeiro e
          irrelevante aqui: este script existe para rodar durante a análise do
          HTML, ANTES da primeira pintura, que é o único momento em que ele
          serve. Em navegação de cliente o tema já está aplicado.

          Tentar contornar com `next/script` e `beforeInteractive` produz
          exatamente o mesmo aviso, sem ganho.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/*
          O campo de luz.

          Fica no layout RAIZ, e não em cada tela, porque é `position: fixed`:
          ele pertence à janela, não ao documento. Posto dentro de uma página
          ele viraria filho de um contêiner com `transform` na troca de aba —
          e um ancestral transformado quebra o `fixed`, fazendo a luz rolar
          junto com o conteúdo.
        */}
        <div className="aurora" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
