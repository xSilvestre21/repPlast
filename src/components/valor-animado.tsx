"use client";

import { useEffect, useRef } from "react";

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const DURACAO_MS = 900;

/** Desacelera no fim: o número "chega" em vez de parar de repente. */
function suavizar(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Valor em reais que sobe de zero até o total ao aparecer.
 *
 * O HTML já nasce com o **valor final** — quem não tem JavaScript, quem usa
 * leitor de tela e quem pediu menos movimento leem o número certo, e a
 * contagem é só um enfeite por cima.
 *
 * A contagem escreve direto no nó, sem estado: são ~54 quadros por execução, e
 * cada um viraria uma re-renderização do React à toa.
 */
export function ValorAnimado({
  valor,
  className = "",
}: {
  valor: number;
  className?: string;
}) {
  const alvo = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;

    // A fonte da verdade é a preferência de conta, não a do sistema
    // operacional — ver `data-animacoes` em `src/app/layout.tsx`.
    if (document.documentElement.dataset.animacoes === "desativadas") return;
    // Contar de zero até zero é uma animação que não comunica nada.
    if (!Number.isFinite(valor) || valor === 0) return;

    let quadro = 0;
    const inicio = performance.now();

    function passo(agora: number) {
      const progresso = Math.min((agora - inicio) / DURACAO_MS, 1);
      elemento!.textContent = MOEDA.format(valor * suavizar(progresso));

      if (progresso < 1) {
        quadro = requestAnimationFrame(passo);
      }
    }

    quadro = requestAnimationFrame(passo);

    return () => {
      cancelAnimationFrame(quadro);
      // Interrompida no meio (troca de rota, novo valor), a contagem não pode
      // deixar um número parcial na tela.
      elemento.textContent = MOEDA.format(valor);
    };
  }, [valor]);

  return (
    <span ref={alvo} className={className}>
      {MOEDA.format(valor)}
    </span>
  );
}
