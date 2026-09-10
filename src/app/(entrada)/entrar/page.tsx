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
    <Cartao className="px-6 py-7 sm:px-8">
      <h1 className="font-serif text-2xl leading-none">Entrar</h1>
      <p className="text-sm text-tinta-2 mt-2 mb-7">
        Seus pedidos, produtos e comissões do jeito que você deixou.
      </p>

      <FormularioEntrada acao={entrar} rotulo="Entrar" />

      <p className="text-sm text-tinta-2 mt-6 text-center">
        Ainda não tem conta?{" "}
        <Link
          href="/comecar"
          className="text-carimbo underline underline-offset-4 decoration-carimbo/40 hover:decoration-carimbo"
        >
          Criar um escritório
        </Link>
      </p>
    </Cartao>
  );
}
