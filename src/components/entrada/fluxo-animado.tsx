"use client";

/**
 * A faixa do herói: as seis etapas acendendo uma depois da outra, em laço.
 *
 * É o resumo do produto em uma linha, e o movimento é o que diz que elas são
 * um CAMINHO e não uma lista de recursos. Um clique leva à seção "Como
 * funciona", onde cada etapa se explica.
 *
 * Só CSS: a pastilha acesa troca de cor por transição. Ela deslizava de uma
 * etapa à outra com `layoutId` do motion, que exige o pacote de animação de
 * layout inteiro só para isto.
 *
 * O relógio para quando a faixa sai da tela ou a aba fica em segundo plano —
 * nada animando onde ninguém está olhando.
 */

import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const PASSOS = ["Produto", "Preço", "Pedido", "PDF", "Comissão", "Gráficos"];
const INTERVALO_MS = 1400;

export function FluxoAnimado() {
  const [aceso, setAceso] = useState(0);
  const faixa = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (document.documentElement.dataset.animacoes === "desativadas") return;
    const elemento = faixa.current;
    if (!elemento) return;

    let visivel = true;
    let relogio: ReturnType<typeof setInterval> | undefined;

    function acertar() {
      const rodar = visivel && document.visibilityState === "visible";
      if (rodar && !relogio) {
        relogio = setInterval(() => setAceso((atual) => (atual + 1) % PASSOS.length), INTERVALO_MS);
      } else if (!rodar && relogio) {
        clearInterval(relogio);
        relogio = undefined;
      }
    }

    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
      acertar();
    });
    observador.observe(elemento);
    document.addEventListener("visibilitychange", acertar);
    acertar();

    return () => {
      observador.disconnect();
      document.removeEventListener("visibilitychange", acertar);
      if (relogio) clearInterval(relogio);
    };
  }, []);

  return (
    <a
      ref={faixa}
      href="#como-funciona"
      className="group inline-flex flex-wrap items-center gap-1.5 rounded-[var(--radius-folha)] bg-folha/70 border border-filete px-2 py-2 shadow-suave"
    >
      {/*
        O nome do link é o próprio texto das etapas, mais o complemento só
        para leitor de tela. Um `aria-label` diferente do texto visível quebra
        o comando de voz ("clicar em Produto") — o Lighthouse aponta isso.
      */}
      {PASSOS.map((passo, i) => (
        <span key={passo} className="inline-flex items-center gap-1.5">
          <span
            className={`px-2.5 py-1 rounded-full text-mini font-semibold transition-colors duration-300 ${
              i === aceso ? "bg-tinta text-papel" : "text-tinta-2"
            }`}
          >
            {passo}
          </span>
          {i < PASSOS.length - 1 && (
            <ArrowRight size={12} strokeWidth={2.25} className="text-tinta-3" aria-hidden="true" />
          )}
        </span>
      ))}
      <span className="sr-only"> — ver como funciona</span>
    </a>
  );
}
