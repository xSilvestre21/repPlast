"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/pedidos", rotulo: "Pedidos" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/produtos", rotulo: "Produtos" },
  { href: "/fornecedores", rotulo: "Fornecedores" },
];

export function Navegacao() {
  const caminho = usePathname();

  return (
    <header className="border-b border-borda bg-superficie">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-6 h-14">
          <Link href="/" className="font-semibold tracking-tight shrink-0">
            Rep<span className="text-acento">Plast</span>
          </Link>

          {/* Rola horizontalmente no celular em vez de quebrar a barra. */}
          <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {ITENS.map((item) => {
              const ativo = caminho === item.href || caminho.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                    ativo
                      ? "bg-superficie-alta text-texto"
                      : "text-texto-suave hover:text-texto hover:bg-superficie-alta/60"
                  }`}
                >
                  {item.rotulo}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
