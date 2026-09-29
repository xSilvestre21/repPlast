/**
 * O texto padrão do e-mail da proposta.
 *
 * A proposta vai para o CLIENTE, e não para a indústria como o pedido — então
 * as variáveis são as de quem recebe uma proposta: a quem se dirige, até
 * quando o preço vale, o prazo de pagamento. As regras de preenchimento
 * (linha que some, `{se}…{fim}`) são as de `lib/modelo-email.ts`, as mesmas
 * do pedido. Destinatários e anexos seguem as de `lib/envio-pedido.ts`.
 */

import * as nucleo from "./modelo-email";

/**
 * O que dá para escrever entre chaves no modelo da proposta. Os exemplos são
 * inventados de propósito: a prévia não é lugar de dado de cliente.
 */
export const VARIAVEIS_ORCAMENTO = {
  numero: { rotulo: "Número da proposta", exemplo: "193", podeFaltar: false },
  cliente: { rotulo: "Cliente", exemplo: "EMBALAGENS EXEMPLO LTDA", podeFaltar: false },
  aos_cuidados: { rotulo: "Aos cuidados de", exemplo: "Sr. Marcelo", podeFaltar: true },
  valido_ate: { rotulo: "Validade", exemplo: "30/10/2026", podeFaltar: true },
  prazo_pagamento: { rotulo: "Prazo de pagamento", exemplo: "28/35/42", podeFaltar: true },
  vendedor: { rotulo: "Vendedor", exemplo: "Ana Souza", podeFaltar: true },
} as const;

export type VariavelOrcamento = keyof typeof VARIAVEIS_ORCAMENTO;

/** O texto que vale enquanto a pessoa não escreve o seu. */
export const ASSUNTO_ORCAMENTO_PADRAO = "Proposta nº {numero} — {cliente}";
export const MENSAGEM_ORCAMENTO_PADRAO = [
  "A/C {aos_cuidados}",
  "",
  "Segue em anexo nossa proposta nº {numero}.",
  "{se valido_ate}Preços válidos até {valido_ate}.{fim}",
  "Prazo de pagamento: {prazo_pagamento}",
  "",
  "Fico à disposição para qualquer dúvida.",
  "",
  "{vendedor}",
].join("\n");

/**
 * Os "contatos" que o diálogo oferece são os dois e-mails do cadastro do
 * cliente. O formulário manda só estas chaves; o endereço a ação busca no
 * banco — o navegador diz "mande para o e-mail da NF-e", não qual é ele.
 */
export const CONTATO_EMAIL = "email";
export const CONTATO_NFE = "emailNfe";

const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

/** O primeiro problema do modelo, em português de gente, ou `null`. */
export function problemaNoModeloDaProposta(modelo: string): string | null {
  return nucleo.problemaNoModelo(modelo, VARIAVEIS_ORCAMENTO, "da proposta");
}

/**
 * Assunto e corpo com que o diálogo de envio da proposta abre.
 *
 * `cliente` é a razão social de quem já é cliente, ou o nome digitado na
 * proposta de quem ainda não é. `validoAte` é coluna `date` (meia-noite UTC),
 * por isso o fuso UTC na formatação — em São Paulo, a data andaria um dia
 * para trás.
 */
export function textoPadraoDoOrcamento(
  orcamento: {
    numero: number;
    cliente: string;
    attn: string | null;
    validoAte: Date | null;
    prazoPagamento: string | null;
    vendedor: string | null;
  },
  modelo?: { assunto?: string | null; corpo?: string | null },
): { assunto: string; corpo: string } {
  const valores: Record<VariavelOrcamento, string> = {
    numero: String(orcamento.numero),
    cliente: orcamento.cliente,
    aos_cuidados: orcamento.attn ?? "",
    valido_ate: orcamento.validoAte ? DATA.format(orcamento.validoAte) : "",
    prazo_pagamento: orcamento.prazoPagamento ?? "",
    vendedor: orcamento.vendedor ?? "",
  };

  return nucleo.preencherModelo(
    {
      assunto: modelo?.assunto || ASSUNTO_ORCAMENTO_PADRAO,
      corpo: modelo?.corpo || MENSAGEM_ORCAMENTO_PADRAO,
    },
    valores,
  );
}
