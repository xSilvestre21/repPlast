import Link from "next/link";
import { redirect } from "next/navigation";

import { Cartao } from "@/components/ui";
import { sessaoAtual } from "@/lib/sessao";

import { cadastrar } from "../acoes";
import { FormularioCadastro } from "../formulario";

export default async function PaginaComecar() {
  if (await sessaoAtual()) redirect("/");

  /*
   * As três frases que ficavam aqui subiram para o layout.
   *
   * Elas valem igual para quem chega e para quem volta, e escritas num lugar
   * só não têm como divergir entre esta tela e a de login. O que sobra aqui é
   * o que é específico do cadastro: o custo de entrar.
   */
  return (
    <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-9">
      <h1 className="text-2xl font-bold tracking-[-0.025em] leading-none">
        Criar meu escritório
      </h1>
      <p className="text-sm text-tinta-2 mt-2.5 mb-7 leading-relaxed">
        Leva menos de um minuto. Nenhum cartão, nenhuma configuração.
      </p>

      <FormularioCadastro acao={cadastrar} />

      <p className="text-sm text-tinta-2 mt-7 text-center">
        Já tem conta?{" "}
        <Link
          href="/entrar"
          className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
        >
          Entrar
        </Link>
      </p>
    </Cartao>
  );
}
