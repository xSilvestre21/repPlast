/**
 * A decisão de IPI que uma linha de item traz no formulário.
 *
 * Existe porque os dois lados dessa conversa já se desencontraram: a caixa de
 * marcação se chama `comIpiItem`, e a gravação da linha do orçamento lia
 * `comIpi`. O `get` devolvia `null`, o `=== "on"` devolvia falso, e o resultado
 * era o pior tipo de defeito de dinheiro — silencioso e em ambas as direções:
 * marcar a caixa não surtia efeito, e mexer na quantidade de uma linha
 * tributada a isentava sozinha. O pedido lia certo, o orçamento não, e nada na
 * tela denunciava.
 *
 * Com os nomes e a leitura aqui, o formulário e a Server Action passam a ler do
 * mesmo lugar — e `ipi-do-formulario.test.ts` trava o comportamento.
 */

/** O `name` da caixa de marcação. */
export const CAMPO_IPI = "comIpiItem";

/**
 * O `name` do campo escondido que diz "este formulário TEM opinião sobre IPI".
 *
 * Caixa desmarcada não é enviada pelo navegador, então sem este marcador
 * "desmarquei" e "meu formulário nem mostra IPI" chegariam iguais ao servidor —
 * e desmarcar nunca gravaria.
 */
export const CAMPO_IPI_DEFINIDO = "comIpiItemDefinido";

/**
 * `true`/`false` quando o formulário opinou; `null` quando ele não opinou.
 *
 * O `null` não é "não cobrar": é "não mexa nisto". Quem grava uma linha por uma
 * tela que não mostra a caixa precisa deixar o valor como está, e quem está
 * criando item usa a herança das linhas anteriores.
 */
export function ipiDoFormulario(formData: FormData): boolean | null {
  if (!formData.has(CAMPO_IPI_DEFINIDO)) return null;
  return formData.get(CAMPO_IPI) === "on";
}

/**
 * O mesmo, no formato que o `data` do Prisma espera.
 *
 * Objeto vazio quando o formulário não opinou — espalhá-lo não toca a coluna.
 */
export function ipiParaGravar(formData: FormData): { comIpi?: boolean } {
  const decidido = ipiDoFormulario(formData);
  return decidido === null ? {} : { comIpi: decidido };
}
