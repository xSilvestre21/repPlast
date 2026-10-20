/**
 * CPF e CNPJ de verdade: os dígitos verificadores conferem.
 *
 * Só para o CADASTRO DO ESCRITÓRIO — é o documento de quem paga, e um número
 * inventado ali vira uma cobrança que o Asaas recusa depois do formulário todo
 * preenchido. O cadastro de cliente continua só contando dígitos
 * (`normalizarDocumento`): os CNPJs importados do SICOV nunca foram conferidos,
 * e recusá-los agora travaria a edição de cliente antigo.
 *
 * Aceita o CNPJ ALFANUMÉRICO que a Receita emite desde julho de 2026
 * ("12.ABC.345/01DE-35"): as 12 primeiras posições podem ter letras, os dois
 * verificadores continuam números. A conta é a mesma do numérico, com cada
 * caractere valendo o código ASCII menos 48 — o "0" vale 0, o "A" vale 17.
 *
 * Módulo puro, testável sem servidor.
 */

const TAMANHO_CPF = 11;
const TAMANHO_CNPJ = 14;

/** Só letras e números, em maiúsculas: a forma gravada e mandada ao Asaas. */
export function documentoSemPontuacao(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** O verificador do módulo 11: resto menor que 2 vira 0. */
function verificador(valores: number[], pesos: number[]): number {
  const soma = valores.reduce((total, valor, i) => total + valor * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function todosIguais(texto: string): boolean {
  return /^(.)\1*$/.test(texto);
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || todosIguais(cpf)) return false;

  const numeros = [...cpf].map(Number);
  const primeiro = verificador(numeros.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = verificador(numeros.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return numeros[9] === primeiro && numeros[10] === segundo;
}

export function cnpjValido(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || todosIguais(cnpj)) return false;

  const valores = [...cnpj].map((caractere) => caractere.charCodeAt(0) - 48);
  const primeiro = verificador(valores.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = verificador(valores.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return valores[12] === primeiro && valores[13] === segundo;
}

/**
 * O problema do documento, em português de gente, ou `null` se ele vale.
 * Recebe já sem pontuação (`documentoSemPontuacao`).
 */
export function problemaNoDocumento(documento: string): string | null {
  if (documento === "") {
    return "Informe o CPF ou o CNPJ de quem paga a assinatura, como 123.456.789-09.";
  }

  const temLetra = /[A-Z]/.test(documento);

  if (documento.length === TAMANHO_CPF && !temLetra) {
    return cpfValido(documento)
      ? null
      : "Este CPF não existe — os dois últimos números não conferem com os outros. Confira se " +
          "digitou certo, como 123.456.789-09.";
  }

  if (documento.length === TAMANHO_CNPJ) {
    if (!/\d{2}$/.test(documento)) {
      return "Os dois últimos caracteres do CNPJ são sempre números, mesmo no CNPJ com letras. " +
        "Confira o cartão do CNPJ.";
    }
    return cnpjValido(documento)
      ? null
      : "Este CNPJ não existe — os dois últimos números não conferem com os outros. Confira se " +
          "digitou certo, como 12.345.678/0001-95.";
  }

  const contagem =
    documento.length === 1 ? "foi digitado 1 caractere" : `foram digitados ${documento.length} caracteres`;
  return (
    `Faltam ou sobram caracteres: ${contagem}. O CPF tem 11 números (como 123.456.789-09) e o ` +
    "CNPJ tem 14 (como 12.345.678/0001-95)."
  );
}
