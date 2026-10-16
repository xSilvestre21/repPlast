import Link from "next/link";
import type { ReactNode } from "react";

import { TopoEntrada } from "@/components/entrada/topo-entrada";
import { CONTROLADOR, VIGENCIA_TERMOS } from "@/lib/lgpd";

/**
 * A casca dos Termos de Uso e da Política de Privacidade: texto corrido numa
 * folha, largura de leitura, e o caminho de volta ao cadastro no fim.
 *
 * O cadastro abre estas páginas em outra aba, para quem lê não perder o que
 * já tinha preenchido.
 */
export function PaginaLegal({ titulo, resumo, children }: { titulo: string; resumo: string; children: ReactNode }) {
  return (
    <>
      <TopoEntrada />
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <p className="rotulo text-carimbo">Vigente desde {VIGENCIA_TERMOS}</p>
        <h1 className="mt-3 text-titulo font-extrabold text-tinta text-balance">{titulo}</h1>
        <p className="mt-4 text-realce text-tinta-2 leading-relaxed">{resumo}</p>

        <article className="folha mt-8 px-6 py-8 sm:px-10 sm:py-10">{children}</article>

        <p className="mt-8 text-corpo text-tinta-2 text-center">
          Dúvidas sobre os seus dados? Escreva para{" "}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo"
          >
            {CONTROLADOR.email}
          </a>
          .
        </p>
        <p className="mt-3 text-mini text-tinta-3 text-center">
          <Link href="/termos" className="underline underline-offset-4 hover:text-carimbo">
            Termos de Uso
          </Link>
          {" · "}
          <Link href="/privacidade" className="underline underline-offset-4 hover:text-carimbo">
            Política de Privacidade
          </Link>
        </p>
      </div>
    </>
  );
}

/** Uma seção numerada do texto. */
export function Clausula({ numero, titulo, children }: { numero: number; titulo: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-medio font-bold text-tinta">
        <span className="text-tinta-3 numerico mr-2">{numero}.</span>
        {titulo}
      </h2>
      <div className="mt-3 space-y-3 text-corpo text-tinta-2 leading-relaxed">{children}</div>
    </section>
  );
}

/** Lista com marcador, no corpo de uma cláusula. */
export function Itens({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 marker:text-tinta-3">{children}</ul>;
}
