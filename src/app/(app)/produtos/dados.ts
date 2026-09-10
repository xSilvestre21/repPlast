import { dbParaOrganizacao } from "@/lib/db";
import { escreverNumeroBr } from "@/lib/numero-br";
import { organizacaoAtual } from "@/lib/sessao";

import type { FornecedorOpcao } from "./formulario";

/**
 * Indústrias com seus aditivos, para alimentar o formulário de produto.
 *
 * Os aditivos vêm junto porque o cálculo do preço acontece ao vivo no
 * navegador enquanto o usuário digita as medidas — sem ida ao servidor.
 */
export async function carregarFornecedores(): Promise<FornecedorOpcao[]> {
  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const fornecedores = await db.fornecedor.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { nome: "asc" },
    include: { aditivos: { where: { ativo: true }, orderBy: { nome: "asc" } } },
  });

  return fornecedores.map((f) => ({
    id: f.id,
    nome: f.nome,
    fatorKgPadrao: f.fatorKgPadrao ? f.fatorKgPadrao.toString() : null,
    aditivos: f.aditivos.map((a) => ({
      id: a.id,
      nome: a.nome,
      sufixoDescricao: a.sufixoDescricao,
      tipo: a.tipo,
      valor: a.valor.toString(),
    })),
  }));
}

/** Converte um Decimal do Prisma para o texto que o formulário exibe. */
export function paraCampo(valor: { toString(): string } | null | undefined, casas?: number) {
  return valor === null || valor === undefined ? "" : escreverNumeroBr(valor.toString(), casas);
}
