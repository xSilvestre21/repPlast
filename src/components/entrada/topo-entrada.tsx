/**
 * Barra do topo das telas de entrada.
 *
 * Na landing (`completo`) ela é o menu da página: âncoras para as seções e o
 * botão de criar escritório. No cadastro e na assinatura fica só a marca e o
 * tema — quem está no meio de um formulário não precisa de atalho para sair.
 */

import Link from "next/link";

import { AlternadorTema } from "@/components/alternador-tema";

const SECOES = [
  { href: "#como-funciona", rotulo: "Como funciona" },
  { href: "#recursos", rotulo: "Recursos" },
  { href: "#planos", rotulo: "Planos" },
  { href: "#perguntas", rotulo: "Perguntas" },
];

export function TopoEntrada({ completo = false }: { completo?: boolean }) {
  return (
    <header className="sticky top-0 z-20 barra-topo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link
          href="/entrar"
          className="text-medio font-extrabold tracking-[-0.03em] text-tinta transition-colors hover:text-carimbo"
        >
          RepPlast
        </Link>

        {completo && (
          <nav aria-label="Seções" className="hidden md:flex items-center gap-1">
            {SECOES.map((secao) => (
              <a
                key={secao.href}
                href={secao.href}
                className="px-3 py-1.5 rounded-full text-corpo text-tinta-2 transition-colors hover:text-tinta hover:bg-folha-2"
              >
                {secao.rotulo}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <AlternadorTema />
          {completo && (
            <Link
              href="/comecar"
              className="hidden sm:inline-flex items-center rounded-full bg-tinta text-papel text-rotulo font-semibold px-4 py-2 shadow-folha transition-all duration-200 hover:-translate-y-0.5 hover:shadow-alta"
            >
              Criar escritório
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
