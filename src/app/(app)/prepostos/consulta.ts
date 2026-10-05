import "server-only";

/**
 * O que a lista de prepostos e a ficha de cada um leem do banco.
 *
 * A comissão vem das MESMAS funções da tela de Comissões
 * (`pedidosDaCompetencia`, `resumirComissao`, `saldosDeRepasse`): o número no
 * card do preposto e o da linha dele em Comissões são a mesma conta, e não
 * duas que um dia divergem.
 */

import { competenciaDe } from "@/lib/comissao";
import {
  pedidosDaCompetencia,
  prepostoDoPedido,
  repassesLancados,
  resumirComissao,
  saldosDeRepasse,
  type PedidoDaComissao,
} from "@/lib/comissao-consulta";
import { corDoPreposto } from "@/lib/cor-preposto";
import type { DbOrganizacao } from "@/lib/db";
import { nomeCompleto } from "@/lib/nome-usuario";

const CAMPOS_DO_PREPOSTO = {
  id: true,
  nome: true,
  sobrenome: true,
  email: true,
  telefone: true,
  ativo: true,
  criadoEm: true,
  comissaoPercentualPadrao: true,
  fornecedores: { select: { fornecedor: { select: { id: true, nome: true } } } },
  _count: { select: { clientes: true } },
} as const;

/** A comissão de um preposto num mês, já em reais (string, para atravessar). */
export interface ComissaoDoMes {
  /** A fatia dele no que foi vendido no mês, acertado ou não. */
  prevista: string;
  /** A fatia dele no que a indústria já acertou. */
  recebida: string;
  /** O que o escritório deve a ele, com o saldo dos meses anteriores. */
  aRepassar: string;
  /** Pedidos enviados no mês e a venda deles (sem IPI). */
  pedidos: number;
  venda: string;
}

function comissaoDe(itens: PedidoDaComissao[], aRepassar: string | undefined): ComissaoDoMes {
  const resumo = resumirComissao(itens);
  return {
    prevista: resumo.previstoDoPreposto.toFixed(2),
    recebida: resumo.recebidoDoPreposto.toFixed(2),
    aRepassar: aRepassar ?? "0.00",
    // Um pedido parcelado vem em vários itens (uma parcela por mês): conta uma vez.
    pedidos: new Set(itens.map((i) => i.id)).size,
    venda: resumo.base.toFixed(2),
  };
}

/**
 * Todos os prepostos do escritório, com a cor de cada um e a comissão do mês.
 *
 * A cor segue a ordem de inscrição — a mesma de Comissões e dos gráficos —, e
 * por isso os inativos entram na conta: tirá-los mudaria a cor de quem veio
 * depois.
 */
export async function prepostosComComissao(db: DbOrganizacao, organizacaoId: string, competencia: string) {
  const [prepostos, pedidos, repasses] = await Promise.all([
    db.usuario.findMany({
      where: { organizacaoId, papel: "REPRESENTANTE" },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
      select: CAMPOS_DO_PREPOSTO,
    }),
    pedidosDaCompetencia(db, organizacaoId, competencia),
    repassesLancados(db, organizacaoId),
  ]);

  const saldos = await saldosDeRepasse(db, organizacaoId, competencia, pedidos, repasses);
  const porPreposto = Map.groupBy(
    pedidos.filter((p) => prepostoDoPedido(p)),
    (p) => prepostoDoPedido(p)!.id,
  );

  return prepostos.map((p, i) => ({
    ...p,
    nomeCompleto: nomeCompleto(p),
    cor: corDoPreposto(i),
    comissao: comissaoDe(porPreposto.get(p.id) ?? [], saldos.get(p.id)?.aRepassar.toFixed(2)),
  }));
}

/** Um preposto só, com o que a ficha dele mostra. `null` quando não é deste escritório. */
export async function fichaDoPreposto(db: DbOrganizacao, organizacaoId: string, id: string) {
  const competencia = competenciaDe(new Date());

  const [todos, recentes, clientes] = await Promise.all([
    prepostosComComissao(db, organizacaoId, competencia),
    // Os últimos que ele lançou, em qualquer situação — a pergunta é "o que
    // ele anda fazendo", e um cancelado de ontem responde tanto quanto um enviado.
    db.pedido.findMany({
      where: { organizacaoId, representanteId: id },
      orderBy: [{ criadoEm: "desc" }, { numero: "desc" }],
      take: 8,
      select: {
        id: true,
        numero: true,
        status: true,
        totalGeral: true,
        criadoEm: true,
        cliente: { select: { apelido: true } },
        fornecedor: { select: { nome: true } },
      },
    }),
    // A carteira dele: o cliente é do preposto pelo campo do cliente, não pelos pedidos.
    db.cliente.findMany({
      where: { organizacaoId, representanteId: id },
      orderBy: [{ ativo: "desc" }, { apelido: "asc" }],
      select: { id: true, apelido: true, municipio: true, uf: true, ativo: true },
    }),
  ]);

  const preposto = todos.find((p) => p.id === id);
  if (!preposto) return null;

  return { preposto, competencia, recentes, clientes };
}
