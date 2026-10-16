import { Check, CreditCard, Lock } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CartoesPlanos } from "@/components/entrada/cartoes-planos";
import { Movimento } from "@/components/entrada/movimento";
import { SemScriptRevela } from "@/components/entrada/revelar";
import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { Cartao } from "@/components/ui";
import { planoDaUrl, type Plano } from "@/lib/planos";
import { inicioDa, sessaoAtual } from "@/lib/sessao";

import { cadastrar } from "../acoes";
import { FormularioCadastro } from "../formulario";

/**
 * Criar escritório, em dois passos: escolher o plano, depois preencher.
 *
 * O plano mora na URL (`?plano=solo|max`), e não num estado de tela: o link
 * dos cartões da landing cai direto no segundo passo, o "voltar" do navegador
 * volta aos cartões, e um recarregar no meio não perde a escolha.
 */
export default async function PaginaComecar({ searchParams }: PageProps<"/comecar">) {
  const logado = await sessaoAtual();
  if (logado) redirect(inicioDa(logado));

  const { plano: slug } = await searchParams;
  const plano = planoDaUrl(typeof slug === "string" ? slug : null);

  return (
    <Movimento>
      <SemScriptRevela />
      <TopoEntrada />
      {plano ? <PassoCadastro plano={plano} /> : <PassoPlanos />}
    </Movimento>
  );
}

function LinkEntrar() {
  return (
    <p className="text-corpo text-tinta-2 mt-8 text-center">
      Já tem conta?{" "}
      <Link
        href="/entrar"
        className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
      >
        Entrar
      </Link>
    </p>
  );
}

function PassoPlanos() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="palco text-center max-w-2xl mx-auto mb-10 sm:mb-14">
        <p className="rotulo text-carimbo">Passo 1 de 2</p>
        <h1 className="mt-3 text-titulo font-extrabold text-tinta text-balance">
          Escolha o plano do seu escritório
        </h1>
        <p className="mt-4 text-realce text-tinta-2">
          Sem taxa de implantação e sem fidelidade. Dá para trocar de plano depois.
        </p>
      </div>

      <CartoesPlanos animarAoRolar={false} />
      <LinkEntrar />
    </div>
  );
}

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function PassoCadastro({ plano }: { plano: Plano }) {
  return (
    <div
      className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14
        grid gap-8 lg:gap-14 items-start lg:grid-cols-[1fr_minmax(0,27rem)]"
    >
      {/* O que está sendo assinado — sempre à vista enquanto se preenche. */}
      <section className="palco min-w-0 lg:sticky lg:top-24">
        <p className="rotulo text-carimbo">Passo 2 de 2</p>
        <h1 className="mt-3 text-titulo font-extrabold text-tinta text-balance">
          Criar meu escritório
        </h1>
        <p className="mt-4 text-realce text-tinta-2 leading-relaxed max-w-md">
          Preencha os dados e siga para o pagamento. Assim que ele for confirmado, o sistema abre
          pronto para o primeiro pedido.
        </p>

        <div className="folha mt-8 p-5 sm:p-6 max-w-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-mini text-tinta-3">Plano escolhido</p>
              <p className="text-forte font-bold text-tinta">{plano.nome}</p>
            </div>
            <p className="text-right">
              <span className="text-medio font-bold text-tinta numerico">
                {MOEDA.format(plano.precoMensal.toNumber())}
              </span>
              <span className="text-mini text-tinta-2">/mês</span>
            </p>
          </div>
          <ul className="mt-4 space-y-2">
            {plano.destaques.slice(0, 4).map((destaque) => (
              <li key={destaque} className="flex items-start gap-2 text-corpo text-tinta-2">
                <Check size={15} strokeWidth={2.5} className="shrink-0 mt-0.5 text-verde" aria-hidden="true" />
                {destaque}
              </li>
            ))}
          </ul>
          <Link
            href="/comecar"
            className="inline-block mt-5 text-rotulo text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
          >
            Trocar plano
          </Link>
        </div>

        <ul className="mt-6 space-y-2.5 max-w-md">
          <li className="flex items-center gap-2.5 text-rotulo text-tinta-2">
            <CreditCard size={15} strokeWidth={2} className="text-tinta-3" aria-hidden="true" />
            Cartão de crédito, cobrado todo mês pelo Asaas.
          </li>
          <li className="flex items-center gap-2.5 text-rotulo text-tinta-2">
            <Lock size={15} strokeWidth={2} className="text-tinta-3" aria-hidden="true" />
            O cartão é digitado na página do Asaas — nunca passa pelo RepPlast.
          </li>
        </ul>
      </section>

      <div className="w-full min-w-0 surgir">
        <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-9">
          <h2 className="text-forte font-bold tracking-[-0.025em] leading-none">Seus dados</h2>
          <p className="text-corpo text-tinta-2 mt-2.5 mb-7 leading-relaxed">
            Leva menos de um minuto. Você entra como administrador do escritório.
          </p>
          <FormularioCadastro acao={cadastrar} plano={plano.slug} />
          <LinkEntrar />
        </Cartao>
      </div>
    </div>
  );
}
