import type { Metadata } from "next";
import Link from "next/link";

import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { Cartao, MensagemErro } from "@/components/ui";
import { LINK_TROCA_VENCIDO, pedidoDoLink } from "@/lib/troca-email";

import { confirmarTrocaEmail } from "../../acoes";
import { FormularioConfirmarEmail } from "../../formulario";

/**
 * O link mandado ao e-mail novo: confirma a troca do login.
 *
 * Mora em `(entrada)` porque pode ser aberto sem sessão — no celular, onde a
 * pessoa lê o e-mail. Como em `redefinir-senha`, sem `Referer`: o token está
 * no endereço e não pode vazar para o site de um link clicado aqui.
 */
export const metadata: Metadata = {
  title: "Confirmar e-mail · RepPlast",
  referrer: "no-referrer",
};

export default async function PaginaConfirmarEmail({ params }: PageProps<"/confirmar-email/[token]">) {
  const { token } = await params;

  // Conferido ao abrir e de novo ao confirmar (`trocarPeloLink`). Abrir NÃO
  // troca: só o botão — ver `confirmarTrocaEmail`.
  const pedido = await pedidoDoLink(token);

  return (
    <>
      <TopoEntrada />
      <div className="w-full max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20 surgir">
        <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-9">
          <h1 className="text-forte font-bold tracking-[-0.025em] leading-none">Confirme o e-mail novo</h1>

          {pedido ? (
            <>
              <p className="text-corpo text-tinta-2 mt-2.5 mb-7 leading-relaxed">
                Daqui em diante você entra com{" "}
                <span className="font-medium text-tinta break-words">{pedido.emailNovo}</span>, no
                lugar de <span className="break-words">{pedido.emailAtual}</span>. A senha continua a
                mesma; os outros aparelhos conectados precisam entrar de novo.
              </p>
              <FormularioConfirmarEmail acao={confirmarTrocaEmail.bind(null, token)} />
            </>
          ) : (
            <div className="mt-6 space-y-5">
              <MensagemErro>{LINK_TROCA_VENCIDO}</MensagemErro>
              <p className="text-center">
                <Link
                  href="/entrar"
                  className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
                >
                  Ir para a tela de entrar
                </Link>
              </p>
            </div>
          )}
        </Cartao>
      </div>
    </>
  );
}
