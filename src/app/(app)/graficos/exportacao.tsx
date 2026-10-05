"use client";

/**
 * Os botões de exportação da tela de gráficos.
 *
 * Do lado do cliente porque o período vem dos CARTÕES, que o gravam na URL
 * sem navegar (`useParametro`): montados no servidor, os links ficavam com a
 * URL do carregamento — trocava-se o mês a mês para 6 meses e o botão
 * continuava exportando outra janela. Aqui eles leem a URL de agora.
 */

import { FileDown, Sheet } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { BotaoLink } from "@/components/ui";

/**
 * O relatório tem uma janela só, a do mês a mês (6, 12 ou 24 meses, padrão
 * 12). Ele aceita até 12 (`exportar/parametros.ts`): 24 sai com os 12 últimos.
 */
function janelaDoMensal(valor: string | null): number {
  const meses = Number(valor ?? "12");
  return [6, 12, 24].includes(meses) ? Math.min(meses, 12) : 12;
}

const CORTES = [30, 60, 90, 180];

/** A janela do mês a mês e o corte dos sumidos, como a tela está agora. */
function useDoRelatorio() {
  const busca = useSearchParams();
  const dias = Number(busca.get("sum_dias"));
  return {
    janela: janelaDoMensal(busca.get("mes_periodo")),
    dias: CORTES.includes(dias) ? dias : 60,
  };
}

export function BotoesExportacao({ competencia }: { competencia: string }) {
  const { janela, dias } = useDoRelatorio();

  const relatorio = (formato: "pdf" | "html") =>
    `/graficos/exportar/${formato}?mes=${competencia}&meses=${janela}&dias=${dias}`;

  /*
   * O CSV leva os PEDIDOS, não o gráfico: todo cartão desta aba é uma soma
   * dessas linhas, então quem as tem no Excel refaz qualquer um deles — e
   * também os cruzamentos que a tela não mostra.
   */
  const csv = (escopo: "mes" | "janela") =>
    `/graficos/exportar/csv?mes=${competencia}&escopo=${escopo}&meses=${janela}`;

  return (
    <div className="flex flex-wrap gap-2 items-start">
      <BotaoLink href={relatorio("pdf")} target="_blank" variante="secundaria" icone={FileDown}>
        Relatório PDF
      </BotaoLink>
      <BotaoLink href={csv("mes")} target="_blank" variante="secundaria" icone={Sheet}>
        CSV do mês
      </BotaoLink>
      <BotaoLink href={csv("janela")} target="_blank" variante="secundaria" icone={Sheet}>
        CSV de {janela} meses
      </BotaoLink>
    </div>
  );
}

/** O link do relatório em HTML, no pé da página — a mesma janela dos botões. */
export function LinkRelatorioHtml({ competencia }: { competencia: string }) {
  const { janela, dias } = useDoRelatorio();

  return (
    <a
      href={`/graficos/exportar/html?mes=${competencia}&meses=${janela}&dias=${dias}`}
      target="_blank"
      className="hover:text-carimbo"
    >
      Baixar o relatório como um arquivo HTML que abre sozinho
    </a>
  );
}
