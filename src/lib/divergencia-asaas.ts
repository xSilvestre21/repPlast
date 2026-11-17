/**
 * O que a conferência diária conclui de UM escritório, comparando a situação
 * dele aqui com a assinatura no Asaas (`conferencia-asaas.ts`).
 *
 * A regra é a do webhook (`asaas-webhook.ts`): o que um aviso perdido teria
 * feito, a conferência faz — libera quem pagou, bloqueia quem tem fatura
 * vencida ou assinatura encerrada, e liga a assinatura nova que não foi
 * ligada. O que o webhook não decide sozinho continua sem decidir: o valor da
 * mensalidade e o escritório cancelado com a assinatura ainda ativa só viram
 * alerta, para uma pessoa olhar.
 *
 * Sem banco e sem rede: testada sozinha (`divergencia-asaas.test.ts`).
 */

import type Decimal from "decimal.js";

import { assinaturaLiberada, type SituacaoAssinatura } from "./acesso-assinatura";

/** O dinheiro entrou, ou o cartão foi aprovado — os status que o webhook trata como pagos. */
const PAGAS = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface EscritorioConferido {
  assinatura: SituacaoAssinatura;
  acessoAte: Date | null;
  testeAte: Date | null;
  /** O plano e os prepostos ativos de hoje (`valorMensal`). */
  devido: Decimal;
}

interface Cobranca {
  status: string;
}

export interface Vista {
  /**
   * A assinatura gravada no escritório: ausente quando ele nunca teve uma;
   * `null` quando o Asaas não a conhece mais. As cobranças só vêm da ativa.
   */
  gravada?: { ativa: boolean; valor: Decimal; cobrancas: Cobranca[] } | null;
  /**
   * Outra assinatura ATIVA do mesmo cliente no Asaas, que o escritório não tem
   * gravada — a de quem assinou de novo e o aviso não chegou. `deOutro`: ela
   * (ou o cliente) já é de outro escritório, e ligar seria um palpite.
   */
  nova?: { id: string; valor: Decimal; cobrancas: Cobranca[]; deOutro: boolean } | null;
}

export interface Correcao {
  situacao: SituacaoAssinatura;
  /** A assinatura nova a gravar no escritório, quando é ela que vale. */
  ligar: string | null;
  /** Quem entrava deixa de entrar — o que a conferência confirma de novo antes de gravar. */
  bloqueia: boolean;
  motivo: string;
}

export interface Conclusao {
  correcao: Correcao | null;
  /** O que só uma pessoa decide. */
  alertas: string[];
}

function motivoDaSituacao(situacao: SituacaoAssinatura): string {
  switch (situacao) {
    case "ATIVA":
      return "o Asaas tem cobrança paga e nenhuma vencida";
    case "ATRASADA":
      return "o Asaas tem cobrança vencida";
    case "CANCELADA":
      return "a assinatura foi encerrada no Asaas";
    default:
      return "o Asaas diz outra coisa";
  }
}

