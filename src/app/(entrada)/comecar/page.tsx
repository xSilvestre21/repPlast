import Link from "next/link";
import { redirect } from "next/navigation";

import { Cartao } from "@/components/ui";
import { sessaoAtual } from "@/lib/sessao";

import { cadastrar } from "../acoes";
import { FormularioCadastro } from "../formulario";

export default async function PaginaComecar() {
  if (await sessaoAtual()) redirect("/");

  return (
    <Cartao className="px-6 py-7 sm:px-8">
      <h1 className="font-serif text-2xl leading-none">Criar meu escritório</h1>
      <p className="text-sm text-tinta-2 mt-2 mb-6">
        Leva menos de um minuto. Nenhum cartão, nenhuma configuração.
      </p>

      {/*
        Três frases antes do formulário.

        Pedir nome, e-mail e senha sem dizer para quê é o jeito mais rápido de
        perder alguém que chegou por indicação e ainda não viu o produto.
      */}
      <ul className="mb-7 border-y border-filete divide-y divide-filete">
        {[
          "O preço sai das medidas, não da sua calculadora.",
          "O PDF vai para a indústria no formato que ela já conhece.",
          "Seus dados ficam isolados dos de qualquer outro escritório.",
        ].map((texto) => (
          <li key={texto} className="py-2.5 text-sm text-tinta-2 leading-snug">
            {texto}
          </li>
        ))}
      </ul>

      <FormularioCadastro acao={cadastrar} />

      <p className="text-sm text-tinta-2 mt-6 text-center">
        Já tem conta?{" "}
        <Link
          href="/entrar"
          className="text-carimbo underline underline-offset-4 decoration-carimbo/40 hover:decoration-carimbo"
        >
          Entrar
        </Link>
      </p>
    </Cartao>
  );
}
