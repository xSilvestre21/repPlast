import { redirect } from "next/navigation";

import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { BotaoTexto, Cartao } from "@/components/ui";
import { PLANOS } from "@/lib/planos";
import { sessaoAtual } from "@/lib/sessao";

import { reabrirPagamento, sair } from "../acoes";
import { AguardarConfirmacao, ReabrirPagamento } from "./acompanhar";

/**
 * Onde cai quem está logado mas sem a assinatura em dia — o layout de `(app)`
 * manda para cá.
 *
 * Mora em `(entrada)` e não em `(app)` porque aquele layout é justamente o que
 * redireciona para cá: estar lá dentro seria um laço.
 *
 * Também é a volta do checkout do Asaas (`successUrl`, `cancelUrl`,
 * `expiredUrl`): com `?status=pago` a tela espera o webhook confirmar.
 */

const TEXTOS = {
  AGUARDANDO_PAGAMENTO: {
    titulo: "Falta só o pagamento",
    texto:
      "Seu escritório já está criado. Assim que a primeira mensalidade for paga, o sistema abre " +
      "com tudo pronto para o primeiro pedido.",
    botao: "Ir para o pagamento",
  },
  ATRASADA: {
    titulo: "A mensalidade está em atraso",
    texto:
      "A última cobrança não foi paga, e o acesso fica suspenso até ela ser acertada. Seus dados " +
      "continuam guardados — nada foi apagado.",
    botao: "Pagar a mensalidade",
  },
  CANCELADA: {
    titulo: "A assinatura foi cancelada",
    texto:
      "O escritório e os dados continuam guardados. Para voltar a usar, assine de novo — o " +
      "sistema reabre exatamente como estava.",
    botao: "Assinar de novo",
  },
};

export default async function PaginaAssinatura({ searchParams }: PageProps<"/assinatura">) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  if (sessao.assinatura === "ATIVA") redirect("/");

  const { status } = await searchParams;
  const voltouPago = status === "pago" && sessao.assinatura === "AGUARDANDO_PAGAMENTO";
  const texto = TEXTOS[sessao.assinatura];
  const plano = PLANOS[sessao.plano];

  return (
    <>
      <TopoEntrada />
      <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-20 surgir">
        <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-10">
          <p className="rotulo">
            {sessao.organizacaoNome} · Plano {plano.nome}
          </p>
          <h1 className="mt-3 text-forte font-bold text-tinta text-balance">
            {voltouPago ? "Pagamento recebido — quase lá" : texto.titulo}
          </h1>
          <p className="mt-3 text-corpo text-tinta-2 leading-relaxed">
            {voltouPago
              ? "Estamos esperando o Asaas confirmar o pagamento. Leva poucos segundos; a página abre o sistema sozinha."
              : texto.texto}
          </p>

          {voltouPago && (
            <div className="mt-6">
              <AguardarConfirmacao />
            </div>
          )}

          <div className="mt-8">
            {sessao.papel === "ADMIN" ? (
              <ReabrirPagamento acao={reabrirPagamento} rotulo={texto.botao} />
            ) : (
              <p className="text-corpo text-tinta-2">
                Quem acerta a assinatura é o administrador do escritório. Avise essa pessoa — assim
                que estiver em dia, você entra normalmente.
              </p>
            )}
          </div>

          <form action={sair} className="mt-6 text-center">
            <BotaoTexto type="submit">Sair e entrar com outra conta</BotaoTexto>
          </form>
        </Cartao>
      </div>
    </>
  );
}
