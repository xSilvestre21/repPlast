import Link from "next/link";
import { Calculator, FileText, ShieldCheck } from "lucide-react";

import { AlternadorTema } from "@/components/alternador-tema";
import { Placa } from "@/components/ui";

/**
 * Telas de entrada: login e cadastro.
 *
 * Sem navegação — quem está aqui ainda não tem para onde navegar. É a única
 * tela do sistema que precisa VENDER, e por isso é a única construída como
 * página de destino: argumento à esquerda, formulário à direita, e o campo de
 * luz do topo mais presente do que em qualquer outro lugar.
 *
 * O argumento mora AQUI, e não dentro de cada página, por dois motivos: ele
 * vale igual para quem volta e para quem chega, e escrito uma vez só ele não
 * tem como divergir entre as duas telas.
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

export default function LayoutEntrada({ children }: LayoutProps<"/">) {
  return (
    <main className="flex-1 w-full">
      {/* O alternador fica no canto, fora da coluna: é ferramenta, não conteúdo. */}
      <div className="fixed top-3 right-3 z-10">
        <AlternadorTema />
      </div>

      <div
        className="w-full max-w-5xl mx-auto px-5 py-12 sm:py-16
          grid items-center gap-10 lg:gap-16
          lg:grid-cols-[1.05fr_minmax(0,25rem)] lg:min-h-dvh"
      >
        {/* ---------------------------------------------------------------- */}
        {/* O argumento                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="palco min-w-0">
          <Link
            href="/"
            className="inline-block text-xl font-extrabold tracking-[-0.03em]
              transition-colors hover:text-carimbo"
          >
            RepPlast
          </Link>

          {/*
            O marca-texto amarelo, a única vez nesta tela.

            Cai em "sem recalcular nada" porque é essa a promessa: o resto da
            frase descreve o caminho, e só esse pedaço diz o que a pessoa
            deixa de fazer.
          */}
          <h1
            className="mt-5 text-[2.25rem] sm:text-[3rem] lg:text-[3.5rem]
              font-extrabold tracking-[-0.04em] leading-[1.14]"
          >
            Do pedido ao PDF,{" "}
            <span className="marcador">sem recalcular nada.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-tinta-2 leading-relaxed max-w-lg">
            Pedidos, produtos e comissões para representante de embalagens
            plásticas — num lugar só.
          </p>

          {/*
            A lista some no celular.

            Ali a coluna do argumento fica EM CIMA do formulário, e três linhas
            a mais entre o topo e o campo de e-mail penalizam justo quem já é
            cliente e só quer entrar. O título e a linha de apoio ficam: são
            duas frases, e dizem o necessário.
          */}
          <ul className="hidden lg:flex flex-col gap-4 mt-10">
            {ARGUMENTOS.map(({ icone, tom, texto }) => (
              <li key={texto} className="flex items-center gap-3.5">
                <Placa icone={icone} tom={tom} />
                <span className="text-[0.9375rem] text-tinta-2 leading-snug">{texto}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* O formulário                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="w-full min-w-0 surgir">{children}</div>
      </div>
    </main>
  );
}
