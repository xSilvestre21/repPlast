import { fatias, type ItemBarra } from "@/lib/grafico/geometria";

/**
 * Rosca — composição de poucas partes.
 *
 * Só serve quando as fatias são três ou quatro e somam um todo com sentido
 * ("dos pedidos entregues, quantos no prazo"). Para ranking é a forma errada:
 * o olho compara comprimento muito melhor do que ângulo, e com dez fatias ela
 * vira exatamente a pizza ilegível que este projeto está corrigindo. Ranking
 * usa `GraficoBarras`.
 *
 * As fatias são traços sobre um círculo, e não caminhos de arco. Com arco, uma
 * fatia de 100% tem ponto inicial e final no mesmo lugar e some da tela; com
 * `stroke-dasharray` ela é só um traço do tamanho da volta.
 */

/** O círculo tem raio 15,9155 para a circunferência dar exatamente 100. */
const RAIO = 15.91549431;

export function GraficoRosca({
  itens,
  centro,
  detalheDoCentro,
}: {
  /**
   * A cor viaja NO item, nunca num array paralelo: fatia de valor zero some da
   * lista, e uma cor escolhida por posição escorregaria para a fatia seguinte.
   */
  itens: (ItemBarra & { cor: string })[];
  /** O número que vai no buraco — a leitura principal do gráfico. */
  centro: string;
  detalheDoCentro?: string;
}) {
  const { fatias: partes, total } = fatias(itens);

  if (partes.length === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0">
        <svg viewBox="0 0 42 42" className="size-36" role="img" aria-label={centro}>
          <circle
            cx="21"
            cy="21"
            r={RAIO}
            fill="none"
            stroke="var(--folha-2)"
            strokeWidth={5}
          />
          {partes.map((parte) => (
            <circle
              key={parte.chave}
              cx="21"
              cy="21"
              r={RAIO}
              fill="none"
              stroke={parte.cor}
              strokeWidth={5}
              strokeDasharray={`${parte.traco} ${100 - parte.traco}`}
              // Começa no topo e anda no sentido do relógio.
              strokeDashoffset={25 - parte.inicio}
            />
          ))}
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
          <div>
            <div className="cifra text-forte text-tinta">{centro}</div>
            {detalheDoCentro && (
              <div className="text-mini text-tinta-3 mt-0.5">{detalheDoCentro}</div>
            )}
          </div>
        </div>
      </div>

      {/* A legenda leva o número junto. A cor sozinha nunca diz quanto foi. */}
      <ul className="flex-1 w-full space-y-2">
        {partes.map((parte) => (
          <li key={parte.chave} className="flex items-center gap-2.5 text-corpo">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full shrink-0"
              style={{ background: parte.cor }}
            />
            <span className="flex-1 min-w-0 truncate text-tinta-2">{parte.rotulo}</span>
            <span className="numerico text-tinta font-medium">{parte.valor}</span>
            <span className="numerico text-mini text-tinta-3 w-12 text-right">
              {parte.participacao.toFixed(0)}%
            </span>
          </li>
        ))}
        <li className="flex justify-between gap-3 text-mini text-tinta-3 pt-2 regra">
          <span>Total</span>
          <span className="numerico">{total}</span>
        </li>
      </ul>
    </div>
  );
}
