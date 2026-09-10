import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SCRIPT_TEMA } from "@/components/alternador-tema";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
        {/* O id permite ao painel de meta virar este brilho em comemoração. */}
        <div id="aurora" className="aurora-fundo" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
