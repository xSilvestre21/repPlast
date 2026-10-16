/**
 * Máscaras dos campos que se digitam sem pontuação: documento, telefone, CEP e
 * dinheiro.
 *
 * Este módulo é PURO de propósito — nada de DOM, nada de `server-only`. As duas
 * pontas precisam dele:
 *
 *   - no navegador, para a pontuação aparecer enquanto a pessoa digita;
 *   - no servidor, para gravar sempre no mesmo formato, venha o valor do campo
 *     com máscara, de um colar sem pontuação ou de um envio sem JavaScript.
 *
 * Sem a segunda ponta a máscara seria enfeite: o formulário usa `useActionState`
 * e continua enviando por POST normal com o JavaScript desligado, e aí o texto
 * chegaria cru. É a mesma divisão de `numero-br.ts`, que lê "13,50" tanto do
 * campo quanto do FormData.
 *
 * O formato de saída não foi inventado aqui: é o que já está gravado nos
 * clientes cadastrados — "(17) 3321-5900" e "09.507.378/0001-50".
 */

import { ErroDeCampo } from "@/lib/erro-formulario";

export const DIGITOS_CPF = 11;
export const DIGITOS_CNPJ = 14;
export const DIGITOS_CEP = 8;

/** Só os dígitos. É deles que toda máscara daqui é remontada. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Distribui os dígitos nos grupos, inserindo o separador ANTES de cada grupo
 * que recebeu algo.
 *
 * O separador nunca sobra no fim — "12" vira "12", não "12.". Isso é o que faz
 * o apagar se comportar: com a pontuação pendurada, apagar o último dígito
 * devolveria "12." e a tecla seguinte pareceria não funcionar.
 */
function agrupar(digitos: string, grupos: number[], separadores: string[]): string {
  let saida = "";
  let lidos = 0;

  for (let i = 0; i < grupos.length && lidos < digitos.length; i++) {
    if (i > 0) saida += separadores[i - 1];
    saida += digitos.slice(lidos, lidos + grupos[i]);
    lidos += grupos[i];
  }

  return saida;
}

/**
 * CPF ou CNPJ, decidido pela quantidade de dígitos.
 *
 * Até 11 dígitos vale a forma de CPF; do 12º em diante, a de CNPJ. Quem digita
 * um CNPJ vê o formato virar no meio do caminho — é o comportamento normal de
 * um campo que aceita os dois, e o alternativo (pedir para escolher o tipo
 * antes) é uma pergunta a mais para quem só quer cadastrar um cliente.
 */
export function mascararDocumento(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, DIGITOS_CNPJ);

  return digitos.length <= DIGITOS_CPF
    ? agrupar(digitos, [3, 3, 3, 2], [".", ".", "-"])
    : agrupar(digitos, [2, 3, 3, 4, 2], [".", ".", "/", "-"]);
}

/**
 * O documento de quem PAGA a assinatura: igual a `mascararDocumento`, mas
 * aceitando as letras do CNPJ alfanumérico (ver `documento.ts`).
 *
 * Com uma letra, só pode ser CNPJ, e a forma vira de CNPJ na hora — mesmo com
 * menos de 12 caracteres. Fica só no cadastro do escritório: no de cliente a
 * máscara numérica continua, e as letras seriam apagadas ali.
 */
export function mascararDocumentoCobranca(valor: string): string {
  const caracteres = valor.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, DIGITOS_CNPJ);

  return caracteres.length <= DIGITOS_CPF && !/[A-Z]/.test(caracteres)
    ? agrupar(caracteres, [3, 3, 3, 2], [".", ".", "-"])
    : agrupar(caracteres, [2, 3, 3, 4, 2], [".", ".", "/", "-"]);
}

/**
 * Telefone brasileiro com DDD: "(17) 3321-5900" ou "(17) 99687-3399".
 *
 * O corte entre prefixo e sufixo depende do total: 11 dígitos é celular e o
 * prefixo tem 5; 10 é fixo e o prefixo tem 4. Enquanto se digita, o número
 * ainda incompleto é tratado como fixo e o corte se ajusta sozinho quando o
 * 11º dígito chega.
 *
 * Começando em zero, a máscara SAI DA FRENTE e devolve o texto como veio.
 * Nenhum DDD brasileiro começa com zero, então quem digita isso está escrevendo
 * um 0800 — e forçar a forma de DDD ali produziria "(08) 00704-1234", que não é
 * o telefone de ninguém.
 */
