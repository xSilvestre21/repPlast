/**
 * Os dados para pagamento de uma indústria — PIX, banco, conta e favorecido —
 * e o texto que o botão Copiar monta com eles para colar no WhatsApp ou no
 * e-mail.
 *
 * Campos separados, e não uma caixa só, para a ficha pedir cada coisa e o texto
 * copiado sair sempre no mesmo formato. O que não cabe neles (boleto, um
 * segundo PIX) vai em `observacoes`, que entra no fim do texto como foi escrito.
 *
 * No banco, cada um é uma coluna `pagamento<Campo>` do fornecedor.
 *
 * Puro, sem `server-only`: a ficha usa as máscaras enquanto se digita, e a ação
 * confere e grava com as mesmas funções.
 */

import { ErroDeCampo } from "@/lib/erro-formulario";
import {
  DIGITOS_CNPJ,
  DIGITOS_CPF,
  mascararCnpj,
  mascararCpf,
  mascararTelefone,
  somenteDigitos,
} from "@/lib/mascara";

export const TIPOS_CHAVE_PIX = {
  CNPJ: "CNPJ",
  CPF: "CPF",
  EMAIL: "E-mail",
  CELULAR: "Celular",
  ALEATORIA: "Chave aleatória",
} as const;

export const TIPOS_CONTA = {
  CORRENTE: "Conta corrente",
  POUPANCA: "Poupança",
} as const;

export type TipoChavePix = keyof typeof TIPOS_CHAVE_PIX;
export type TipoConta = keyof typeof TIPOS_CONTA;

/** "+55 11 91234-5678" colado: o 55 do país sai, sobra o celular com DDD. */
function semCodigoDoPais(valor: string): string {
  const digitos = somenteDigitos(valor);
  return digitos.length === 13 && digitos.startsWith("55") ? digitos.slice(2) : valor;
}

/**
 * A máscara da chave conforme o tipo escolhido — a mesma do CPF/CNPJ e do
 * telefone do resto do sistema. E-mail e chave aleatória vão como escritos.
 */
export function mascaraDaChavePix(tipo: string): ((valor: string) => string) | null {
  if (tipo === "CPF") return mascararCpf;
  if (tipo === "CNPJ") return mascararCnpj;
  if (tipo === "CELULAR") return (valor) => mascararTelefone(semCodigoDoPais(valor));
  return null;
}

/**
 * A máscara do tipo, mas só sobre o que parece número. Um e-mail ou chave
 * aleatória já escrita, com o tipo trocado por engano, fica como está — a
 * máscara de número apagaria as letras na próxima tecla. O servidor recusa
 * com a frase do tipo, e a pessoa decide.
 */
export function mascaraSoDeNumero(mascara: (valor: string) => string) {
  return (valor: string) => ((valor.match(/[a-z@]/gi)?.length ?? 0) >= 2 ? valor : mascara(valor));
}

/** Se a chave já escrita pode ganhar a máscara do tipo novo sem perder nada: só números e pontuação. */
export function chaveCabeNaMascara(valor: string): boolean {
  return /^[\d\s().+/-]*$/.test(valor) && somenteDigitos(valor) !== "";
}

const FORMATO_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
/** A chave aleatória é um UUID: 32 caracteres hexadecimais, com ou sem os traços. */
const FORMATO_ALEATORIA = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * A chave PIX pronta para gravar, ou `null` vazia. LANÇA quando ela não é do
 * tipo escolhido — chave errada é pagamento que não chega. Sem tipo, vai como
 * foi escrita.
 */
export function normalizarChavePix(tipo: string | null, valor: string | null): string | null {
  const chave = valor?.trim() ?? "";
  if (chave === "") return null;
  const recusar = (frase: string): never => {
    throw new ErroDeCampo("pagamentoChavePix", frase);
  };

  switch (tipo) {
    case "CPF":
    case "CNPJ": {
      const esperados = tipo === "CPF" ? DIGITOS_CPF : DIGITOS_CNPJ;
      if (!chaveCabeNaMascara(chave) || somenteDigitos(chave).length !== esperados) {
        recusar(
          tipo === "CPF"
            ? "A chave escolhida é um CPF: são 11 números, como 123.456.789-09. Se for outro tipo, troque em Tipo da chave PIX."
            : "A chave escolhida é um CNPJ: são 14 números, como 12.345.678/0001-95. Se for outro tipo, troque em Tipo da chave PIX.",
        );
      }
      return tipo === "CPF" ? mascararCpf(chave) : mascararCnpj(chave);
    }
    case "CELULAR": {
      const celular = somenteDigitos(semCodigoDoPais(chave));
      if (!chaveCabeNaMascara(chave) || celular.length !== 11) {
        recusar("A chave é um celular: DDD e os 9 números, como (11) 91234-5678.");
      }
      return mascararTelefone(celular);
    }
    case "EMAIL":
      if (!FORMATO_EMAIL.test(chave)) recusar("A chave é um e-mail: confira o @ e o que vem depois, como financeiro@industria.com.br.");
      return chave.toLowerCase();
    case "ALEATORIA":
      if (!FORMATO_ALEATORIA.test(chave)) {
        recusar("A chave aleatória tem 32 letras e números, como 123e4567-e89b-12d3-a456-426614174000. Copie e cole do banco.");
      }
      return chave.toLowerCase();
    default:
      return chave;
  }
}

