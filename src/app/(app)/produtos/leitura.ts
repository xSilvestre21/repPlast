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

import type { Familia, UnidadeVenda } from "@/generated/prisma/enums";
import { ErroDeCampo } from "@/lib/erro-formulario";
import { escreverNumeroBr, exigirNumero } from "@/lib/numero-br";

export function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

/**
 * Como cada medida aparece na frase de erro — com artigo, para a concordância
 * sair certa ("Informe a largura", "O fator kg precisa ser maior que zero") —
 * e um exemplo do que se espera ali.
 *
 * Antes a frase era montada de um rótulo solto, e saía "A largura é
 * obrigatório" e "A densidade não pode ser negativo". Além disso, texto que
 * não era número ("abc") era lido como campo vazio: num campo opcional, o
 * valor sumia sem aviso.
 */
const MEDIDAS = {
  larguraCm: { rotulo: "a largura", exemplo: "30" },
  comprimentoCm: { rotulo: "o comprimento", exemplo: "40" },
  espessuraMm: { rotulo: "a espessura", exemplo: "0,08" },
  fatorKg: { rotulo: "o fator kg", exemplo: "13,50" },
  densidade: { rotulo: "a densidade", exemplo: "0,92" },
  precoUnidade: { rotulo: "o preço por unidade", exemplo: "4,50" },
  precoCaixa: { rotulo: "o preço da caixa", exemplo: "180,00" },
  unidadesPorCaixa: { rotulo: "a quantidade de unidades por caixa", exemplo: "36" },
  larguraMm: { rotulo: "a largura", exemplo: "48" },
  metragemM: { rotulo: "a metragem", exemplo: "100" },
  micragem: { rotulo: "a micragem", exemplo: "45" },
  precoAvulso: { rotulo: "o preço", exemplo: "12,50" },
  precoKg: { rotulo: "o preço por quilo", exemplo: "14,00" },
} as const;

type Medida = keyof typeof MEDIDAS;

/** Lê uma medida opcional: vazia é `null`, abaixo de zero é recusada. */
function lerMedida(formData: FormData, campo: Medida, inteiro = false): string | null {
  const { rotulo, exemplo } = MEDIDAS[campo];
  const numero = exigirNumero(formData, campo, rotulo, { min: 0, inteiro, exemplo });
  return numero === null ? null : String(numero);
}

