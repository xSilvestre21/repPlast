"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import { chegarPagina } from "./viagem";

/*
 * Voltar e avançar do navegador: a página que monta depois de um `popstate`
 * é uma que a pessoa já viu, e o Next devolve a rolagem de onde ela estava.
 * Marcado aqui, uma vez, e consumido pelo `Pagina` que montar em seguida.
 */
let voltouPeloHistorico = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    voltouPeloHistorico = true;
  });
}

/** O topo, na hora: sem a rolagem suave que alguma página tenha pedido. */
function irAoTopo() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

/**
 * Envelope de conteúdo de página.
 *
 * Precisa ficar em cada `page.tsx` (e no `loading.tsx`), e não no layout:
 * layout persiste entre navegações, e a entrada só acontece no que MONTA. É o
 * preço de ter a barra do topo parada enquanto o conteúdo troca.
 *
 * Depois de um clique numa aba, a primeira página a montar entra deslizando
 * pelo lado da aba (`chegarPagina`, em `viagem.ts`). Sem clique — a primeira
 * carga, o botão de voltar, um `router.refresh()` — ela só aparece. Nenhuma
 * transição deste sistema ganha movimento vertical.
 *
 * E chega sempre no topo. O Next só rola ao trocar de página quando o começo
 * da nova está fora da tela — vindo de uma página rolada um pouco, a nova
 * abria rolada também, com o título colado no cabeçalho. Duas vezes: agora, e
 * um quadro depois, porque o ajuste de rolagem do Next roda depois deste e o
 * desfaria; e mais uma, se o menu que trouxe até aqui ainda estiver fechando.
 * Voltando pelo histórico, ou indo a uma âncora (`#`), não: ali a posição é a
 * que a pessoa espera reencontrar.
 */
export function Pagina({ children }: { children: ReactNode }) {
  const pagina = useRef<HTMLDivElement>(null);

  // De layout, antes da pintura: o primeiro quadro da página nova já é o do
  // começo da entrada, e não um piscar dela no lugar final.
  useLayoutEffect(() => {
    if (pagina.current) chegarPagina(pagina.current);

    if (voltouPeloHistorico) {
      voltouPeloHistorico = false;
      return;
    }
    if (window.location.hash) return;
    irAoTopo();
    const quadro = requestAnimationFrame(irAoTopo);

    /*
     * Chegando pelo menu do celular, a gaveta ainda está saindo (meio
     * segundo), e com ela aberta a rolagem da página fica travada
     * (`html:has(dialog:modal)`). Nesse estado o Safari do iPhone ignora o
     * pedido de ir ao topo — ou o guarda e devolve a posição antiga ao
     * destravar —, e a página nova abria rolada. Então, de novo, quando a
     * janela fecha.
     */
    const janela = document.querySelector("dialog[open]");
    const aoFechar = () => requestAnimationFrame(irAoTopo);
    janela?.addEventListener("close", aoFechar, { once: true });

    return () => {
      cancelAnimationFrame(quadro);
      janela?.removeEventListener("close", aoFechar);
    };
  }, []);

  return <div ref={pagina}>{children}</div>;
}
