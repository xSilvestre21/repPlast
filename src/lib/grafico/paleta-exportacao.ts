/**
 * A paleta dos arquivos que SAEM do sistema.
 *
 * Aqui os valores são literais, e é a exceção deliberada à regra de "nada de
 * hex em código". A regra existe porque uma cor escrita à mão numa tela fica
 * presa no tema claro para sempre — mas estes arquivos não têm tema: o PDF é
 * papel, e o HTML autocontido abre no computador de quem recebeu, sem a folha
 * de estilo do aplicativo por perto. Ler `var(--token)` ali não resolveria
 * nada; simplesmente não haveria token.
 *
 * O PDF do pedido já faz isso pelo mesmo motivo (`documento-pedido.tsx`).
 *
 * Os valores são os do TEMA CLARO de `globals.css`. Se a paleta da tela mudar,
 * o pior que acontece aqui é o relatório ficar com a cor antiga — não um
 * número errado. É a razão de esta cópia ser aceitável.
 */

export const EXPORTACAO = {
  papel: "#fbfbfc",
  folha: "#ffffff",
  folha2: "#f4f4f7",
  filete: "#e6e6ea",
  filiteForte: "#d3d3da",

  tinta: "#111117",
  tinta2: "#5a5a68",
  tinta3: "#6f6f7e",

  serie: "#6d54d6",
  verde: "#0f9d70",
  perigo: "#e0484d",
  mar: "#2f6fed",
  sol: "#b97f0c",
  pessego: "#d9652f",

  /** As placas de ícone: o fundo lavado e o traço saturado por cima. */
  placas: {
    sol: { fundo: "#fff2d0", traco: "#b97f0c" },
    mar: { fundo: "#e2edff", traco: "#2f6fed" },
    menta: { fundo: "#dcf6ec", traco: "#0b8a61" },
    pessego: { fundo: "#ffe7db", traco: "#d9652f" },
    lilas: { fundo: "#ece7ff", traco: "#6d54d6" },
    neutro: { fundo: "#f4f4f7", traco: "#5a5a68" },
  },

  /** O campo de luz atrás do topo. */
  aurora: ["#fdeaa8", "#cfe4ff", "#d5f6e4", "#ffdcc6"],
} as const;

export type TomPlaca = keyof typeof EXPORTACAO.placas;

/**
 * Traduz um token da paleta da tela para o valor do arquivo exportado.
 *
 * Existe para o PDF e o HTML conseguirem reaproveitar as MESMAS listas de
 * dados que a tela usa — onde a cor vem como `var(--verde)` —, sem cada um
 * carregar o próprio mapa e sem a cor mudar de significado no caminho.
 */
export function corExportada(valor: string): string {
  const mapa: Record<string, string> = {
    "var(--tinta)": EXPORTACAO.tinta,
    "var(--tinta-2)": EXPORTACAO.tinta2,
    "var(--tinta-3)": EXPORTACAO.tinta3,
    "var(--verde)": EXPORTACAO.verde,
    "var(--perigo)": EXPORTACAO.perigo,
    "var(--placa-lilas-traco)": EXPORTACAO.serie,
    "var(--placa-mar-traco)": EXPORTACAO.mar,
    "var(--placa-sol-traco)": EXPORTACAO.sol,
    "var(--placa-pessego-traco)": EXPORTACAO.pessego,
    "var(--placa-menta-traco)": EXPORTACAO.verde,
  };

  return mapa[valor] ?? valor;
}
