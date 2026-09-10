import Link from "next/link";

import { AlternadorTema } from "@/components/alternador-tema";

/**
 * Telas de entrada: login e cadastro.
 *
 * Sem navegação — quem está aqui ainda não tem para onde navegar. A tela é a
 * folha de rosto do produto: nome em serifada, um filete, o formulário. Nada de
 * ilustração nem de brilho; o que apresenta o sistema é o mesmo cuidado
 * tipográfico que ele vai ter depois do login.
 */
export default function LayoutEntrada({ children }: LayoutProps<"/">) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      {/* O alternador fica no canto, fora da coluna: é ferramenta, não conteúdo. */}
      <div className="fixed top-3 right-3 z-10">
        <AlternadorTema />
      </div>

      <div className="w-full max-w-sm surgir">
        <header className="text-center mb-9">
          <Link
            href="/"
            className="font-serif text-[2.5rem] leading-none tracking-tight transition-colors hover:text-carimbo"
          >
            RepPlast
          </Link>

          <hr className="regra my-4" />

          <p className="rotulo">Pedidos · PDF para a indústria · comissão</p>
        </header>

        {children}
      </div>
    </main>
  );
}
