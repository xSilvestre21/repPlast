import Link from "next/link";
import { redirect } from "next/navigation";

import { Cartao } from "@/components/ui";
import { sessaoAtual } from "@/lib/sessao";

import { cadastrar } from "../acoes";
import { FormularioCadastro } from "../formulario";

export default async function PaginaComecar() {
  if (await sessaoAtual()) redirect("/");

  return (
    <Cartao className="p-6 sm:p-8 surgir">
      <h1 className="text-xl font-semibold tracking-tight mb-1">Criar meu escritório</h1>
      <p className="text-sm text-texto-suave mb-6">
        Seus dados ficam isolados dos de qualquer outro escritório — ninguém mais vê seus
        clientes, seus preços ou suas comissões.
      </p>

      <FormularioCadastro acao={cadastrar} />

      <p className="text-sm text-texto-suave mt-6 text-center">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-acento hover:underline">
          Entrar
        </Link>
      </p>
    </Cartao>
  );
}
