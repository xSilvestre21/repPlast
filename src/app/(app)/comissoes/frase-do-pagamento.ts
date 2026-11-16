/**
 * Depois do pagamento ao preposto: ficou quitado, ainda falta, ou passou?
 *
 * É a linha em destaque do cartão "Pagamento realizado com sucesso"
 * (`pagamento-realizado.tsx`). Módulo puro: a conta e a frase se testam em
 * `node`, sem navegador.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export type SituacaoDoSaldo = "quitado" | "faltando" | "a-mais";

export function fraseDoSaldo({
  restante,
  nome,
  mes,
}: {
  /** O que falta pagar depois deste pagamento; negativo quando passou. */
  restante: number;
  /** O primeiro nome do preposto. */
  nome: string;
  /** "novembro de 2026". */
  mes: string;
}): { situacao: SituacaoDoSaldo; frase: string } {
  // Em centavos: 0,1 + 0,2 não pode virar "falta R$ 0,00".
  const centavos = Math.round(restante * 100);
  const valor = MOEDA.format(Math.abs(centavos) / 100);

  if (centavos === 0) {
    return { situacao: "quitado", frase: `Tudo quitado — ${nome} não tem mais nada a receber em ${mes}.` };
  }
  if (centavos > 0) {
    return { situacao: "faltando", frase: `Ainda faltam ${valor} para quitar ${mes}.` };
  }
  return { situacao: "a-mais", frase: `Ficou ${valor} pago a mais — desconta no mês seguinte.` };
}
