"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { normalizarCep, normalizarDocumento, normalizarTelefone } from "@/lib/mascara";
import { lerNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

async function contexto() {
  return escopoAtual();
}

/** Lê um percentual do formulário, exigindo que fique entre 0 e 100. */
function lerPercentual(valor: FormDataEntryValue | null, rotulo: string): number {
  const numero = lerNumeroBr(valor) ?? 0;

  if (numero < 0 || numero > 100) {
    throw new Error(`${rotulo} precisa ficar entre 0 e 100.`);
  }
  return numero;
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

function lerEmails(valor: FormDataEntryValue | null): string[] {
  const texto = typeof valor === "string" ? valor : "";

  return texto
    .split(/[,;\n]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function dadosDoFormulario(formData: FormData) {
  const nome = lerTexto(formData.get("nome"));
  if (!nome) throw new Error("O nome da indústria é obrigatório.");

  const emails = lerEmails(formData.get("emailsPedido"));
  const invalido = emails.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (invalido) throw new Error(`E-mail inválido: ${invalido}`);

  const uf = lerTexto(formData.get("uf"));
  if (uf && uf.length !== 2) throw new Error("A UF precisa ter duas letras.");

  const email = lerTexto(formData.get("email"));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("O e-mail não parece um e-mail válido.");
  }

  const fatorKgPadrao = lerNumeroBr(formData.get("fatorKgPadrao"));

  // Mesma normalização do cadastro de cliente: a máscara do campo é conforto de
  // digitação, e é aqui que o formato gravado é decidido.
  const cnpj = lerTexto(formData.get("cnpj"));
  const cep = lerTexto(formData.get("cep"));
  const telefone = lerTexto(formData.get("telefone"));

  return {
    nome,
    razaoSocial: lerTexto(formData.get("razaoSocial")),
    cnpj: cnpj === null ? null : normalizarDocumento(cnpj),
    endereco: lerTexto(formData.get("endereco")),
    bairro: lerTexto(formData.get("bairro")),
    cep: cep === null ? null : normalizarCep(cep),
    municipio: lerTexto(formData.get("municipio")),
    uf: uf ? uf.toUpperCase() : null,
    telefone: telefone === null ? null : normalizarTelefone(telefone),
    email,
    emailsPedido: emails,
    ipiPercentual: lerPercentual(formData.get("ipiPercentual"), "O IPI"),
    comissaoPercentual: lerPercentual(formData.get("comissaoPercentual"), "A comissão"),
    fatorKgPadrao: fatorKgPadrao === null ? null : String(fatorKgPadrao),
  } as const;
}

export async function criarFornecedor(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, db } = await contexto();
    const dados = dadosDoFormulario(formData);

    const fornecedor = await db.fornecedor.create({ data: { organizacaoId, ...dados } });
    destino = `/fornecedores/${fornecedor.id}`;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/fornecedores");
  redirect(destino);
}

export async function atualizarFornecedor(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();
    const dados = dadosDoFormulario(formData);

    // Filtro explícito de tenant, mesmo com RLS ativo — ver src/lib/db.ts.
    const { count } = await db.fornecedor.updateMany({
      where: { id, organizacaoId },
      data: dados,
    });

    if (count === 0) return { erro: "Indústria não encontrada." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${id}`);
  return {};
}

export async function excluirFornecedor(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const emUso = await db.produto.count({ where: { fornecedorId: id, organizacaoId } });
  if (emUso > 0) {
    throw new Error(
      `Esta indústria tem ${emUso} produto(s) cadastrado(s) e não pode ser excluída.`,
    );
  }

  await db.fornecedor.deleteMany({ where: { id, organizacaoId } });

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

/* -------------------------------------------------------------------------- */
/* Logo da indústria                                                          */
/* -------------------------------------------------------------------------- */

const LIMITE_LOGO = 2 * 1024 * 1024;

/**
 * Descobre o tipo da imagem pelos BYTES, e não pelo que o navegador declarou.
 *
 * O arquivo volta a ser servido pela rota `/fornecedores/[id]/logo`, então
 * confiar no `type` enviado pelo cliente seria deixar alguém escolher o
 * Content-Type de uma resposta nossa. Também é o que impede subir um SVG (que
 * pode conter script) travestido de PNG.
 */
function detectarTipoImagem(bytes: Uint8Array): string | null {
  const comeca = (...assinatura: number[]) =>
    assinatura.every((valor, indice) => bytes[indice] === valor);

  if (comeca(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (comeca(0xff, 0xd8, 0xff)) return "image/jpeg";

  // WebP: "RIFF" .... "WEBP"
  if (comeca(0x52, 0x49, 0x46, 0x46)) {
    const marca = String.fromCharCode(...bytes.slice(8, 12));
    if (marca === "WEBP") return "image/webp";
  }

  return null;
}

export async function salvarLogo(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const arquivo = formData.get("logo");
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { erro: "Escolha um arquivo de imagem." };
    }

    if (arquivo.size > LIMITE_LOGO) {
      return { erro: "A imagem passa de 2 MB. Reduza antes de enviar." };
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const tipo = detectarTipoImagem(bytes);

    if (!tipo) {
      return { erro: "Formato não reconhecido. Envie PNG, JPEG ou WebP." };
    }

    const { count } = await db.fornecedor.updateMany({
      where: { id: fornecedorId, organizacaoId },
      data: { logo: bytes, logoTipo: tipo },
    });

    if (count === 0) return { erro: "Indústria não encontrada." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível enviar o logo." };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerLogo(fornecedorId: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  await db.fornecedor.updateMany({
    where: { id: fornecedorId, organizacaoId },
    data: { logo: null, logoTipo: null },
  });

  revalidatePath(`/fornecedores/${fornecedorId}`);
}

/* -------------------------------------------------------------------------- */
/* Aditivos                                                                   */
/* -------------------------------------------------------------------------- */

export async function adicionarAditivo(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const nome = lerTexto(formData.get("nome"));
    if (!nome) return { erro: "Informe o nome do aditivo." };

    const sufixoDescricao = lerTexto(formData.get("sufixoDescricao"));
    if (!sufixoDescricao) return { erro: "Informe o sufixo que aparece na descrição." };

    const valor = lerNumeroBr(formData.get("valor"));
    if (valor === null || valor < 0) return { erro: "Informe o valor somado pelo aditivo." };

    const TIPOS = ["POR_KG", "POR_MILHEIRO", "POR_METRO_LINEAR"] as const;
    const bruto = String(formData.get("tipo") ?? "");
    const tipo = TIPOS.find((t) => t === bruto) ?? "POR_KG";

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) return { erro: "Indústria não encontrada." };

    await db.aditivo.create({
      data: { fornecedorId, nome, sufixoDescricao, tipo, valor: String(valor) },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerAditivo(fornecedorId: string, formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const aditivoId = String(formData.get("aditivoId") ?? "");
  if (!aditivoId) return;

  const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
  if (pertence === 0) throw new Error("Indústria não encontrada.");

  const emUso = await db.produtoAditivo.count({ where: { aditivoId } });
  if (emUso > 0) {
    throw new Error(`Este aditivo está em ${emUso} produto(s) e não pode ser excluído.`);
  }

  await db.aditivo.deleteMany({ where: { id: aditivoId, fornecedorId } });

  revalidatePath(`/fornecedores/${fornecedorId}`);
}

/* -------------------------------------------------------------------------- */
/* Materiais                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cria ou atualiza um material da indústria.
 *
 * É UPSERT por (indústria, nome), e não um "criar" separado de um "editar",
 * porque esta é uma tabela de PREÇO: reajuste é a operação corrente, não a
 * exceção. Assim o mesmo formulário serve para cadastrar o PEAD e, meses
 * depois, corrigir o valor dele — e a chave única impede que o reajuste vire
 * uma segunda linha "PEAD" competindo com a primeira.
 */
export async function salvarMaterial(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    // Maiúsculas porque é assim que o material sai impresso na descrição do
    // saco ("99x166x0,08 SF 13,50 PEAD") — e porque "PEAD" e "pead" seriam
    // dois materiais diferentes para a chave única.
    const nome = lerTexto(formData.get("nome"))?.toUpperCase() ?? null;
    if (!nome) return { erro: "Informe o nome do material." };

    const precoKg = lerNumeroBr(formData.get("precoKg"));
    if (precoKg === null || precoKg < 0) return { erro: "Informe o valor do quilo." };

    const precoMinimoKg = lerNumeroBr(formData.get("precoMinimoKg"));
    if (precoMinimoKg !== null && precoMinimoKg < 0) {
      return { erro: "O valor mínimo não pode ser negativo." };
    }
    /*
     * Mínimo acima do valor é dado que se contradiz: todo produto daquele
     * material nasceria avisando, e o aviso deixaria de querer dizer alguma
     * coisa. Quase sempre é o par de campos trocado na digitação.
     */
    if (precoMinimoKg !== null && precoMinimoKg > precoKg) {
      return { erro: "O valor mínimo não pode ser maior que o valor." };
    }

    const densidade = lerNumeroBr(formData.get("densidade"));
    if (densidade !== null && densidade < 0) return { erro: "A densidade não pode ser negativa." };

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) return { erro: "Indústria não encontrada." };

    await db.material.upsert({
      where: { fornecedorId_nome: { fornecedorId, nome } },
      create: {
        fornecedorId,
        nome,
        precoKg: String(precoKg),
        precoMinimoKg: precoMinimoKg === null ? null : String(precoMinimoKg),
        densidade: densidade === null ? null : String(densidade),
      },
      update: {
        precoKg: String(precoKg),
        precoMinimoKg: precoMinimoKg === null ? null : String(precoMinimoKg),
        densidade: densidade === null ? null : String(densidade),
      },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerMaterial(fornecedorId: string, formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const materialId = String(formData.get("materialId") ?? "");
  if (!materialId) return;

  const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
  if (pertence === 0) throw new Error("Indústria não encontrada.");

  /*
   * Não há checagem de "material em uso" como existe no aditivo, e é de
   * propósito: o produto guarda o material como TEXTO e o próprio fator kg.
   * Apagar a linha da tabela de preço não desfaz nada do que já foi cadastrado
   * — só deixa de sugerir aquele valor daqui para a frente.
   */
  await db.material.deleteMany({ where: { id: materialId, fornecedorId } });

  revalidatePath(`/fornecedores/${fornecedorId}`);
}

/* -------------------------------------------------------------------------- */
/* Quem atende esta indústria (plano Plus)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Define quais prepostos atendem esta indústria.
 *
 * Mora AQUI, e não no cadastro do preposto, porque a permissão é da indústria:
 * marcar a Ana em uma indústria é o mesmo ato que tirar o Bruno dela. Editando
 * pelo lado do preposto, esse segundo efeito aconteceria em silêncio, numa tela
 * onde o Bruno nem aparece.
 *
 * NENHUM marcado significa TODOS, e não ninguém — é a leitura permissiva da
 * tabela (ver `FornecedorPreposto` no schema). Marcar todos grava o mesmo que
 * não marcar nenhum, de propósito: as duas coisas querem dizer "é do escritório
 * inteiro", e guardar linha para isso só criaria trabalho ao inscrever o
 * próximo preposto.
 */
export async function definirPrepostosDaIndustria(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db, ehAdmin, plano } = await escopoAtual();

    if (!ehAdmin) return { erro: "Só o administrador do escritório define isso." };
    if (plano !== "PLUS") return { erro: "Prepostos fazem parte do plano Plus." };

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) return { erro: "Indústria não encontrada." };

    const prepostos = await db.usuario.findMany({
      where: { organizacaoId, papel: "REPRESENTANTE", ativo: true },
      select: { id: true },
    });

    const marcados = formData
      .getAll("usuarioId")
      .map((v) => String(v))
      .filter((id) => prepostos.some((p) => p.id === id));

    await db.fornecedorPreposto.deleteMany({ where: { fornecedorId } });

    if (marcados.length > 0 && marcados.length < prepostos.length) {
      await db.fornecedorPreposto.createMany({
        data: marcados.map((usuarioId) => ({ fornecedorId, usuarioId })),
      });
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  revalidatePath("/prepostos");
  return {};
}

/* -------------------------------------------------------------------------- */
/* Faixas de peso do material                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Substitui a escada de faixas de um material, de uma vez.
 *
 * Recebe a tabela inteira e regrava — em vez de adicionar e remover linha a
 * linha. Uma escada de preço se lê e se conserta como um bloco: mexer numa
 * faixa quase sempre significa mexer na vizinha, e salvar uma de cada vez
 * deixaria a tabela passando por estados que a indústria nunca praticou.
 */
export async function salvarFaixasDoMaterial(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const materialId = String(formData.get("materialId") ?? "");
    if (!materialId) return { erro: "Material não informado." };

    const material = await db.material.findFirst({
      where: { id: materialId, fornecedorId },
      select: { id: true },
    });
    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (!material || pertence === 0) return { erro: "Material não encontrado." };

    const de = formData.getAll("pesoDeKg").map(String);
    const ate = formData.getAll("pesoAteKg").map(String);
    const preco = formData.getAll("precoKg").map(String);

    const faixas: { pesoDeKg: string | null; pesoAteKg: string | null; precoKg: string }[] = [];

    for (let i = 0; i < preco.length; i++) {
      // Linha em branco é linha que a pessoa não preencheu, não erro.
      if (preco[i].trim() === "" && de[i]?.trim() === "" && ate[i]?.trim() === "") continue;

      const valor = lerNumeroBr(preco[i]);
      if (valor === null || valor < 0) return { erro: "Informe o preço de cada faixa." };

      const piso = de[i]?.trim() === "" ? null : lerNumeroBr(de[i]);
      const teto = ate[i]?.trim() === "" ? null : lerNumeroBr(ate[i]);

      if (piso !== null && piso < 0) return { erro: "O peso não pode ser negativo." };
      if (teto !== null && teto < 0) return { erro: "O peso não pode ser negativo." };
      if (piso !== null && teto !== null && piso > teto) {
        return { erro: "Há uma faixa que começa depois de terminar." };
      }

      faixas.push({
        pesoDeKg: piso === null ? null : String(piso),
        pesoAteKg: teto === null ? null : String(teto),
        precoKg: String(valor),
      });
    }

    await db.materialFaixa.deleteMany({ where: { materialId } });
    if (faixas.length > 0) {
      await db.materialFaixa.createMany({
        data: faixas.map((f) => ({ materialId, ...f })),
      });
    }
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar." };
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}
