import { ArrowRight, Calculator, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CartoesPlanos } from "@/components/entrada/cartoes-planos";
import { ComoFunciona } from "@/components/entrada/como-funciona";
import { FluxoAnimado } from "@/components/entrada/fluxo-animado";
import { Movimento } from "@/components/entrada/movimento";
import { Perguntas } from "@/components/entrada/perguntas";
import { Recursos } from "@/components/entrada/recursos";
import { Revelar, SemScriptRevela } from "@/components/entrada/revelar";
import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { Cartao, Placa } from "@/components/ui";
import { sessaoAtual } from "@/lib/sessao";

import { entrar } from "../acoes";
import { FormularioEntrada } from "../formulario";

/**
 * A porta de entrada — e a única página do sistema que precisa VENDER.
 *
 * O login continua no topo, ao lado do argumento, como sempre esteve: quem já
 * é cliente entra sem rolar nada. Para quem chegou por indicação a página
 * continua para baixo: como funciona (com a conta feita de verdade), o que o
 * sistema tem, os planos e as perguntas de quem está decidindo.
 */

/**
 * Três frases, e cada uma responde a uma dúvida diferente.
 *
 * Pedir nome, e-mail e senha sem dizer para quê é o jeito mais rápido de
 * perder alguém que chegou por indicação e ainda não viu o produto.
 */
const ARGUMENTOS = [
  {
    icone: Calculator,
    tom: "sol" as const,
    texto: "O preço sai das medidas, não da sua calculadora.",
  },
  {
    icone: FileText,
    tom: "mar" as const,
    texto: "O PDF vai para a indústria no formato que ela já conhece.",
  },
  {
    icone: ShieldCheck,
    tom: "menta" as const,
    texto: "Seus dados ficam isolados dos de qualquer outro escritório.",
  },
];

function Secao({
  id,
  rotulo,
  titulo,
  texto,
  children,
}: {
  id: string;
  rotulo: string;
  titulo: ReactNode;
  texto: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <Revelar className="max-w-2xl mb-10 sm:mb-14">
        <p className="rotulo text-carimbo">{rotulo}</p>
        <h2 className="mt-3 text-titulo font-extrabold text-tinta text-balance">{titulo}</h2>
        <p className="mt-4 text-realce text-tinta-2 leading-relaxed">{texto}</p>
      </Revelar>
      {children}
    </section>
  );
}

