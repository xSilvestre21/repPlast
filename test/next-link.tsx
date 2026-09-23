/**
 * Substituto do `next/link` nos testes de navegador.
 *
 * O pacote real conta com o `process` do Node, que não existe num navegador, e
 * estoura na importação. Chega aqui de carona: `selecao-buscavel.tsx` importa
 * rótulo e classes de `ui.tsx`, e é `ui.tsx` que usa Link.
 *
 * Uma âncora dá conta: nada do que estes testes medem depende do roteador — e
 * o que o Link tem de próprio, a navegação de cliente, é do Next e não nosso.
 */

import type { AnchorHTMLAttributes, ReactNode } from "react";

export default function Link({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
