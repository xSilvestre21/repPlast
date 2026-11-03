/**
 * A conta do limite de tentativas, sem banco: dadas as falhas recentes, até
 * quando a porta fica fechada. Usada pelo login e pelo "Esqueceu sua senha?".
 */

const MINUTO_MS = 60 * 1000;

/**
 * Quando libera, ou `null` se não está bloqueado.
 *
 * Bloqueia com `limite` falhas dentro da janela. Libera quando a falha que
 * completou o limite sai da janela: com 5 de limite e 7 falhas, é a 5ª mais
 * recente que importa — ao sair ela, sobram 4. `datas` em qualquer ordem.
 */
export function liberacao(
  datas: Date[],
  { limite, janelaMin, agora }: { limite: number; janelaMin: number; agora: Date },
): Date | null {
  const inicioDaJanela = agora.getTime() - janelaMin * MINUTO_MS;
  const naJanela = datas
    .map((data) => data.getTime())
    .filter((instante) => instante > inicioDaJanela)
    .sort((a, b) => b - a);

  if (naJanela.length < limite) return null;
  return new Date(naJanela[limite - 1] + janelaMin * MINUTO_MS);
}

/** Quantas falhas ainda cabem na janela antes de a porta fechar — nunca negativo. */
export function restantes(
  datas: Date[],
  { limite, janelaMin, agora }: { limite: number; janelaMin: number; agora: Date },
): number {
  const inicioDaJanela = agora.getTime() - janelaMin * MINUTO_MS;
  const naJanela = datas.filter((data) => data.getTime() > inicioDaJanela).length;
  return Math.max(0, limite - naJanela);
}

/** Minutos que faltam, arredondados para cima: "espere 1 minuto", nunca "0". */
export function minutosAte(libera: Date, agora: Date): number {
  return Math.max(1, Math.ceil((libera.getTime() - agora.getTime()) / MINUTO_MS));
}

export function minutosPorExtenso(minutos: number): string {
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}

/**
 * O IP de quem pede, tirado do `x-forwarded-for`: o valor MAIS À DIREITA.
 *
 * Cada proxy no caminho acrescenta, no fim da lista, o endereço de quem falou
 * com ele — e o que vem antes é o que o próprio cliente mandou, que ele
 * inventa à vontade. O último é o único escrito pelo proxy da frente da
 * hospedagem. No Vercel e atrás do Caddy a lista chega com um valor só (os
 * dois descartam o que o cliente mandou), então tanto faz a ponta; num
 * balanceador que acrescenta (o ALB da AWS), o primeiro seria o inventado.
 */
export function ipDoEncaminhamento(cabecalho: string | null | undefined): string | null {
  const valores = (cabecalho ?? "")
    .split(",")
    .map((valor) => valor.trim())
    .filter(Boolean);
  return valores.at(-1) ?? null;
}