/** Lê uma medida obrigatória e maior que zero. */
function lerMedidaObrigatoria(formData: FormData, campo: Medida): string {
  const { rotulo, exemplo } = MEDIDAS[campo];
  const numero = exigirNumero(formData, campo, rotulo, { obrigatorio: true, min: 0, exemplo });

  if (numero === 0) {
    const Rotulo = rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
    throw new ErroDeCampo(
      campo,
      `${Rotulo} precisa ser maior que zero — como ${exemplo}. Confira se não faltou um número.`,
    );
  }
  return String(numero);
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
  if (!familia) {
    throw new ErroDeCampo("familia", "Escolha que tipo de produto é: saco, fita, stretch, bobina ou avulso.");
  }

  const fornecedorId = lerTexto(formData.get("fornecedorId"));
  if (!fornecedorId) {
    throw new ErroDeCampo("fornecedorId", "Escolha a indústria que fabrica este produto.");
  }

  const descricao = lerTexto(formData.get("descricao"));
  if (!descricao) {
    throw new ErroDeCampo(
      "descricao",
      "Informe a descrição — é o texto que sai impresso no pedido para a indústria.",
    );
  }

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
      larguraCm: lerMedidaObrigatoria(formData, "larguraCm"),
      comprimentoCm: lerMedidaObrigatoria(formData, "comprimentoCm"),
      espessuraMm: lerMedidaObrigatoria(formData, "espessuraMm"),
      fatorKg: lerMedidaObrigatoria(formData, "fatorKg"),
      // Opcional: vazia, o motor usa DENSIDADE_PADRAO — que é o divisor 10 de
      // antes, e o que mantém produto antigo valendo o mesmo.
      densidade: lerMedida(formData, "densidade"),
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
    const precoUnidade = lerMedida(formData, "precoUnidade");
    const precoCaixa = lerMedida(formData, "precoCaixa");

    if (precoUnidade === null && precoCaixa === null) {
      throw new ErroDeCampo(
        "precoUnidade",
        "Informe pelo menos um preço: o da unidade, o da caixa, ou os dois.",
      );
    }

    const unidades = lerMedida(formData, "unidadesPorCaixa", true);

    return {
      ...comum,
      larguraMm: lerMedida(formData, "larguraMm"),
      metragemM: lerMedida(formData, "metragemM"),
      micragem: lerMedida(formData, "micragem"),
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
    if (!unidadeAvulsa) {
      throw new ErroDeCampo(
        "unidadeAvulsa",
        "Escolha como este produto é vendido: por milheiro, quilo, unidade ou caixa.",
      );
    }

    return {
      ...comum,
      unidadeAvulsa,
      precoAvulso: lerMedidaObrigatoria(formData, "precoAvulso"),
      larguraMm: lerMedida(formData, "larguraMm"),
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
    precoKg: lerMedidaObrigatoria(formData, "precoKg"),
    larguraMm: lerMedida(formData, "larguraMm"),
    micragem: lerMedida(formData, "micragem"),
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

/** O que a linha da proposta guarda e que serve de começo de conta. */
type LinhaSemConta = {
  familia: Familia;
  unidade: UnidadeVenda;
  precoUnitario: { toString(): string };
};

/**
 * A conta de uma linha que não guardou nenhuma — a que veio do SICOV, onde a
 * proposta tinha só descrição e preço.
 *
 * Medida não há de onde tirar; o que dá é a família e o preço, no campo que
 * responde por ele na unidade da linha (o espelho de `precoUnitario`). O saco
 * por milheiro fica sem: ali o preço sai da conta das medidas, e o que a
 * proposta cobrou volta a aparecer quando elas forem digitadas.
 */
export function contaDaLinha(linha: LinhaSemConta): Conta {
  const conta: Conta = {
    ...(Object.fromEntries(CAMPOS_DA_CONTA.map((campo) => [campo, ""])) as Record<
      (typeof CAMPOS_DA_CONTA)[number],
      string
    >),
    familia: linha.familia,
    unidadeAvulsa: "UN",
    aditivos: [],
  };
  const preco = escreverNumeroBr(linha.precoUnitario.toString(), 2);

  switch (linha.familia) {
    case "SACO":
      conta.unidadeRotulo = linha.unidade;
      if (linha.unidade === "KG") conta.fatorKg = preco;
      break;
    case "FITA":
      if (linha.unidade === "CX") conta.precoCaixa = preco;
      else conta.precoUnidade = preco;
      break;
    case "AVULSO":
      conta.unidadeAvulsa = linha.unidade;
      conta.precoAvulso = preco;
      break;
    default:
      conta.precoKg = preco;
  }

  return conta;
}

type Coluna = { toString(): string } | null;

/** As colunas do produto que formam a conta. */
type ProdutoDaConta = {
  familia: Familia;
  material: string | null;
  complemento: string | null;
  unidadeRotulo: string | null;
  larguraCm: Coluna;
  comprimentoCm: Coluna;
  espessuraMm: Coluna;
  densidade: Coluna;
  sanfona: string | null;
  fatorKg: Coluna;
  larguraMm: Coluna;
  metragemM: Coluna;
  micragem: Coluna;
  unidadesPorCaixa: number | null;
  precoUnidade: Coluna;
  precoCaixa: Coluna;
  precoKg: Coluna;
  unidadeAvulsa: string | null;
  precoAvulso: Coluna;
  aditivos: string[];
};

/**
 * O produto de volta a conta — o caminho inverso do "cadastrar todos".
 *
 * É o que deixa apagar o cliente sem perder a proposta: o produto dele some, a
 * linha volta a ser conta com as mesmas medidas e, se o cliente for cadastrado
 * de novo, "Cadastrar todos os produtos" refaz o produto sem redigitar. Os
 * textos saem como na ficha do produto, para a releitura dar o mesmo número.
 */
export function contaDoProduto(produto: ProdutoDaConta): Conta {
  const campo = (valor: Coluna, casas?: number) =>
    valor === null ? "" : escreverNumeroBr(valor.toString(), casas);

  return {
    familia: produto.familia,
    material: produto.material ?? "",
    complemento: produto.complemento ?? "",
    unidadeRotulo: produto.unidadeRotulo ?? "",
    larguraCm: campo(produto.larguraCm),
    comprimentoCm: campo(produto.comprimentoCm),
    espessuraMm: campo(produto.espessuraMm),
    densidade: campo(produto.densidade),
    sanfona: produto.sanfona ?? "",
    fatorKg: campo(produto.fatorKg, 2),
    larguraMm: campo(produto.larguraMm),
    metragemM: campo(produto.metragemM),
    micragem: campo(produto.micragem),
    unidadesPorCaixa: produto.unidadesPorCaixa?.toString() ?? "",
    precoUnidade: campo(produto.precoUnidade, 2),
    precoCaixa: campo(produto.precoCaixa, 2),
    precoKg: campo(produto.precoKg, 2),
    unidadeAvulsa: produto.unidadeAvulsa ?? "UN",
    precoAvulso: campo(produto.precoAvulso, 2),
    aditivos: produto.aditivos,
  };
}
