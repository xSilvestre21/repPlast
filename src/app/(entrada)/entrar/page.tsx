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
    <Cartao className="p-6 sm:p-8 surgir">
      <h1 className="text-xl font-semibold tracking-tight mb-1">Entrar</h1>
      <p className="text-sm text-texto-suave mb-6">
        Seus pedidos, produtos e comissões do jeito que você deixou.
      </p>

      <FormularioEntrada acao={entrar} rotulo="Entrar" />

      <p className="text-sm text-texto-suave mt-6 text-center">
        Ainda não tem conta?{" "}
        <Link href="/comecar" className="text-acento hover:underline">
          Criar um escritório
        </Link>
      </p>
    </Cartao>
  );
}
