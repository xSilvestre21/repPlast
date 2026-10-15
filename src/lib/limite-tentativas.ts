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

/** Minutos que faltam, arredondados para cima: "espere 1 minuto", nunca "0". */
export function minutosAte(libera: Date, agora: Date): number {
  return Math.max(1, Math.ceil((libera.getTime() - agora.getTime()) / MINUTO_MS));
}

export function minutosPorExtenso(minutos: number): string {
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}
