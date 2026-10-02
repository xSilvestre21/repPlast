import Decimal from "decimal.js";

import { ratearComissao } from "@/lib/comissao";
import {
  acertoDoPedido,
  percentualDoPedido,
  percentualPrepostoDoPedido,
  prepostoDoPedido,
  type PedidoDaComissao,
} from "@/lib/comissao-consulta";

import type { ItemGrafico } from "./base";

/** Reais (Decimal ou texto) para centavos inteiros. */
export const centavos = (valor: Decimal.Value) =>
  new Decimal(valor).times(100).round().toNumber();

/**
 * Um item de comissão vira um item de gráfico, já pela visão de quem olha.
 *
 * O rateio é o de `ratearComissao` — a conta da tela de Comissões, item a item.
 * É por isso que o total de um mês nos gráficos bate com o de lá: a soma é dos
 * mesmos números, não de uma conta parecida refeita.
 *
 * O corte entre as visões acontece AQUI. O preposto recebe a fatia dele e
 * `null` no bruto — não um bruto escondido que a tela deixa de mostrar.
 */
export function itemDoGrafico(
  pedido: PedidoDaComissao,
  visao: { ehAdmin: boolean; comPreposto: boolean },
): ItemGrafico {
  const percentualPreposto = percentualPrepostoDoPedido(pedido);
  const acerto = acertoDoPedido(pedido);

  const previsto = ratearComissao(
    pedido.subtotalSemIpi.toString(),
    percentualDoPedido(pedido),
    percentualPreposto,
  );
  const recebido = acerto
    ? ratearComissao(acerto.base, acerto.percentual, percentualPreposto)
    : null;

  const dele = (r: ReturnType<typeof ratearComissao>) =>
    visao.ehAdmin ? r.doEscritorio : r.doPreposto;

  return {
    pedidoId: pedido.id,
    numero: pedido.numero,
    competencia: pedido.competencia,
    clienteId: pedido.cliente.id,
    cliente: pedido.cliente.apelido,
    fornecedorId: pedido.fornecedor.id,
    fornecedor: pedido.fornecedor.nome,
    prepostoId: visao.comPreposto ? (prepostoDoPedido(pedido)?.id ?? null) : null,
    previsto: centavos(dele(previsto)),
    recebido: recebido ? centavos(dele(recebido)) : null,
    bruto: visao.ehAdmin ? centavos(previsto.total) : null,
    brutoRecebido: visao.ehAdmin && recebido ? centavos(recebido.total) : null,
  };
}
