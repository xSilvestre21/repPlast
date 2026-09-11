import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { SCRIPT_TEMA } from "@/components/alternador-tema";

import "./globals.css";

/*
 * Duas vozes, e cada uma tem um trabalho.
 *
 * Plus Jakarta Sans conduz tudo: interface, títulos e NÚMEROS. É uma
 * geométrica de terminações retas e caixa alta estreita, que é o que permite
 * levar um valor a 4rem com tracking negativo sem ele virar um borrão — e é
 * justamente aí, no número grande, que a tela ganha a cara de produto.
 *
 * IBM Plex Mono cuida do que é código: medida (99x166x0,08), COD.FORN,
 * descrição gerada. São dados que a indústria confere caractere a caractere, e
 * numa proporcional o 1 e o l se confundem.
 *
 * O peso 800 existe só para o número da comissão. Abaixo dele nada passa de
 * 600, senão a tela inteira grita junto e o valor deixa de ser o mais alto.
 */
const sans = Plus_Jakarta_Sans({
  variable: "--fonte-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
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
