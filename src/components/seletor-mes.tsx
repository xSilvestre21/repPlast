"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const MES_LONGO = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

/** "jan", "fev"… — sem o ponto de abreviação, que numa grade é só ruído. */
const MESES = Array.from({ length: 12 }, (_, i) => {
  const data = new Date(Date.UTC(2000, i, 1));
  return {
    curto: MES_CURTO.format(data).replace(".", ""),
    longo: MES_LONGO.format(data),
  };
});

function competencia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/**
 * O nome do mês que abre a grade do ano inteiro.
 *
 * As setas do `NavegadorMes` andam de um em um, e conferir algo de um ano
 * atrás custava doze idas ao servidor. Aqui são dois cliques: o ano, sem sair
 * da página, e o mês, que é um link de verdade.
 *
 * Não recebe a função `href` do navegador — função não atravessa do servidor
 * para o cliente. Recebe o endereço já montado com um `marcador` no lugar do
 * mês, e só troca o marcador; os outros parâmetros que a página guarda na URL
 * vêm junto, intactos.
 *
 * As contas são de string, de propósito: `lib/comissao` traria o `decimal.js`
 * para o navegador (ver `navegador-mes.tsx`).
 *
 * Abre e fecha como o `MenuUsuario` em `navegacao.tsx`: clique fora, Escape ou
 * escolher um mês.
 */
export function SeletorMes({
  atual,
  hoje,
  rotulo,
  modelo,
  marcador,
  destaques = [],
  rotuloDestaque = "",
}: {
  /** "AAAA-MM" aberto na página. */
  atual: string;
  /** "AAAA-MM" de hoje, calculado no servidor — o relógio do navegador pode discordar. */
  hoje: string;
  /** "Outubro de 2026", já formatado pelo servidor. */
  rotulo: string;
  /** O endereço com `marcador` no lugar de "AAAA-MM". */
  modelo: string;
  marcador: string;
  /** Meses com o ponto verde — na tela de comissões, os de meta batida. */
  destaques?: string[];
  rotuloDestaque?: string;
}) {
  const [anoAtual] = atual.split("-").map(Number);
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(anoAtual);
  const painelId = useId();
  const raizRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (!raizRef.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const endereco = (mes: string) => modelo.replace(marcador, mes);

  return (
    <div ref={raizRef} className="relative">
      <button
        type="button"
        onClick={() => {
          // Reabrir sempre no ano do mês aberto, e não onde a pessoa parou de
          // folhear da última vez sem escolher nada.
          if (!aberto) setAno(anoAtual);
          setAberto((a) => !a);
        }}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={painelId}
        className="inline-flex items-center justify-center gap-1.5 min-w-52 rounded-full px-3 py-1
          text-medio font-semibold cursor-pointer transition-colors hover:bg-folha-2"
      >
        {rotulo}
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden="true"
          className={`text-tinta-3 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div
          id={painelId}
          role="dialog"
          aria-label="Escolher mês"
          className="folha absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Ano anterior"
              onClick={() => setAno((a) => a - 1)}
              className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta cursor-pointer"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="text-corpo font-semibold text-tinta numerico" aria-live="polite">
              {ano}
            </span>
            <button
              type="button"
              aria-label="Próximo ano"
              onClick={() => setAno((a) => a + 1)}
              className="rounded-miudo p-1.5 text-tinta-2 transition-colors hover:bg-folha-2 hover:text-tinta cursor-pointer"
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {MESES.map(({ curto, longo }, i) => {
              const mes = competencia(ano, i + 1);
              const escolhido = mes === atual;
              const ehHoje = mes === hoje;
              const destacado = destaques.includes(mes);

              return (
                <Link
                  key={mes}
                  href={endereco(mes)}
                  onClick={() => setAberto(false)}
                  aria-label={`${longo} de ${ano}${destacado ? `, ${rotuloDestaque}` : ""}`}
                  aria-current={escolhido ? "page" : undefined}
                  className={`relative flex h-9 items-center justify-center rounded-full text-corpo transition-colors
                    outline-none focus-visible:ring-2 focus-visible:ring-carimbo ${
                      escolhido
                        ? "bg-carimbo font-semibold text-folha"
                        : `text-tinta hover:bg-folha-2 ${
                            ehHoje ? "font-semibold text-carimbo ring-1 ring-inset ring-carimbo" : ""
                          }`
                    }`}
                >
                  {curto}
                  {/* O ponto sob o nome, como o feriado no calendário de
                      `campo-data.tsx`. Sobre o mês escolhido ele fica claro,
                      para não sumir no fundo azul. */}
                  {destacado && (
                    <span
                      aria-hidden="true"
                      className={`absolute bottom-1 h-1 w-1 rounded-full ${
                        escolhido ? "bg-folha" : "bg-verde"
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {atual !== hoje && (
            <div className="mt-2 border-t border-filete pt-2 text-center">
              <Link
                href={endereco(hoje)}
                onClick={() => setAberto(false)}
                className="text-mini font-medium text-tinta-2 transition-colors hover:text-carimbo"
              >
                Ir para o mês atual
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
