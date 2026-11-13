/**
 * O pagamento que atrasou: a indústria não pagou a comissão no mês em que
 * devia.
 *
 * Um pedido (ou uma parcela) tem o mês DELE — o da entrega, ou o do vencimento,
 * já com o fechamento do faturamento (`mesDoRecebimento`). Quando a indústria
 * atrasa, há dois estados, e só dois:
 *
 *   - "não pago", sem previsão: a linha continua no mês dela, a acertar, e
 *     aparece nos meses seguintes como pendente;
 *   - "adiado para" um mês: a comissão passa a contar nesse mês. No mês dela a
 *     linha continua à vista, com o selo, mas fora da soma — o dinheiro conta
 *     uma vez só, onde entra.
 *
 * Módulo PURO — sem banco, sem `server-only` —, pelo mesmo motivo de
 * `parcelas.ts`: a tela mostra, enquanto se escolhe, o que o servidor vai
 * gravar.
 */

import { deslocarCompetencia } from "@/lib/comissao";

/** Como o atraso está gravado, no pedido ou na parcela. */
export interface Adiamento {
  /** "Ainda não foi pago", sem previsão. */
  naoPaga: boolean;
  /** "AAAA-MM" em que a comissão conta, no lugar do mês dela. */
  para: string | null;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function ehCompetencia(texto: string): boolean {
  return MES.test(texto);
}

/** O mês em que o item conta: o adiado, quando há, ou o dele. */
export function competenciaDoItem(natural: string, adiadaPara: string | null | undefined): string {
  return adiadaPara && adiadaPara !== natural ? adiadaPara : natural;
}

const NOME = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const NOME_SEM_ANO = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

/** "novembro de 2026" — em minúsculas, para o meio da frase. */
export function nomeDaCompetencia(competencia: string): string {
  return NOME.format(new Date(`${competencia}-01T00:00:00Z`));
}

/**
 * "novembro", ou "novembro de 2027" quando o ano não é o de `referencia` — o
 * selo é curto, e o ano só diz algo quando muda.
 */
export function nomeCurtoDaCompetencia(competencia: string, referencia: string): string {
  return competencia.slice(0, 4) === referencia.slice(0, 4)
    ? NOME_SEM_ANO.format(new Date(`${competencia}-01T00:00:00Z`))
    : nomeDaCompetencia(competencia);
}

/**
 * O que impede adiar para `mes`, ou `null` quando pode.
 *
 * Adiar é para DEPOIS: a indústria que paga antes não atrasou, e um pedido
 * "adiado" para trás sumiria do mês em que foi vendido sem motivo.
 */
export function problemaNoAdiamento(natural: string, mes: string): string | null {
  if (!ehCompetencia(mes)) return "Escolha no calendário o mês em que a indústria vai pagar.";

  if (mes <= natural) {
    return (
      `Escolha um mês depois de ${nomeDaCompetencia(natural)} — é o mês em que esta comissão já ` +
      `conta. Por exemplo, ${nomeDaCompetencia(deslocarCompetencia(natural, 1))}.`
    );
  }

  return null;
}

/**
 * Os meses que o seletor oferece: do seguinte ao da comissão até um ano depois
 * de hoje. Começa logo depois do mês dela porque um pedido de agosto pode ter
 * sido pago em setembro, e só agora, em novembro, alguém vem lançar.
 */
export function mesesParaAdiar(natural: string, hoje: string): string[] {
  const ate = deslocarCompetencia(hoje > natural ? hoje : natural, 12);
  const meses: string[] = [];

  for (let mes = deslocarCompetencia(natural, 1); mes <= ate; mes = deslocarCompetencia(mes, 1)) {
    meses.push(mes);
  }

  return meses;
}

/**
 * O mês que o seletor abre escolhido: o que já está gravado, ou o mês de hoje —
 * quem marca "vai pagar em" quase sempre fala do mês corrente ou do próximo.
 * Para o pedido que ainda nem chegou ao mês dele, o seguinte.
 */
export function mesSugerido(natural: string, hoje: string, gravado: string | null): string {
  if (gravado && gravado > natural) return gravado;
  return hoje > natural ? hoje : deslocarCompetencia(natural, 1);
}
