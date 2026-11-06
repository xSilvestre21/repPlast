/**
 * A tampa de uma linha de pedido ou de proposta: quem fornece e o código.
 *
 * O conjunto é vendido e comissionado pela indústria do frasco ou da bombona; a
 * tampa pode vir de outra, e isso é anotação de quem compra. Por isso aparece na
 * tela e nunca no PDF.
 *
 * Serve às duas ações gêmeas (`pedidos/acoes.ts`, `orcamentos/acoes.ts`): os dois
 * itens têm as mesmas colunas.
 */

import type { DbOrganizacao } from "./db";
import { ErroDeCampo } from "./erro-formulario";
import { soIndustriasMarcadas } from "./industrias-do-ator";

type Ator = { organizacaoId: string; usuarioId: string; ehAdmin: boolean };

/** O que a linha guarda da tampa. Nome e código ficam congelados, como a descrição. */
export type TampaGravada = {
  fornecedorTampaId: string | null;
  fornecedorTampaNome: string | null;
  codigoTampa: string | null;
};

/** O que a tabela de itens mostra embaixo da descrição. */
export type TampaDaLinha = {
  /** A linha escolhe o fornecedor: o do produto varia a cada compra. */
  variavel: boolean;
  fornecedorId: string | null;
  fornecedorNome: string | null;
  codigo: string | null;
};

const campoDaEscolha = (formData: FormData) =>
  String(formData.get("fornecedorTampaId") ?? "").trim();

/**
 * Confere a indústria escolhida, com a mesma regra da lista: do escritório, ativa e
 * liberada para quem lança.
 */
async function industriaEscolhida(db: DbOrganizacao, ator: Ator, id: string) {
  const fornecedor = await db.fornecedor.findFirst({
    where: { id, organizacaoId: ator.organizacaoId, ativo: true, ...soIndustriasMarcadas(ator) },
    select: { id: true, nome: true },
  });

  if (!fornecedor) {
    throw new ErroDeCampo(
      "fornecedorTampaId",
      "Esta indústria não pode ser escolhida: ela pode ter sido inativada. Escolha outra na lista.",
    );
  }
  return fornecedor;
}

/**
 * A tampa ao lançar um produto: a do cadastro, ou, no fornecedor variável, a
 * escolhida ao lado do produto.
 *
 * `obrigatorio` é do pedido, que é a compra. A proposta ainda é conversa: ali a
 * escolha pode ficar para quando ela virar pedido.
 */
export async function tampaDoItem(
  db: DbOrganizacao,
  ator: Ator,
  produto: {
    fornecedorTampaId: string | null;
    fornecedorTampaVariavel: boolean;
    codigoTampa: string | null;
    fornecedorTampa: { nome: string } | null;
  },
  formData: FormData,
  { obrigatorio }: { obrigatorio: boolean },
): Promise<TampaGravada> {
  const { codigoTampa } = produto;

  if (!produto.fornecedorTampaVariavel) {
    return {
      fornecedorTampaId: produto.fornecedorTampaId,
      fornecedorTampaNome: produto.fornecedorTampa?.nome ?? null,
      codigoTampa,
    };
  }

  const id = campoDaEscolha(formData);
  if (!id) {
    if (obrigatorio) {
      throw new ErroDeCampo(
        "fornecedorTampaId",
        "Este produto tem fornecedor da tampa variável. Escolha quem fornece a tampa neste pedido.",
      );
    }
    return { fornecedorTampaId: null, fornecedorTampaNome: null, codigoTampa };
  }

  const fornecedor = await industriaEscolhida(db, ator, id);
  return { fornecedorTampaId: fornecedor.id, fornecedorTampaNome: fornecedor.nome, codigoTampa };
}

/** A tampa de uma linha feita de conta: a conta não tem código. */
export async function tampaDaConta(
  db: DbOrganizacao,
  ator: Ator,
  fornecedorTampaId: string,
): Promise<TampaGravada> {
  if (!fornecedorTampaId) {
    return { fornecedorTampaId: null, fornecedorTampaNome: null, codigoTampa: null };
  }

  const fornecedor = await industriaEscolhida(db, ator, fornecedorTampaId);
  return { fornecedorTampaId: fornecedor.id, fornecedorTampaNome: fornecedor.nome, codigoTampa: null };
}

/**
 * O que gravar ao salvar a linha: nada, se ela não escolhe fornecedor ou se a
 * escolha não mudou.
 *
 * Comparar antes de conferir é o que deixa salvar a quantidade de uma linha cuja
 * indústria foi inativada depois, ou que não está marcada para este preposto.
 */
export async function trocaDeTampa(
  db: DbOrganizacao,
  ator: Ator,
  item: { fornecedorTampaId: string | null },
  variavel: boolean,
  formData: FormData,
): Promise<Pick<TampaGravada, "fornecedorTampaId" | "fornecedorTampaNome"> | object> {
  if (!variavel || !formData.has("fornecedorTampaId")) return {};

  const id = campoDaEscolha(formData);
  if (id === (item.fornecedorTampaId ?? "")) return {};
  if (!id) return { fornecedorTampaId: null, fornecedorTampaNome: null };

  const fornecedor = await industriaEscolhida(db, ator, id);
  return { fornecedorTampaId: fornecedor.id, fornecedorTampaNome: fornecedor.nome };
}

/** A tampa como a tabela de itens a mostra. Sem nada a dizer, a linha fica como era. */
export function tampaParaTela(item: TampaGravada, variavel: boolean): TampaDaLinha | undefined {
  if (!variavel && !item.fornecedorTampaNome && !item.codigoTampa) return undefined;

  return {
    variavel,
    fornecedorId: item.fornecedorTampaId,
    fornecedorNome: item.fornecedorTampaNome,
    codigo: item.codigoTampa,
  };
}