/** Tudo em texto, vazio quando não preenchido — é o que o formulário usa. */
export type DadosPagamento = {
  tipoChavePix: string;
  chavePix: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  favorecido: string;
  documento: string;
  observacoes: string;
};

/** As colunas do fornecedor, como o Prisma as devolve. */
export type ColunasPagamento = {
  pagamentoTipoChavePix: string | null;
  pagamentoChavePix: string | null;
  pagamentoBanco: string | null;
  pagamentoAgencia: string | null;
  pagamentoConta: string | null;
  pagamentoTipoConta: string | null;
  pagamentoFavorecido: string | null;
  pagamentoDocumento: string | null;
  pagamentoObservacoes: string | null;
};

export const PAGAMENTO_VAZIO: DadosPagamento = {
  tipoChavePix: "",
  chavePix: "",
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "",
  favorecido: "",
  documento: "",
  observacoes: "",
};

export function dadosPagamentoDe(f: ColunasPagamento): DadosPagamento {
  return {
    tipoChavePix: f.pagamentoTipoChavePix ?? "",
    chavePix: f.pagamentoChavePix ?? "",
    banco: f.pagamentoBanco ?? "",
    agencia: f.pagamentoAgencia ?? "",
    conta: f.pagamentoConta ?? "",
    tipoConta: f.pagamentoTipoConta ?? "",
    favorecido: f.pagamentoFavorecido ?? "",
    documento: f.pagamentoDocumento ?? "",
    observacoes: f.pagamentoObservacoes ?? "",
  };
}

const rotuloDe = <T extends Record<string, string>>(tabela: T, chave: string) =>
  (tabela as Record<string, string>)[chave] ?? "";

/** "CNPJ" ou "CPF", pelo número de dígitos; "CPF/CNPJ" se não der para saber. */
function rotuloDocumento(documento: string): string {
  const digitos = documento.replace(/\D/g, "").length;
  return digitos === 11 ? "CPF" : digitos === 14 ? "CNPJ" : "CPF/CNPJ";
}

/**
 * As linhas que o Copiar leva, PIX primeiro (é o que mais se usa). Linha sem
 * nada preenchido não entra; tudo vazio dá texto vazio.
 *
 *   PIX (CNPJ): 12.345.678/0001-95
 *   Banco: Itaú · Agência: 1234 · Conta corrente: 56789-0
 *   Favorecido: INDÚSTRIA EXEMPLO LTDA · CNPJ: 12.345.678/0001-95
 */
export function linhasDoPagamento(d: DadosPagamento): string[] {
  const t = (valor: string) => valor.trim();
  const juntar = (partes: (string | false)[]) => partes.filter(Boolean).join(" · ");
  const tipoChave = rotuloDe(TIPOS_CHAVE_PIX, d.tipoChavePix);

  return [
    t(d.chavePix) && `PIX${tipoChave ? ` (${tipoChave})` : ""}: ${t(d.chavePix)}`,
    juntar([
      !!t(d.banco) && `Banco: ${t(d.banco)}`,
      !!t(d.agencia) && `Agência: ${t(d.agencia)}`,
      !!t(d.conta) && `${rotuloDe(TIPOS_CONTA, d.tipoConta) || "Conta"}: ${t(d.conta)}`,
    ]),
    juntar([
      !!t(d.favorecido) && `Favorecido: ${t(d.favorecido)}`,
      !!t(d.documento) && `${rotuloDocumento(d.documento)}: ${t(d.documento)}`,
    ]),
    t(d.observacoes),
  ].filter(Boolean);
}

export function textoDoPagamento(d: DadosPagamento): string {
  return linhasDoPagamento(d).join("\n");
}
