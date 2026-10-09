import "server-only";

import type { DbOrganizacao } from "@/lib/db";
import { ErroDeCampo } from "@/lib/erro-formulario";

/** Teto do `Int` do Postgres menos um: o contador guarda o PRÓXIMO, ultimo + 1. */
const MAIOR_ULTIMO = 2_147_483_646;

const numeroBr = (n: number) => n.toLocaleString("pt-BR");

/**
 * Lê o "último pedido emitido" do formulário da indústria. Vazio vale 0 — a
 * indústria nova, cujo primeiro pedido sai com o nº 1.
 */
export function lerUltimoNumeroPedido(
  valor: FormDataEntryValue | null,
  campo = "ultimoNumeroPedido",
): number {
  const digitado = typeof valor === "string" ? valor.trim() : "";
  const texto = digitado.replace(/\./g, "");
  if (texto === "") return 0;

  if (!/^\d+$/.test(texto)) {
    throw new ErroDeCampo(
      campo,
      `Não reconheci "${digitado}" como número de pedido. Digite só números, sem letras nem vírgula — como 2256.`,
    );
  }
  if (Number(texto) > MAIOR_ULTIMO) {
    throw new ErroDeCampo(campo, `Esse número é grande demais. O maior aceito é ${numeroBr(MAIOR_ULTIMO)}.`);
  }
  return Number(texto);
}

/**
 * Troca o ponto de onde a numeração de pedidos de UMA indústria continua.
 *
 * Quem assina vindo de outro sistema já tem uma sequência com cada indústria, e
 * o próximo pedido daqui precisa seguir dela. A numeração é por indústria: o
 * mesmo número em outra não atrapalha.
 *
 * Recusa voltar o contador para trás de qualquer pedido que já existe — não só
 * do número digitado: o contador anda de um em um e chegaria nele adiante.
 * Pedido cancelado conta, porque continua com o número; excluído, não.
 *
 * `ultimoVisto` é o valor que a ficha mostrava ao abrir. A gravação só acerta
 * se o contador ainda estiver ali — um pedido lançado nesse meio-tempo já o
 * moveu, e gravar por cima faria o próximo repetir o número desse pedido.
 * Mesmo padrão de `excluirPedido`.
 */
export async function definirUltimoNumeroPedido(
  db: DbOrganizacao,
  numeracao: {
    organizacaoId: string;
    fornecedorId: string;
    ultimoVisto: number;
    novoUltimo: number;
  },
): Promise<{ erro?: string }> {
  const { organizacaoId, fornecedorId, ultimoVisto, novoUltimo } = numeracao;

  if (!Number.isInteger(novoUltimo) || novoUltimo < 0 || novoUltimo > MAIOR_ULTIMO) {
    return { erro: "Informe um número inteiro, de 0 em diante — como 2256." };
  }

  const filtroAcima = { organizacaoId, fornecedorId, numero: { gt: novoUltimo } };
  const [maior, acima] = await Promise.all([
    db.pedido.findFirst({
      where: filtroAcima,
      orderBy: { numero: "desc" },
      select: { numero: true, criadoEm: true },
    }),
    db.pedido.count({ where: filtroAcima }),
  ]);

  if (maior) {
    const data = maior.criadoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const quais =
      acima === 1
        ? `Já existe um pedido desta indústria com número acima de ${numeroBr(novoUltimo)}: o nº ${numeroBr(maior.numero)}, de ${data}.`
        : `Já existem ${acima} pedidos desta indústria com número acima de ${numeroBr(novoUltimo)}; o maior é o nº ${numeroBr(maior.numero)}, de ${data}.`;
    return {
      erro:
        `${quais} Para a numeração não se repetir, informe ${numeroBr(maior.numero)} ou um ` +
        `número maior. Se esse pedido foi lançado por engano e nunca foi enviado, exclua-o em ` +
        `Pedidos e salve de novo.`,
    };
  }

  const { count } = await db.fornecedor.updateMany({
    where: { id: fornecedorId, organizacaoId, proximoNumeroPedido: ultimoVisto + 1 },
    data: { proximoNumeroPedido: novoUltimo + 1 },
  });

  if (count === 0) {
    const atual = await db.fornecedor.findFirst({
      where: { id: fornecedorId, organizacaoId },
      select: { proximoNumeroPedido: true },
    });
    if (!atual) return { erro: "Indústria não encontrada." };
    return {
      erro:
        `Um pedido desta indústria foi lançado enquanto você editava — o último agora é o ` +
        `nº ${numeroBr(atual.proximoNumeroPedido - 1)}. Confira o número e salve de novo.`,
    };
  }

  return {};
}
