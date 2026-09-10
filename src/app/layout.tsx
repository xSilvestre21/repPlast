import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { SCRIPT_TEMA } from "@/components/alternador-tema";
import { Navegacao } from "@/components/navegacao";

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
          `beforeInteractive` coloca o script no HTML inicial e o executa antes
          da hidratação — que é o único momento em que ele serve. Um <script>
          solto dentro do componente funcionaria no primeiro carregamento, mas
          o React avisa (com razão) que ele nunca roda em navegação de cliente.
        */}
        <Script
          id="tema-inicial"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* O id permite ao painel de meta virar este brilho em comemoração. */}
        <div id="aurora" className="aurora-fundo" aria-hidden="true" />
        <Navegacao />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
