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
 */

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
