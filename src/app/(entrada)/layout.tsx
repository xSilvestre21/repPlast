import Link from "next/link";

import { AlternadorTema } from "@/components/alternador-tema";

/**
 * Telas de entrada: login e cadastro.
 *
 * Sem navegação — quem está aqui ainda não tem para onde navegar. O cartão fica
 * centralizado na tela, com o brilho da Aurora ao fundo fazendo o trabalho de
 * apresentação do produto.
 */
export default function LayoutEntrada({ children }: LayoutProps<"/">) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Rep<span className="texto-gradiente">Plast</span>
          </Link>
          <AlternadorTema />
        </div>

        {children}
      </div>
    </main>
  );
}
