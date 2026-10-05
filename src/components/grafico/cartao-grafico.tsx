"use client";

/**
 * A moldura dos cartões de gráfico: título, os controles DO PRÓPRIO cartão e
 * o gráfico.
 *
 * Os controles moram dentro do cartão que eles mudam — o período do mês a mês
 * fica no mês a mês, e não num cabeçalho da página que mexe em metade dos
 * gráficos sem dizer quais. Foi o pedido do usuário, e é por isso que esta
 * página foge da recomendação geral de uma barra de filtros única.
 *
 * Dois botões no canto: tela cheia (o mapa de calor e o mês a mês ganham muito
 * com espaço) e baixar a imagem — o PNG sai do próprio canvas do ECharts, com
 * o fundo do cartão, então é o gráfico exatamente como está na tela.
 */

import { Download, Maximize2, Minimize2, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as echarts from "echarts/core";

import { Cartao, EstadoVazio, Placa } from "@/components/ui";

import { useTemaGrafico } from "./use-tema-grafico";

type Tom = "sol" | "mar" | "menta" | "pessego" | "lilas" | "neutro";

export function CartaoGrafico({
  titulo,
  subtitulo,
  icone,
  tom = "neutro",
  controles,
  vazio,
  rodape,
  className = "",
  children,
}: {
  titulo: string;
  /** O período que está sendo mostrado — muda junto com o seletor. */
  subtitulo?: ReactNode;
  icone: LucideIcon;
  tom?: Tom;
  /** Os seletores do cartão: visão, período, métrica. */
  controles?: ReactNode;
  /** No lugar do gráfico, quando não há o que desenhar. */
  vazio?: string | null;
  rodape?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [cheia, setCheia] = useState(false);
  const corpo = useRef<HTMLDivElement>(null);
  const cores = useTemaGrafico();

  // Esc fecha a tela cheia, como qualquer sobreposição.
  useEffect(() => {
    if (!cheia) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setCheia(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [cheia]);

  function baixar() {
    const elemento = corpo.current?.querySelector<HTMLElement>("[data-grafico]");
    const instancia = elemento ? echarts.getInstanceByDom(elemento) : undefined;
    if (!instancia) return;

    const link = document.createElement("a");
    link.href = instancia.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: cores.folha });
    link.download = `${titulo.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.click();
  }

  const BOTAO =
    "grid place-items-center size-8 rounded-full text-tinta-3 hover:text-tinta hover:bg-folha-2 " +
    "transition-colors cursor-pointer";

  return (
    <>
      {/* O fundo da tela cheia: clicar fora fecha. */}
      {cheia && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setCheia(false)}
          aria-hidden="true"
        />
      )}

      <Cartao
        className={`p-5 sm:p-6 flex flex-col min-w-0 ${
          cheia ? "fixed inset-3 sm:inset-8 z-50 overflow-auto" : ""
        } ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="titulo-regra">
              <Placa icone={icone} tom={tom} pequena />
              <h2 className="text-realce font-semibold text-tinta">{titulo}</h2>
            </div>
            {subtitulo && <p className="text-mini text-tinta-3 mt-1.5">{subtitulo}</p>}
          </div>

          <div className="shrink-0 flex items-center gap-0.5">
            {!vazio && (
              <button type="button" onClick={baixar} className={BOTAO} aria-label="Baixar imagem">
                <Download size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCheia((c) => !c)}
              className={BOTAO}
              aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}
              aria-pressed={cheia}
            >
              {cheia ? (
                <Minimize2 size={15} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Maximize2 size={15} strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {controles && <div className="flex flex-wrap items-center gap-2 mt-4">{controles}</div>}

        {/*
          Coluna flex que passa a sobra adiante: ao lado de um cartão mais
          alto, o grid estica este, e o gráfico (`flex-1` em `Grafico`) cresce
          junto — em vez de deixar um vão vazio no pé do cartão.
        */}
        <div ref={corpo} className="flex-1 flex flex-col mt-5 min-w-0">
          {vazio ? (
            <div className="flex-1 grid place-items-center">
              <EstadoVazio discreto>{vazio}</EstadoVazio>
            </div>
          ) : (
            children
          )}
        </div>

        {rodape && !vazio && <div className="mt-4">{rodape}</div>}
      </Cartao>
    </>
  );
}
