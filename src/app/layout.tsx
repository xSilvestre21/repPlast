import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";

import { SCRIPT_TEMA } from "@/components/alternador-tema";

import "./globals.css";

/*
 * Três vozes, e cada uma tem um trabalho.
 *
 * Newsreader é a serifada dos NÚMEROS e dos títulos. É o gesto central da
 * identidade: o valor que a pessoa abriu o sistema para ver sai impresso, com
 * o peso que uma serifada dá a uma manchete.
 *
 * IBM Plex Sans conduz a interface. Foi desenhada para uma empresa que fazia
 * máquinas, e carrega isso — é neutra sem ser a fonte de todo mundo.
 *
 * IBM Plex Mono cuida do que é código: medida (99x166x0,08), COD.FORN,
 * descrição gerada. São dados que a indústria confere caractere a caractere.
 */
const serifada = Newsreader({
  variable: "--fonte-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const sans = IBM_Plex_Sans({
  variable: "--fonte-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--fonte-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "RepPlast",
  description: "Pedidos e comissões para representantes de embalagens plásticas",
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
 * telas de login e cadastro não têm nem uma nem outro.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${serifada.variable} ${mono.variable} h-full antialiased`}
      // O tema escolhido é aplicado pelo script abaixo, antes da pintura.
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
        {/* O grão é a única textura do sistema: sem ele o fundo é tela, não papel. */}
        <div className="grao" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
