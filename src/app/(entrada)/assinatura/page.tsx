import { redirect } from "next/navigation";

import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { BotaoTexto, Cartao } from "@/components/ui";
import { assinaturaLiberada } from "@/lib/acesso-assinatura";
import { PLANOS } from "@/lib/planos";
import { sessaoAtual } from "@/lib/sessao";
import { datasDoTeste, DIAS_DE_TESTE } from "@/lib/teste-gratis";

import { cancelarAssinaturaEmAtraso, reabrirPagamento, sair } from "../acoes";
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
 *
 * O escritório que ganhou os 7 dias grátis e ainda não pôs o cartão
 * (`testeAte` preenchido, aguardando) lê outra coisa: não há pagamento a
 * fazer, só o cartão a cadastrar — e a data em que a cobrança viria.
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
  // O "ATIVA" explícito, além da regra, é o que deixa o TypeScript saber que
  // daqui para baixo a situação tem texto em `TEXTOS`.
  if (sessao.assinatura === "ATIVA" || assinaturaLiberada(sessao)) redirect("/");

  const { status } = await searchParams;
  // Qualquer volta de checkout pago espera o webhook: a do cadastro e a de quem
  // assina de novo depois de cancelar. Só para o primeiro caso, quem voltava
  // antes do aviso do Asaas via "A assinatura foi cancelada" com o botão de
  // assinar — um convite a pagar duas vezes.
  const voltouPago = status === "pago";
  const plano = PLANOS[sessao.plano];
  const doTeste = sessao.assinatura === "AGUARDANDO_PAGAMENTO" && sessao.testeAte !== null;
  // Reaberto agora, o checkout conta os 7 dias de hoje (`reabrirPagamento`).
  const texto = doTeste
    ? {
        titulo: "Falta cadastrar o cartão",
        texto:
          `Seu escritório já está criado. Cadastre o cartão para começar os ${DIAS_DE_TESTE} dias ` +
          `grátis — nada é cobrado até ${datasDoTeste().cobranca}, e cancelando antes, não paga nada. ` +
          "O botão do Asaas diz “Pagar”, com o valor da mensalidade; a data da cobrança aparece ao " +
          "lado, em “Primeira cobrança”.",
        botao: "Cadastrar o cartão",
      }
    : TEXTOS[sessao.assinatura];

  return (
    <>
      <TopoEntrada />
      <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-12 sm:py-20 surgir">
        <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-10">
          <p className="rotulo">
            {sessao.organizacaoNome} · Plano {plano.nome}
          </p>
          <h1 className="mt-3 text-forte font-bold text-tinta text-balance">
            {voltouPago ? (doTeste ? "Cartão cadastrado — quase lá" : "Pagamento recebido — quase lá") : texto.titulo}
          </h1>
          <p className="mt-3 text-corpo text-tinta-2 leading-relaxed">
            {voltouPago
              ? `Estamos esperando o Asaas confirmar ${doTeste ? "o cartão" : "o pagamento"}. Leva poucos segundos; a página abre o sistema sozinha.`
              : texto.texto}
          </p>

          {voltouPago ? (
            <div className="mt-6">
              <AguardarConfirmacao
                doCartao={doTeste}
                seDesistir={
                  sessao.papel === "ADMIN" && (
                    <ReabrirPagamento
                      acao={reabrirPagamento}
                      rotulo={doTeste ? "Cadastrar o cartão de novo" : "Abrir o pagamento de novo"}
                    />
                  )
                }
              />
            </div>
          ) : (
            <div className="mt-8">
              {sessao.papel === "ADMIN" ? (
                <>
                  <ReabrirPagamento acao={reabrirPagamento} rotulo={texto.botao} />
                  {/*
                    Em atraso, quem não vai pagar também precisa poder parar a
                    cobrança daqui: as Configurações, onde fica o botão de quem
                    está em dia, não abrem sem a assinatura em dia.
                  */}
                  {sessao.assinatura === "ATRASADA" && (
                    <div className="mt-4 text-center">
                      <AcaoComRecusa
                        acao={cancelarAssinaturaEmAtraso}
                        confirmar={{
                          titulo: "Cancelar a assinatura?",
                          texto:
                            "A mensalidade em atraso deixa de ser cobrada, e o acesso, que está suspenso, fica " +
                            "encerrado. O escritório e os dados continuam guardados: para voltar, é só assinar de novo.",
                          rotulo: "Cancelar a assinatura",
                          desistir: "Manter a assinatura",
                        }}
                      >
                        <BotaoTexto type="submit" perigoso>
                          Cancelar a assinatura
                        </BotaoTexto>
                      </AcaoComRecusa>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-corpo text-tinta-2">
                  Quem acerta a assinatura é o administrador do escritório. Avise essa pessoa — assim
                  que estiver em dia, você entra normalmente.
                </p>
              )}
            </div>
          )}

          <form action={sair} className="mt-6 text-center">
            <BotaoTexto type="submit">Sair e entrar com outra conta</BotaoTexto>
          </form>
        </Cartao>
      </div>
    </>
  );
}
