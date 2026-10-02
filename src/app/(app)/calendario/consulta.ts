import { somarDias, type DataIso } from "@/lib/calendario";
import {
  colunaDoDia,
  diaDaColuna,
  eventoDeEntrega,
  eventoDeParcela,
  eventoDeSumido,
  type EventoAgenda,
  type Importancia,
} from "@/lib/agenda";
import type { DbOrganizacao } from "@/lib/db";

import { clientesComUltimaCompra } from "../graficos/consultas";

/**
 * O que o calendário lê do banco.
 *
 * Entregas, parcelas e clientes sumidos NÃO são copiados para uma tabela de
 * eventos: são lidos das tabelas de origem a cada vez. Assim um prazo de
 * entrega mudado no pedido muda no calendário na mesma hora, sem sincronizar
 * nada.
 *
 * O corte de quem vê o quê é do RLS: o preposto lê só os pedidos e clientes
 * dele (e os da casa), e só os compromissos dele e os compartilhados.
 */

/** O compromisso como a tela precisa — o evento e o que só ele tem. */
export interface CompromissoDaAgenda extends EventoAgenda {
  id: string;
  /** Só o autor conclui, edita e apaga (a policy recusaria de qualquer forma). */
  meu: boolean;
  autor: string;
  compartilhado: boolean;
  clienteId: string | null;
  cliente: string | null;
  anotacao: string | null;
  importancia: Importancia;
}

export interface AgendaDoIntervalo {
  compromissos: CompromissoDaAgenda[];
  automaticos: EventoAgenda[];
}

/**
 * Tudo entre `de` e `ate` (exclusive).
 *
 * `apenasDoPreposto` restringe pedidos e clientes à carteira do preposto: o
 * RLS deixaria passar os da casa, que no calendário dele seriam ruído — o mesmo
 * corte de `pedidosDaCompetencia`.
 */
export async function agendaDoIntervalo(
  db: DbOrganizacao,
  organizacaoId: string,
  intervalo: { de: DataIso; ate: DataIso },
  quem: { usuarioId: string; apenasDoPreposto: string | null; hoje: DataIso },
): Promise<AgendaDoIntervalo> {
  const faixa = { gte: colunaDoDia(intervalo.de), lt: colunaDoDia(intervalo.ate) };
  const doPreposto = quem.apenasDoPreposto ? { representanteId: quem.apenasDoPreposto } : {};

  const [compromissos, pedidos, parcelas, clientes] = await Promise.all([
    db.compromisso.findMany({
      where: { organizacaoId, data: faixa },
      orderBy: [{ data: "asc" }, { hora: "asc" }],
      select: {
        id: true,
        titulo: true,
        anotacao: true,
        data: true,
        hora: true,
        importancia: true,
        compartilhado: true,
        clienteId: true,
        concluidoEm: true,
        autorId: true,
        autor: { select: { nome: true } },
      },
    }),
    db.pedido.findMany({
      where: {
        organizacaoId,
        status: { not: "CANCELADO" },
        prazoEntrega: faixa,
        ...doPreposto,
      },
      select: {
        id: true,
        numero: true,
        prazoEntrega: true,
        entregueEm: true,
        cliente: { select: { apelido: true } },
      },
    }),
    db.parcelaRecebimento.findMany({
      where: {
        vencimento: faixa,
        pedido: { organizacaoId, status: { not: "CANCELADO" }, ...doPreposto },
      },
      select: {
        id: true,
        numero: true,
        vencimento: true,
        valorRecebido: true,
        comissaoPercentualRecebido: true,
        pedido: {
          select: {
            numero: true,
            cliente: { select: { apelido: true } },
            _count: { select: { parcelas: true } },
          },
        },
      },
    }),
    clientesComUltimaCompra(db, organizacaoId, quem.apenasDoPreposto),
  ]);

  /*
   * O nome do cliente vinculado vem numa consulta à parte: `cliente` é relação
   * OPCIONAL no compromisso, e o Prisma 7.10 encadeia consultas na mesma conexão
   * quando uma relação opcional entra no `select` (ver `comRepresentante`).
   * Cliente que o RLS esconde fica sem nome — o compromisso compartilhado do
   * colega pode citar um cliente da carteira dele.
   */
  const idsDeClientes = [...new Set(compromissos.map((c) => c.clienteId).filter((id) => id !== null))];
  const nomes = new Map(
    idsDeClientes.length
      ? (
          await db.cliente.findMany({
            where: { id: { in: idsDeClientes } },
            select: { id: true, apelido: true },
          })
        ).map((c) => [c.id, c.apelido])
      : [],
  );

  return {
    compromissos: compromissos.map((c) => ({
      chave: `compromisso:${c.id}`,
      tipo: "compromisso",
      id: c.id,
      dia: diaDaColuna(c.data),
      titulo: c.titulo,
      detalhe: c.clienteId ? (nomes.get(c.clienteId) ?? undefined) : undefined,
      href: undefined,
      hora: c.hora ?? undefined,
      importancia: c.importancia,
      situacao: c.concluidoEm ? "concluido" : undefined,
      meu: c.autorId === quem.usuarioId,
      autor: c.autor.nome,
      compartilhado: c.compartilhado,
      clienteId: c.clienteId,
      cliente: c.clienteId ? (nomes.get(c.clienteId) ?? null) : null,
      anotacao: c.anotacao,
    })),

    automaticos: [
      ...pedidos.map((p) =>
        eventoDeEntrega(
          {
            id: p.id,
            numero: p.numero,
            cliente: p.cliente.apelido,
            prazoEntrega: p.prazoEntrega!,
            entregueEm: p.entregueEm,
          },
          quem.hoje,
        ),
      ),
      ...parcelas.map((p) =>
        eventoDeParcela({
          id: p.id,
          numero: p.numero,
          total: p.pedido._count.parcelas,
          vencimento: p.vencimento,
          // Paga é a que tem o acerto inteiro — os dois campos, como em `acertoDoPedido`.
          pago: p.valorRecebido !== null && p.comissaoPercentualRecebido !== null,
          pedidoNumero: p.pedido.numero,
          cliente: p.pedido.cliente.apelido,
        }),
      ),
      ...clientes
        .filter((c) => c.ultimaCompra !== null)
        .map((c) => eventoDeSumido({ id: c.id, apelido: c.apelido, ultimaCompra: c.ultimaCompra! }))
        .filter((e) => e.dia >= intervalo.de && e.dia < intervalo.ate),
    ],
  };
}

/** O intervalo que a grade de um mês mostra: as seis semanas inteiras. */
export function intervaloDaGrade(semanas: DataIso[][]): { de: DataIso; ate: DataIso } {
  return { de: semanas[0][0], ate: somarDias(semanas.at(-1)!.at(-1)!, 1) };
}
