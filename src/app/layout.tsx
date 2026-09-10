import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

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
    >
      <body className="min-h-full flex flex-col font-sans">
        <Navegacao />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
