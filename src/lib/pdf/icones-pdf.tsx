/**
 * Os ícones das placas, no PDF.
 *
 * São os MESMOS da tela (Lucide, licença ISC), copiados como dado: o
 * `lucide-react` desenha em SVG do DOM, que o react-pdf não entende, e o
 * caminho de cada ícone dentro do pacote não é exportação pública — um
 * import profundo quebraria na próxima versão sem aviso. Só os que o
 * relatório usa; o desenho é a grade 24×24 do Lucide, traço 2, ponta redonda.
 */

import { Circle, Line, Path, Svg } from "@react-pdf/renderer";

type Traco =
  | { tipo: "path"; d: string }
  | { tipo: "circle"; cx: number; cy: number; r: number }
  | { tipo: "line"; x1: number; y1: number; x2: number; y2: number };

const ICONES = {
  // Users
  clientes: [
    { tipo: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
    { tipo: "path", d: "M16 3.128a4 4 0 0 1 0 7.744" },
    { tipo: "path", d: "M22 21v-2a4 4 0 0 0-3-3.87" },
    { tipo: "circle", cx: 9, cy: 7, r: 4 },
  ],
  // Factory
  industria: [
    { tipo: "path", d: "M12 16h.01" },
    { tipo: "path", d: "M16 16h.01" },
    {
      tipo: "path",
      d: "M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z",
    },
    { tipo: "path", d: "M8 16h.01" },
  ],
  // UserRound
  preposto: [
    { tipo: "circle", cx: 12, cy: 8, r: 5 },
    { tipo: "path", d: "M20 21a8 8 0 0 0-16 0" },
  ],
  // CircleX
  cancelado: [
    { tipo: "circle", cx: 12, cy: 12, r: 10 },
    { tipo: "path", d: "m15 9-6 6" },
    { tipo: "path", d: "m9 9 6 6" },
  ],
  // TrendingUp
  tendencia: [
    { tipo: "path", d: "M16 7h6v6" },
    { tipo: "path", d: "m22 7-8.5 8.5-5-5L2 17" },
  ],
  // FileCheck
  orcamento: [
    {
      tipo: "path",
      d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
    },
    { tipo: "path", d: "M14 2v5a1 1 0 0 0 1 1h5" },
    { tipo: "path", d: "m9 15 2 2 4-4" },
  ],
  // Truck
  entrega: [
    { tipo: "path", d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" },
    { tipo: "path", d: "M15 18H9" },
    { tipo: "path", d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" },
    { tipo: "circle", cx: 17, cy: 18, r: 2 },
    { tipo: "circle", cx: 7, cy: 18, r: 2 },
  ],
  // UserMinus
  sumido: [
    { tipo: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
    { tipo: "circle", cx: 9, cy: 7, r: 4 },
    { tipo: "line", x1: 22, y1: 11, x2: 16, y2: 11 },
  ],
} satisfies Record<string, Traco[]>;

export type NomeIcone = keyof typeof ICONES;

export function IconePdf({ nome, cor, tamanho }: { nome: NomeIcone; cor: string; tamanho: number }) {
  const comum = {
    stroke: cor,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  } as const;

  return (
    <Svg viewBox="0 0 24 24" width={tamanho} height={tamanho}>
      {(ICONES[nome] as Traco[]).map((traco, i) =>
        traco.tipo === "path" ? (
          <Path key={i} d={traco.d} {...comum} />
        ) : traco.tipo === "circle" ? (
          <Circle key={i} cx={traco.cx} cy={traco.cy} r={traco.r} {...comum} />
        ) : (
          <Line key={i} x1={traco.x1} y1={traco.y1} x2={traco.x2} y2={traco.y2} {...comum} />
        ),
      )}
    </Svg>
  );
}