export function mascararTelefone(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 11);

  if (digitos.startsWith("0")) return valor;
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const prefixo = digitos.length > 10 ? 5 : 4;

  if (numero.length <= prefixo) return `(${ddd}) ${numero}`;

  return `(${ddd}) ${numero.slice(0, prefixo)}-${numero.slice(prefixo)}`;
}

/** CEP: "14781-160". */
export function mascararCep(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, DIGITOS_CEP);

  return agrupar(digitos, [5, 3], ["-"]);
}

/**
 * Dinheiro: "1.234,56", com os dígitos entrando pela direita como centavos.
 *
 * É o campo de valor dos apps de banco: digitar 5, 0, 0, 0 mostra "0,05",
 * "0,50", "5,00", "50,00" — a vírgula nunca precisa ser digitada e nunca fica
 * no lugar errado. Zeros à esquerda caem, e só zeros vira campo vazio: apagar
 * tudo devolve o "sem valor" que os formulários já entendem (sem meta, desfazer
 * o acerto), em vez de um "0,00" que pareceria valor de verdade.
 *
 * Por isso o `defaultValue` de um campo de dinheiro precisa vir com as duas
 * casas ("20.000,00", não "20000"): a máscara leria "20000" como centavos.
 *
 * Do lado do servidor não há normalização própria: "1.234,56" é exatamente o
 * que `lerNumeroBr` já lê.
 */
export function mascararMoeda(valor: string): string {
  const digitos = somenteDigitos(valor).replace(/^0+/, "");
  if (digitos === "") return "";

  const completo = digitos.padStart(3, "0");
  const inteiro = completo.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${inteiro},${completo.slice(-2)}`;
}

/* -------------------------------------------------------------------------- */
/* Normalização de entrada (servidor)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Documento pronto para gravar, ou `null` quando o campo veio vazio.
 *
 * LANÇA quando a contagem não fecha. É como o resto das ações trata dado de
 * formulário inválido: a exceção vira a mensagem vermelha embaixo do campo
 * `campo`, sem meio-termo silencioso. Guardar um CNPJ pela metade seria pior
 * do que recusar — ele sai impresso no pedido que a indústria recebe.
 */
export function normalizarDocumento(valor: string, campo = "cnpj"): string | null {
  const digitos = somenteDigitos(valor);
  if (digitos === "") return null;

  if (digitos.length !== DIGITOS_CPF && digitos.length !== DIGITOS_CNPJ) {
    throw new ErroDeCampo(
      campo,
      `Faltam ou sobram números: ${digitos.length === 1 ? "foi digitado 1" : `foram digitados ${digitos.length}`}. ` +
        `O CNPJ tem ${DIGITOS_CNPJ} números (como 09.507.378/0001-50) e o CPF tem ${DIGITOS_CPF} ` +
        `(como 123.456.789-09).`,
    );
  }

  return mascararDocumento(digitos);
}

/**
 * CEP pronto para gravar, ou `null` quando o campo veio vazio.
 *
 * LANÇA quando a contagem não fecha, pelo mesmo motivo do documento: o CEP sai
 * impresso no pedido, e endereço pela metade é entrega errada.
 */
export function normalizarCep(valor: string, campo = "cep"): string | null {
  const digitos = somenteDigitos(valor);
  if (digitos === "") return null;

  if (digitos.length !== DIGITOS_CEP) {
    throw new ErroDeCampo(
      campo,
      `O CEP tem ${DIGITOS_CEP} números, como 14781-160 — ${digitos.length === 1 ? "foi digitado 1" : `foram digitados ${digitos.length}`}.`,
    );
  }

  return mascararCep(digitos);
}

/**
 * Telefone pronto para gravar, ou `null` quando o campo veio vazio.
 *
 * Não lança, e isso é deliberado: telefone comercial tem formas que não cabem
 * na máscara — 0800, ramal anotado junto, número de fora do país. Só o que é
 * reconhecidamente um telefone com DDD é padronizado; o resto é gravado como a
 * pessoa escreveu, em vez de ser recusado ou remontado errado.
 */
export function normalizarTelefone(valor: string): string | null {
  const texto = valor.trim();
  if (texto === "") return null;

  const digitos = somenteDigitos(texto);
  const temDdd = !digitos.startsWith("0") && (digitos.length === 10 || digitos.length === 11);

  return temDdd ? mascararTelefone(digitos) : texto;
}
