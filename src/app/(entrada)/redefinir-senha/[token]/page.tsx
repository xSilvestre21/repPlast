import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { Cartao, MensagemErro } from "@/components/ui";
import { donoDoLink, LINK_VENCIDO } from "@/lib/redefinicao-senha";
import { inicioDa, sessaoAtual } from "@/lib/sessao";

import { redefinirSenha } from "../../acoes";
import { FormularioSenhaNova } from "../../formulario";

/**
 * O link do e-mail: a senha nova.
 *
 * O token está no endereço, então a página não pode deixá-lo vazar: sem
 * `Referer`, um link clicado aqui não leva o endereço — e o token — para o
 * outro site.
 */
export const metadata: Metadata = {
  title: "Senha nova · RepPlast",
  referrer: "no-referrer",
};

export default async function PaginaRedefinirSenha({ params }: PageProps<"/redefinir-senha/[token]">) {
  const logado = await sessaoAtual();
  if (logado) redirect(inicioDa(logado));
  const { token } = await params;

  // Conferido ao abrir, e de novo ao salvar (`redefinirPeloLink`): link que
  // não serve nem mostra o formulário — preencher para ouvir "venceu" depois
  // seria pior.
  const dono = await donoDoLink(token);

  return (
    <>
      <TopoEntrada />
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20 surgir">
        <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-9">
          <h1 className="text-forte font-bold tracking-[-0.025em] leading-none">Crie uma senha nova</h1>

          {dono ? (
            <>
              <p className="text-corpo text-tinta-2 mt-2.5 mb-7 leading-relaxed">
                Para a conta <span className="font-medium text-tinta">{dono.email}</span>. Depois de
                salvar, todos os aparelhos conectados precisam entrar de novo.
              </p>
              <FormularioSenhaNova acao={redefinirSenha.bind(null, token)} />
            </>
          ) : (
            <div className="mt-6 space-y-5">
              <MensagemErro>{LINK_VENCIDO}</MensagemErro>
              <p className="text-center">
                <Link
                  href="/esqueci-senha"
                  className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
                >
                  Pedir um link novo
                </Link>
              </p>
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}
