"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AlternadorTema } from "./alternador-tema";

const ITENS = [
  { href: "/", rotulo: "Painel" },
  { href: "/pedidos", rotulo: "Pedidos" },
  { href: "/comissoes", rotulo: "Comissões" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/produtos", rotulo: "Produtos" },
  { href: "/fornecedores", rotulo: "Fornecedores" },
];

export function Navegacao() {
  const caminho = usePathname();

  return (
    // A barra precisa de fundo próprio: sendo fixa e translúcida, o conteúdo
    // rolava por trás e colidia com a marca. O vidro fosco mantém o ar da
    // Aurora sem deixar o texto se sobrepor.
    <header className="sticky top-0 z-40 barra-topo border-b border-borda">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
        {/*
          No desktop a navegação fica centralizada de verdade, por posicionamento
          absoluto — assim a marca e o alternador não empurram o centro.
          No celular vira duas linhas, porque não cabe.
        */}
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="font-semibold tracking-tight shrink-0 text-base hover:opacity-80 transition-opacity"
            >
              Rep<span className="texto-gradiente">Plast</span>
            </Link>

            <div className="sm:hidden">
              <AlternadorTema />
            </div>
          </div>

          <nav className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex justify-center">
            <div className="flex gap-1 p-1 rounded-full border border-borda vidro shadow-[var(--sombra-cartao)] overflow-x-auto max-w-full">
              {ITENS.map((item) => {
                // A raiz precisa de comparação exata: `startsWith("/")` casaria
                // com todas as rotas e deixaria o Painel sempre aceso.
                const ativo =
                  item.href === "/"
                    ? caminho === "/"
                    : caminho === item.href || caminho.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={ativo ? "page" : undefined}
                    className={`px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap transition-all duration-200 ${
                      ativo
                        ? "fundo-gradiente text-sobre-acento font-semibold"
                        : "text-texto-suave hover:text-texto hover:bg-superficie-alta"
                    }`}
                  >
                    {item.rotulo}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="hidden sm:block">
            <AlternadorTema />
          </div>
        </div>
      </div>
    </header>
  );
}
