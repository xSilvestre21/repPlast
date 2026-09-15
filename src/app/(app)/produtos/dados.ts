import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import type { ClienteOpcao, FornecedorOpcao } from "./formulario";

/**
 * Indústrias com seus aditivos e materiais, para alimentar o formulário de
 * produto.
 *
 * Vêm junto porque o cálculo do preço acontece ao vivo no navegador enquanto o
 * usuário digita as medidas — sem ida ao servidor. Os materiais entram pelo
 * mesmo motivo: escolher "PEAD" precisa sugerir o fator kg na hora.
 */
export async function carregarFornecedores(): Promise<FornecedorOpcao[]> {
  const { organizacaoId, db } = await escopoAtual();

  const fornecedores = await db.fornecedor.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { nome: "asc" },
    include: {
      aditivos: { where: { ativo: true }, orderBy: { nome: "asc" } },
      materiais: { where: { ativo: true }, orderBy: { nome: "asc" } },
    },
  });

  return fornecedores.map((f) => ({
    id: f.id,
    nome: f.nome,
    fatorKgPadrao: f.fatorKgPadrao ? f.fatorKgPadrao.toString() : null,
    // Serve ao aviso de piso: abaixo do mínimo, o que encolhe é a comissão.
    comissaoPercentual: f.comissaoPercentual.toString(),
    aditivos: f.aditivos.map((a) => ({
      id: a.id,
      nome: a.nome,
      sufixoDescricao: a.sufixoDescricao,
      tipo: a.tipo,
      valor: a.valor.toString(),
    })),
    materiais: f.materiais.map((m) => ({
      nome: m.nome,
      precoKg: m.precoKg.toString(),
      precoMinimoKg: m.precoMinimoKg ? m.precoMinimoKg.toString() : null,
      densidade: m.densidade ? m.densidade.toString() : null,
    })),
  }));
}

/** Converte um Decimal do Prisma para o texto que o formulário exibe. */
export function paraCampo(valor: { toString(): string } | null | undefined, casas?: number) {
  return valor === null || valor === undefined ? "" : escreverNumeroBr(valor.toString(), casas);
}

/**
 * Clientes ativos, para o seletor de dono do produto.
 *
 * Só apelido e id: o formulário não precisa de mais nada, e mandar a ficha
 * inteira de 106 clientes para o navegador engordaria a página sem motivo.
 */
export async function carregarClientes(): Promise<ClienteOpcao[]> {
  const { organizacaoId, db } = await escopoAtual();

  const clientes = await db.cliente.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { apelido: "asc" },
    select: { id: true, apelido: true },
  });

  return clientes;
}