export function concluir(escritorio: EscritorioConferido, vista: Vista, agora: Date = new Date()): Conclusao {
  const alertas: string[] = [];
  const emTeste = escritorio.testeAte !== null && escritorio.testeAte.getTime() > agora.getTime();

  // A assinatura que vale: a gravada, se ainda gera cobranças; senão, a nova do cliente.
  let vale: { valor: Decimal; cobrancas: Cobranca[]; ligar: string | null } | null = null;
  if (vista.gravada?.ativa) {
    vale = { ...vista.gravada, ligar: null };
  } else if (vista.nova) {
    if (vista.nova.deOutro) {
      alertas.push(
        `o cliente no Asaas tem a assinatura ativa ${vista.nova.id}, mas ela (ou o cliente) já é de outro ` +
          "escritório — conferir à mão qual escritório paga por ela.",
      );
    } else {
      vale = { ...vista.nova, ligar: vista.nova.id };
    }
  }

  if (!vale) {
    // Nenhuma assinatura gerando cobrança.
    if (vista.gravada !== undefined) {
      // Havia uma, e o Asaas a encerrou: o SUBSCRIPTION_DELETED/INACTIVATED que não chegou.
      // Aguardando pagamento fica como está: pode ser um checkout novo em andamento.
      if (escritorio.assinatura === "ATIVA" || escritorio.assinatura === "ATRASADA") {
        return { correcao: corrigir(escritorio, "CANCELADA", null, agora), alertas };
      }
    } else if (escritorio.assinatura === "ATIVA") {
      alertas.push(
        "liberado sem nenhuma assinatura no Asaas: usa o sistema sem pagar. Se for de propósito, marque o " +
          'escritório como "sem cobrança" (README, "A conferência diária com o Asaas").',
      );
    }
    return { correcao: null, alertas };
  }

  // O valor nunca é corrigido aqui: a regra "sobe na hora, desce no ciclo
  // seguinte" (`mensalidade.ts`) não se confere de fora. Cobrar MENOS que o
  // devido é sempre engano (o aumento não chegou ao Asaas); cobrar mais é a
  // redução esperando a fatura em aberto — salvo nos 7 dias grátis, em que a
  // redução vale na hora.
  if (vale.valor.lt(escritorio.devido)) {
    alertas.push(
      `o Asaas cobra ${MOEDA.format(vale.valor.toNumber())} por mês, e o plano com os prepostos ativos dá ` +
        `${MOEDA.format(escritorio.devido.toNumber())} — o aumento não chegou ao Asaas.`,
    );
  } else if (emTeste && vale.valor.gt(escritorio.devido)) {
    alertas.push(
      `no teste grátis, o Asaas vai cobrar ${MOEDA.format(vale.valor.toNumber())}, e o plano com os prepostos ` +
        `ativos dá ${MOEDA.format(escritorio.devido.toNumber())} — a redução não chegou ao Asaas.`,
    );
  }

  // Cancelado aqui, e a assinatura gravada segue cobrando: desfazer o
  // cancelamento ou apagar a assinatura é decisão de gente.
  if (escritorio.assinatura === "CANCELADA" && vale.ligar === null) {
    alertas.push(
      "cancelado no sistema, mas a assinatura segue ativa no Asaas e vai continuar cobrando — " +
        "remover a assinatura no painel do Asaas, ou entender por que o cancelamento não chegou lá.",
    );
    return { correcao: null, alertas };
  }

  const vencida = vale.cobrancas.some((cobranca) => cobranca.status === "OVERDUE");
  const paga = vale.cobrancas.some((cobranca) => PAGAS.has(cobranca.status));
  // Sem nada pago nem vencido, só o teste grátis libera (é o SUBSCRIPTION_CREATED
  // do checkout que não cobra). Fora dele, a cobrança ainda está sendo processada:
  // sem opinião.
  const esperada: SituacaoAssinatura | null = vencida ? "ATRASADA" : paga || emTeste ? "ATIVA" : null;

  const situacao = esperada ?? escritorio.assinatura;
  if (situacao === escritorio.assinatura && vale.ligar === null) return { correcao: null, alertas };

  return { correcao: corrigir(escritorio, situacao, vale.ligar, agora), alertas };
}

function corrigir(
  escritorio: EscritorioConferido,
  situacao: SituacaoAssinatura,
  ligar: string | null,
  agora: Date,
): Correcao {
  // A situação nova libera tudo de novo (`acessoAte` some no ATIVA, como no webhook).
  const depois = { assinatura: situacao, acessoAte: situacao === "ATIVA" ? null : escritorio.acessoAte };
  const bloqueia = assinaturaLiberada(escritorio, agora) && !assinaturaLiberada(depois, agora);

  const motivo =
    situacao === escritorio.assinatura
      ? `liga a assinatura ${ligar}, que o aviso do Asaas não ligou`
      : ligar
        ? `${motivoDaSituacao(situacao)} na assinatura ${ligar}, que o aviso do Asaas não ligou`
        : motivoDaSituacao(situacao);

  return { situacao, ligar, bloqueia, motivo };
}
