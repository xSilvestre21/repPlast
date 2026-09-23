/**
 * Leitura do formulário de produto — e da conta que vira produto.
 *
 * Mora fora de `acoes.ts` porque tem três leitores: o cadastro de produto, o
 * item por conta da proposta avulsa e o "cadastrar todos" que transforma essas
 * contas em produtos do cliente. Os três PRECISAM validar igual: uma conta
 * aceita na proposta e recusada no cadastro deixaria a proposta presa, sem
 * poder virar pedido.
 *
 * Sem `'use server'`: módulo puro, não expõe nada como ação.
 */

import type { Familia } from "@/generated/prisma/enums";
import { lerNumeroBr } from "@/lib/numero-br";

export function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/** Lê um número opcional, recusando valores negativos. */
function lerMedida(valor: FormDataEntryValue | null, rotulo: string): string | null {
  const numero = lerNumeroBr(valor);
  if (numero === null) return null;

  if (numero < 0) throw new Error(`${rotulo} não pode ser negativo.`);
  return String(numero);
}

/** Lê um número obrigatório e maior que zero. */
function lerMedidaObrigatoria(valor: FormDataEntryValue | null, rotulo: string): string {
  const medida = lerMedida(valor, rotulo);

  if (medida === null) throw new Error(`${rotulo} é obrigatório.`);
  if (Number(medida) === 0) throw new Error(`${rotulo} precisa ser maior que zero.`);

  return medida;
}

const FAMILIAS: Familia[] = ["SACO", "FITA", "STRETCH", "BOBINA", "AVULSO"];
const UNIDADES = ["MIL", "KG", "UN", "CX"] as const;

/**
 * Monta o produto a partir do formulário.
 *
 * A validação por família é a mesma que o banco impõe por CHECK
 * (migration `rls_e_checks`) — aqui ela existe para o usuário receber uma
 * mensagem legível em vez de um erro cru do Postgres.
 */
export function dadosDoFormulario(formData: FormData) {
  const familiaBruta = String(formData.get("familia") ?? "");
  const familia = FAMILIAS.find((f) => f === familiaBruta);
  if (!familia) throw new Error("Escolha a família do produto.");

  const fornecedorId = lerTexto(formData.get("fornecedorId"));
  if (!fornecedorId) throw new Error("Escolha a indústria.");

  const descricao = lerTexto(formData.get("descricao"));
  if (!descricao) throw new Error("A descrição é obrigatória.");

  const comum = {
    familia,
    fornecedorId,
    /*
     * De quem é este produto.
     *
     * Opcional porque o escritório também cadastra item de catálogo sem dono,
     * mas o caminho normal é ter um: o mesmo saco cotado para dois clientes é
     * dois produtos, com preço próprio cada um.
     */
    clienteId: lerTexto(formData.get("clienteId")),
    descricao,
    codigoFornecedor: lerTexto(formData.get("codigoFornecedor")),
    // O número que o CLIENTE usa, ao lado do número que a indústria usa. Vazio
    // é legítimo: nem todo cliente numera o que compra.
    codigoCliente: lerTexto(formData.get("codigoCliente")),
    material: lerTexto(formData.get("material")),
    complemento: lerTexto(formData.get("complemento")),
    unidadeRotulo: lerTexto(formData.get("unidadeRotulo")),
  };

  if (familia === "SACO") {
    return {
      ...comum,
      larguraCm: lerMedidaObrigatoria(formData.get("larguraCm"), "A largura"),
      comprimentoCm: lerMedidaObrigatoria(formData.get("comprimentoCm"), "O comprimento"),
      espessuraMm: lerMedidaObrigatoria(formData.get("espessuraMm"), "A espessura"),
      fatorKg: lerMedidaObrigatoria(formData.get("fatorKg"), "O fator kg"),
      // Opcional: vazia, o motor usa DENSIDADE_PADRAO — que é o divisor 10 de
      // antes, e o que mantém produto antigo valendo o mesmo.
      densidade: lerMedida(formData.get("densidade"), "A densidade"),
      sanfona: lerTexto(formData.get("sanfona")),
      // Campos das outras famílias ficam nulos.
      larguraMm: null,
      metragemM: null,
      micragem: null,
      unidadesPorCaixa: null,
      precoUnidade: null,
      precoCaixa: null,
      precoKg: null,
      unidadeAvulsa: null,
      precoAvulso: null,
    };
  }

  if (familia === "FITA") {
    const precoUnidade = lerMedida(formData.get("precoUnidade"), "O preço por unidade");
    const precoCaixa = lerMedida(formData.get("precoCaixa"), "O preço da caixa");

    if (precoUnidade === null && precoCaixa === null) {
      throw new Error("Informe o preço por unidade, o preço da caixa, ou os dois.");
    }

    const unidades = lerMedida(formData.get("unidadesPorCaixa"), "As unidades por caixa");

    return {
      ...comum,
      larguraMm: lerMedida(formData.get("larguraMm"), "A largura"),
      metragemM: lerMedida(formData.get("metragemM"), "A metragem"),
      micragem: lerMedida(formData.get("micragem"), "A micragem"),
      unidadesPorCaixa: unidades === null ? null : Math.round(Number(unidades)),
      precoUnidade,
      precoCaixa,
      larguraCm: null,
      comprimentoCm: null,
      espessuraMm: null,
      fatorKg: null,
      densidade: null,
      sanfona: null,
      precoKg: null,
      unidadeAvulsa: null,
      precoAvulso: null,
    };
  }

  if (familia === "AVULSO") {
    const bruta = String(formData.get("unidadeAvulsa") ?? "");
    const unidadeAvulsa = UNIDADES.find((u) => u === bruta);
    if (!unidadeAvulsa) throw new Error("Escolha a unidade de venda.");

    return {
      ...comum,
      unidadeAvulsa,
      precoAvulso: lerMedidaObrigatoria(formData.get("precoAvulso"), "O preço"),
      larguraMm: lerMedida(formData.get("larguraMm"), "A largura"),
      larguraCm: null,
      comprimentoCm: null,
      espessuraMm: null,
      fatorKg: null,
      densidade: null,
      sanfona: null,
      metragemM: null,
      micragem: null,
      unidadesPorCaixa: null,
      precoUnidade: null,
      precoCaixa: null,
      precoKg: null,
    };
  }

  // STRETCH e BOBINA: vendidos por quilo, sem cálculo dimensional.
  return {
    ...comum,
    precoKg: lerMedidaObrigatoria(formData.get("precoKg"), "O preço por quilo"),
    larguraMm: lerMedida(formData.get("larguraMm"), "A largura"),
    micragem: lerMedida(formData.get("micragem"), "A micragem"),
    larguraCm: null,
    comprimentoCm: null,
    espessuraMm: null,
    fatorKg: null,
    densidade: null,
    sanfona: null,
    metragemM: null,
    unidadesPorCaixa: null,
    precoUnidade: null,
    precoCaixa: null,
    unidadeAvulsa: null,
    precoAvulso: null,
  };
}

