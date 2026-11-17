import { ArrowLeft, RotateCcw } from "lucide-react";
import { redirect } from "next/navigation";

import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { BotaoLink, Cartao, Mensagem } from "@/components/ui";
import { VALIDADE_MIN } from "@/lib/redefinicao-senha";
import { inicioDa, sessaoAtual } from "@/lib/sessao";

import { pedirRedefinicaoSenha } from "../acoes";
import { FormularioEsqueciSenha } from "../formulario";

/**
 * "Esqueceu sua senha?" — pede o e-mail e manda o link.
 *
 * Depois de enviar, a frase é a mesma com ou sem conta para o e-mail
 * (`pedirRedefinicaoSenha`): a tela não pode servir para descobrir quem tem conta.
 */
export default async function PaginaEsqueciSenha({ searchParams }: PageProps<"/esqueci-senha">) {
  const logado = await sessaoAtual();
  if (logado) redirect(inicioDa(logado));
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-corpo text-tinta-2">Não chegou em alguns minutos?</p>
                <BotaoLink href="/esqueci-senha" variante="secundaria" tamanho="compacto" icone={RotateCcw}>
                  Pedir de novo
                </BotaoLink>
              </div>
            </div>
          ) : (
            <>
              <p className="text-corpo text-tinta-2 mt-2.5 mb-7 leading-relaxed">
                Informe o seu e-mail e mandamos um link para você criar uma senha nova.
              </p>
              <FormularioEsqueciSenha acao={pedirRedefinicaoSenha} />
            </>
          )}

          <div className="mt-7 flex justify-center">
            <BotaoLink href="/entrar" variante="secundaria" tamanho="compacto" icone={ArrowLeft}>
              Voltar para entrar
            </BotaoLink>
          </div>
        </Cartao>
      </div>
    </>
  );
}
