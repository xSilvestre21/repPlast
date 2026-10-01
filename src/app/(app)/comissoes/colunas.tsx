import type { ColunaTabela } from "@/components/ui";

/**
 * As colunas da apuração, na ordem das células de `LinhaComissao`.
 *
 * Larguras fixas nos números: é o que põe a coluna de reais no mesmo x em
 * todas as indústrias do mês, e não só dentro de cada tabela. O `%` só existe
 * para o administrador — o percentual da indústria é conta dele.
 *
 * Arquivo próprio, sem `'use client'`, porque os dois lados chamam: a página
 * monta o cabeçalho e o total, a linha conta as colunas para o `colSpan`.
 * Exportada de `acerto.tsx`, chegaria à página como referência de cliente.
 */
export function colunasDaComissao(comPercentual: boolean): ColunaTabela[] {
  return [
    { rotulo: "Pedido", largura: "w-20" },
    { rotulo: "Cliente" },
    { rotulo: "Prazo", alinhamento: "numero", largura: "w-24" },
    { rotulo: "Entregue", alinhamento: "numero", largura: "w-36" },
    ...(comPercentual ? [{ rotulo: "%", alinhamento: "numero" as const, largura: "w-14" }] : []),
    { rotulo: "Previsto", alinhamento: "numero", largura: "w-32" },
    { rotulo: "Recebido", alinhamento: "numero", largura: "w-32" },
    { rotulo: "Diferença", alinhamento: "numero", largura: "w-28" },
    { rotulo: <span className="sr-only">Acerto</span>, alinhamento: "acao", largura: "w-28" },
  ];
}