export function lerAditivos(formData: FormData): string[] {
  return formData.getAll("aditivos").map(String).filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* A conta da proposta avulsa                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Os campos do formulário de produto que formam a conta de um item.
 *
 * Ficam fora a indústria (é a da proposta), o cliente (ainda não existe), a
 * descrição (vive no próprio item) e os códigos (quem pede preço não tem).
 */
const CAMPOS_DA_CONTA = [
  "familia",
  "material",
  "complemento",
  "unidadeRotulo",
  "larguraCm",
  "comprimentoCm",
  "espessuraMm",
  "densidade",
  "sanfona",
  "fatorKg",
  "larguraMm",
  "metragemM",
  "micragem",
  "unidadesPorCaixa",
  "precoUnidade",
  "precoCaixa",
  "precoKg",
  "unidadeAvulsa",
  "precoAvulso",
] as const;

/**
 * A conta como foi DIGITADA — texto, com a vírgula de quem digitou.
 *
 * Guardar o texto e não o número lido é o que deixa reabri-la no Novo produto
 * exatamente como estava, e relê-la depois pelo mesmo `dadosDoFormulario`.
 */
export type Conta = Record<(typeof CAMPOS_DA_CONTA)[number], string> & { aditivos: string[] };

/** Recorta do formulário só o que é conta. */
export function contaDoFormulario(formData: FormData): Conta {
  const conta = Object.fromEntries(
    CAMPOS_DA_CONTA.map((campo) => [campo, lerTexto(formData.get(campo)) ?? ""]),
  ) as Record<(typeof CAMPOS_DA_CONTA)[number], string>;

  return { ...conta, aditivos: lerAditivos(formData) };
}

/**
 * Lê a conta gravada num item. `null` quando não há conta ou ela não tem forma
 * de conta — item de catálogo, ou JSON que alguém mexeu à mão.
 */
export function lerConta(valor: unknown): Conta | null {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) return null;
  const gravada = valor as Record<string, unknown>;

  const campos = Object.fromEntries(
    CAMPOS_DA_CONTA.map((campo) => {
      const texto = gravada[campo];
      return [campo, typeof texto === "string" ? texto : ""];
    }),
  ) as Record<(typeof CAMPOS_DA_CONTA)[number], string>;

  const aditivos = Array.isArray(gravada.aditivos)
    ? gravada.aditivos.filter((a): a is string => typeof a === "string")
    : [];

  return campos.familia ? { ...campos, aditivos } : null;
}

/**
 * Remonta o formulário de produto a partir de uma conta, para passar pelo
 * mesmo `dadosDoFormulario` do cadastro.
 */
export function formularioDaConta(
  conta: Conta,
  extras: { fornecedorId: string; clienteId?: string | null; descricao: string },
): FormData {
  const formData = new FormData();

  for (const campo of CAMPOS_DA_CONTA) formData.set(campo, conta[campo]);
  for (const aditivo of conta.aditivos) formData.append("aditivos", aditivo);

  formData.set("fornecedorId", extras.fornecedorId);
  formData.set("descricao", extras.descricao);
  if (extras.clienteId) formData.set("clienteId", extras.clienteId);

  return formData;
}
