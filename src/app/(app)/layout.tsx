import { redirect } from "next/navigation";

import { Navegacao } from "@/components/navegacao";
import { sessaoAtual } from "@/lib/sessao";

/**
 * Tudo que está sob este layout exige login.
 *
 * O guarda mora aqui, e não em cada página, porque um esquecimento numa página
 * nova viraria acesso sem sessão. As rotas de arquivo (PDF do pedido, logo da
 * indústria) não passam por layout e por isso se protegem sozinhas, chamando
 * `organizacaoAtual()`, que lança sem sessão.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sessao = await sessaoAtual();

  if (!sessao) redirect("/entrar");

  return (
    <>
      <Navegacao
        nomeUsuario={sessao.nome}
        mostrarPrepostos={sessao.papel === "ADMIN" && sessao.plano === "PLUS"}
      />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
