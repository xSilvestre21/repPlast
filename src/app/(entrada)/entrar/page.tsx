import Link from "next/link";
import { redirect } from "next/navigation";

import { Cartao } from "@/components/ui";
import { sessaoAtual } from "@/lib/sessao";

import { entrar } from "../acoes";
import { FormularioEntrada } from "../formulario";

export default async function PaginaEntrar() {
  // Quem já está logado não tem o que fazer aqui.
  if (await sessaoAtual()) redirect("/");

  return (
    // `marcada` dá a esta folha o canto maior e a sombra alta: numa tela em que
    // ela é o único cartão, é o que a levanta do fundo em vez de encostá-la.
    <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-9">
      <h1 className="text-2xl font-bold tracking-[-0.025em] leading-none">Entrar</h1>
      <p className="text-sm text-tinta-2 mt-2.5 mb-7 leading-relaxed">
        Seus pedidos, produtos e comissões do jeito que você deixou.
      </p>

      <FormularioEntrada acao={entrar} rotulo="Entrar" />

      <p className="text-sm text-tinta-2 mt-7 text-center">
        Ainda não tem conta?{" "}
        <Link
          href="/comecar"
          className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
        >
          Criar um escritório
        </Link>
      </p>
    </Cartao>
  );
}