export default async function PaginaEntrar() {
  // Quem já está logado não tem o que fazer aqui.
  if (await sessaoAtual()) redirect("/");

  return (
    <Movimento>
      <div className="landing">
        <SemScriptRevela />
        <TopoEntrada completo />

        {/* ------------------------------------------------------------------ */}
        {/* Herói: o argumento e o login                                        */}
        {/* ------------------------------------------------------------------ */}
        <div
          className="w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-16 sm:pt-16 sm:pb-24
            grid items-center gap-10 lg:gap-16 lg:grid-cols-[1.1fr_minmax(0,25rem)]"
        >
          <section className="palco min-w-0">
            <p className="chip">Para representantes de embalagens plásticas</p>

            {/*
              O marca-texto amarelo, a única vez nesta tela.

              Cai em "sem recalcular nada" porque é essa a promessa: o resto da
              frase descreve o caminho, e só esse pedaço diz o que a pessoa
              deixa de fazer.
            */}
            <h1 className="mt-5 text-vitrine font-extrabold text-balance">
              Do pedido ao PDF, <span className="marcador">sem recalcular nada.</span>
            </h1>

            <p className="mt-5 text-realce text-tinta-2 leading-relaxed max-w-lg">
              Pedidos, produtos e comissões para representante de embalagens plásticas — num lugar
              só. O preço sai das medidas, o pedido vira PDF da indústria e a comissão se calcula
              sozinha.
            </p>

            <div className="mt-6">
              <FluxoAnimado />
            </div>

            {/*
              A lista some no celular.

              Ali a coluna do argumento fica EM CIMA do formulário, e três linhas
              a mais entre o topo e o campo de e-mail penalizam justo quem já é
              cliente e só quer entrar. O resto da página conta a mesma história
              com mais espaço.
            */}
            <ul className="hidden lg:flex flex-col gap-4 mt-9">
              {ARGUMENTOS.map(({ icone, tom, texto }) => (
                <li key={texto} className="flex items-center gap-3">
                  <Placa icone={icone} tom={tom} />
                  <span className="text-realce text-tinta-2 leading-snug">{texto}</span>
                </li>
              ))}
            </ul>
          </section>

          {/*
            `marcada` dá a esta folha o canto maior e a sombra alta: no herói ela
            é o único cartão, e é o que a levanta do fundo em vez de encostá-la.
          */}
          <div className="w-full min-w-0 surgir">
            <Cartao marcada className="px-6 py-8 sm:px-8 sm:py-9">
              <h2 className="text-forte font-bold tracking-[-0.025em] leading-none">Entrar</h2>
              <p className="text-corpo text-tinta-2 mt-2.5 mb-7 leading-relaxed">
                Seus pedidos, produtos e comissões do jeito que você deixou.
              </p>

              <FormularioEntrada acao={entrar} rotulo="Entrar" />

              <p className="text-corpo text-tinta-2 mt-7 text-center">
                Ainda não tem conta?{" "}
                <Link
                  href="/comecar"
                  className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
                >
                  Criar um escritório
                </Link>
              </p>
            </Cartao>
          </div>
        </div>

        <Secao
          id="como-funciona"
          rotulo="Como funciona"
          titulo="Do produto ao gráfico, sem digitar nada duas vezes"
          texto="Escolha saco, stretch ou fita, mexa nas medidas e acompanhe: o mesmo número vai do preço da unidade ao pedido, ao e-mail para a indústria, à sua comissão e aos gráficos."
        >
          <Revelar>
            <ComoFunciona />
          </Revelar>
        </Secao>

        <Secao
          id="recursos"
          rotulo="Recursos"
          titulo="Tudo o que a representação usa no dia a dia"
          texto="Feito em cima do sistema que escritórios de representação já usavam há anos — com as mesmas contas e o mesmo papel que a indústria recebe."
        >
          <Recursos />
        </Secao>

        <Secao
          id="planos"
          rotulo="Planos"
          titulo="Um preço justo para o tamanho do seu escritório"
          texto="Sem taxa de implantação e sem fidelidade. Comece sozinho no Solo ou traga seus prepostos no Max."
        >
          <CartoesPlanos />
        </Secao>

        <Secao
          id="perguntas"
          rotulo="Perguntas"
          titulo="Antes de assinar"
          texto="O que costumam perguntar antes de criar o escritório."
        >
          <Perguntas />
        </Secao>

        {/* ------------------------------------------------------------------ */}
        {/* Fechamento                                                          */}
        {/* ------------------------------------------------------------------ */}
        <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 pb-20">
          <Revelar>
            <div className="folha folha-marcada px-6 py-12 sm:px-12 sm:py-16 text-center">
              <h2 className="text-titulo font-extrabold text-tinta text-balance">
                Seu próximo pedido já pode sair daqui.
              </h2>
              <p className="mt-4 text-realce text-tinta-2 max-w-xl mx-auto">
                Crie o escritório, cadastre a primeira indústria e emita o pedido no mesmo dia.
              </p>
              <Link
                href="/comecar"
                className="group mt-8 inline-flex items-center gap-2 rounded-full bg-tinta text-papel px-6 py-3 text-realce font-semibold shadow-folha transition-all duration-200 hover:-translate-y-0.5 hover:shadow-alta"
              >
                Criar meu escritório
                <ArrowRight
                  size={17}
                  strokeWidth={2.25}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </Revelar>
          <p className="mt-10 text-center text-mini text-tinta-3">
            RepPlast · Sistema para representação comercial de embalagens plásticas
          </p>
        </section>
      </div>
    </Movimento>
  );
}
