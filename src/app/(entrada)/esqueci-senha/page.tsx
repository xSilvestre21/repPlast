import Link from "next/link";
import { redirect } from "next/navigation";

import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { Cartao, Mensagem } from "@/components/ui";
import { VALIDADE_MIN } from "@/lib/redefinicao-senha";
import { sessaoAtual } from "@/lib/sessao";

import { pedirRedefinicaoSenha } from "../acoes";
import { FormularioEsqueciSenha } from "../formulario";

/**
 * "Esqueceu sua senha?" — pede o e-mail e manda o link.
 *
 * Depois de enviar, a frase é a mesma com ou sem conta para o e-mail
 * (`pedirRedefinicaoSenha`): a tela não pode servir para descobrir quem tem conta.
 */
export default async function PaginaEsqueciSenha({ searchParams }: PageProps<"/esqueci-senha">) {
  if (await sessaoAtual()) redirect("/");
  const { enviado } = await searchParams;

  return (
    <>
      <TopoEntrada />
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20 surgir">
        <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-9">
          <h1 className="text-forte font-bold tracking-[-0.025em] leading-none">Esqueceu sua senha?</h1>

          {enviado ? (
            <div className="mt-6 space-y-5">
              <Mensagem tom="verde">
                Se houver uma conta com este e-mail, enviamos um link para criar uma senha nova. Ele
                vale por {VALIDADE_MIN} minutos — confira também a caixa de spam.
              </Mensagem>
              <p className="text-corpo text-tinta-2">
                Não chegou em alguns minutos?{" "}
                <Link
                  href="/esqueci-senha"
                  className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
                >
                  Pedir de novo
                </Link>
              </p>
            </div>
          ) : (
            <>
              <p className="text-corpo text-tinta-2 mt-2.5 mb-7 leading-relaxed">
                Informe o seu e-mail e mandamos um link para você criar uma senha nova.
              </p>
              <FormularioEsqueciSenha acao={pedirRedefinicaoSenha} />
            </>
          )}

          <p className="text-corpo text-tinta-2 mt-7 text-center">
            <Link
              href="/entrar"
              className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
            >
              Voltar para entrar
            </Link>
          </p>
        </Cartao>
      </div>
    </>
  );
}
