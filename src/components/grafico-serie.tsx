import { serieTemporal, type PontoSerie } from "@/lib/grafico/geometria";
import { FORMATO, type Unidade } from "@/lib/grafico/formato";

import { GraficoCursor, type PontoInterativo } from "./grafico-cursor";

/**
 * Série mensal — a pergunta "estou crescendo?".
 *
 * É a que mais faltava: a tela de Comissões mostra um mês por vez, e um mês
 * por vez não responde nada sobre direção.
 *
 * O desenho é um `<svg>` com `preserveAspectRatio="none"`, então a caixa
 * estica para a largura que tiver sem ninguém medir nada. O que não pode
 * esticar junto — a espessura do traço — é segurado por
 * `vector-effect="non-scaling-stroke"`. É isso que deixa o gráfico responsivo
 * continuar sendo um Server Component: sem `ResizeObserver`, sem estado.
 *
 * A interação entra como uma camada SOBREPOSTA (`GraficoCursor`), não como uma
 * reescrita do gráfico: o SVG continua vindo pronto do servidor, e sem
 * JavaScript o desenho e a tabela de números seguem na tela.
 *
 * Os rótulos ficam FORA do SVG, em HTML: dentro dele esticariam junto com a
 * caixa e sairiam deformados em tela larga.
 */
export function GraficoSerie({
  pontos,
  series,
  unidade = "moeda",
}: {
  pontos: PontoSerie[];
  /** Uma entrada por série, na mesma ordem dos `valores` de cada ponto. */
  series: { rotulo: string; cor: string; preencher?: boolean }[];
  /**
   * O NOME da unidade, não a função de formatar.
   *
   * A camada interativa é um componente de cliente e precisa do texto já
   * pronto; uma função não atravessa essa fronteira ("Only plain objects...").
   */
  unidade?: Unidade;
}) {
  const { series: desenhadas, rotulos, maximo, grade } = serieTemporal(pontos);
  const formatar = FORMATO[unidade];

  if (pontos.length === 0) return null;

  /*
   * As coordenadas que a camada interativa usa JÁ foram calculadas por
   * `serieTemporal` — este componente as ignorava até agora. Nada é recalculado
   * aqui: recalcular seria a forma mais silenciosa de o cursor apontar para um
   * lugar e a linha estar em outro.
   */
  const interativos: PontoInterativo[] = pontos.map((ponto, i) => ({
    x: desenhadas[0]?.pontos[i]?.x ?? 0,
    titulo: ponto.titulo ?? ponto.rotulo,
    href: ponto.href,
    marcas: series.map((serie, s) => ({
      y: desenhadas[s]?.pontos[i]?.y ?? 100,
      texto: formatar(ponto.valores[s] ?? 0),
      rotulo: serie.rotulo,
      cor: serie.cor,
    })),
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
        {series.map((serie) => (
          <span key={serie.rotulo} className="flex items-center gap-1.5 text-mini text-tinta-2">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: serie.cor }}
            />
            {serie.rotulo}
          </span>
        ))}
        <span className="numerico text-mini text-tinta-3 ml-auto">
          Topo {formatar(maximo)}
        </span>
      </div>

      <div className="relative">
        {/* A grade é desenhada em HTML, não no SVG: um filete de 1px que
            esticasse com a caixa viraria um traço grosso em tela larga. */}
        <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
          {grade.map((linha) => (
            <div key={linha.y} className="regra" />
          ))}
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="relative w-full h-40 overflow-visible"
          role="img"
          aria-label={`Série de ${pontos.length} meses, de ${rotulos[0]} a ${rotulos[rotulos.length - 1]}`}
        >
          {desenhadas.map((desenhada, i) => (
            <g key={series[i]?.rotulo ?? i}>
              {series[i]?.preencher && (
                <path d={desenhada.area} fill={series[i].cor} opacity={0.12} />
              )}
              <path
                d={desenhada.linha}
                fill="none"
                stroke={series[i]?.cor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </svg>

        <GraficoCursor
          pontos={interativos}
          rotuloDaArea={`Comissão mês a mês — use as setas para percorrer os ${pontos.length} meses`}
        />
      </div>

      <div className="flex justify-between mt-2">
        {rotulos.map((rotulo) => (
          <span key={rotulo} className="text-micro text-tinta-3">
            {rotulo}
          </span>
        ))}
      </div>

      {/*
        A tabela é a versão que um leitor de tela consegue ler, e a que permite
        conferir número a número — o traço mostra a direção, não o valor.
      */}
      <details className="mt-4 pt-3 regra">
        <summary className="text-mini text-tinta-3 cursor-pointer hover:text-tinta">
          Ver os números
        </summary>
        <ul className="mt-3 space-y-1">
          {pontos.map((ponto) => (
            <li key={ponto.rotulo} className="flex justify-between gap-3 text-mini">
              <span className="text-tinta-2">{ponto.titulo ?? ponto.rotulo}</span>
              <span className="flex gap-4">
                {ponto.valores.map((valor, i) => (
                  <span key={i} className="numerico text-tinta" style={{ color: series[i]?.cor }}>
                    {formatar(valor)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
