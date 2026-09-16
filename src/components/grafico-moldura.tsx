import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Cartao, EstadoVazio, Placa } from "./ui";

/**
 * A casca de um gráfico: título, legenda do período, ação e o desenho.
 *
 * Existe para que os nove gráficos da aba não escrevam nove cabeçalhos
 * ligeiramente diferentes — foi assim que as telas antigas acumularam cinco
 * receitas para a mesma coisa.
 *
 * O período fica no cabeçalho de cada gráfico, e não só no topo da página, por
 * causa do download: a imagem sai do contexto da tela e precisa dizer sozinha
 * de que mês ela fala.
 */
export function GraficoMoldura({
  titulo,
  periodo,
  icone,
  tom = "neutro",
  acao,
  baixar,
  vazio,
  children,
}: {
  titulo: string;
  /** "Setembro de 2026", "Últimos 90 dias" — a legenda que viaja com a imagem. */
  periodo?: string;
  icone?: LucideIcon;
  tom?: "sol" | "mar" | "menta" | "pessego" | "lilas" | "neutro";
  /** Canto superior direito: "ver todos", troca de janela. */
  acao?: ReactNode;
  /**
   * O botao de baixar. Separado de `acao` porque so aparece quando ha o que
   * desenhar: oferecer download de um cartao vazio entrega um PNG em branco.
   */
  baixar?: ReactNode;
  /** Mostrado no lugar do gráfico quando não há o que desenhar. */
  vazio?: string;
  children: ReactNode;
}) {
  return (
    <Cartao className="p-5 sm:p-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <div className="titulo-regra">
            {icone && <Placa icone={icone} tom={tom} pequena />}
            <h2 className="text-realce font-semibold text-tinta">{titulo}</h2>
          </div>
          {periodo && <p className="text-mini text-tinta-3 mt-1.5">{periodo}</p>}
        </div>
        {(acao || (baixar && !vazio)) && (
          <div className="shrink-0 flex items-center gap-1">
            {acao}
            {!vazio && baixar}
          </div>
        )}
      </div>

      <div className="flex-1">
        {vazio ? (
          <EstadoVazio discreto>{vazio}</EstadoVazio>
        ) : (
          children
        )}
      </div>
    </Cartao>
  );
}
