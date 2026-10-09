"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emailValido } from "@/lib/envio-pedido";
import {
  ErroDeCampo,
  ErroParaUsuario,
  campoDaLinha,
  falhou,
  type EstadoFormulario,
} from "@/lib/erro-formulario";
import { definirUltimoNumeroPedido, lerUltimoNumeroPedido } from "@/lib/numeracao-pedido";
import { normalizarCep, normalizarDocumento, normalizarTelefone } from "@/lib/mascara";
import { exigirNumero, exigirNumeroDe } from "@/lib/numero-br";
import { escopoAtual, exigirAdmin } from "@/lib/sessao";

export type { EstadoFormulario };

/**
 * A indústria sumiu entre abrir a ficha e salvar — excluída em outra aba, ou
 * por outra pessoa do escritório.
 */
const INDUSTRIA_SUMIU =
  "Esta indústria não foi encontrada — ela pode ter sido excluída em outra tela. " +
  "Volte à lista de indústrias e confira.";

/** O e-mail que a pessoa digitou não tem cara de e-mail. */
const EMAIL_INCOMPLETO =
  "Este e-mail parece incompleto. Confira se tem o @ e o final, como compras@industria.com.br.";

/**
 * Cadastro de indústria — dados, logo, materiais, aditivos e contatos — é do
 * administrador: o preposto consulta, mas não cria, altera nem exclui. O banco
 * recusa de todo jeito (migration `cadastros_so_do_admin`); a checagem aqui é
 * para a mensagem ser legível.
 */
async function contexto() {
  await exigirAdmin();
  return escopoAtual();
}

/**
 * Lê um percentual do formulário, entre 0 e 100. Vazio é 0; texto que não é
 * número é recusado — antes, "abc" no IPI virava 0% gravado sem aviso.
 */
function lerPercentual(formData: FormData, campo: string, rotulo: string): number {
  return exigirNumero(formData, campo, rotulo, { min: 0, max: 100, exemplo: "3,25" }) ?? 0;
}

function lerTexto(valor: FormDataEntryValue | null): string | null {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto === "" ? null : texto;
}

function dadosDoFormulario(formData: FormData) {
  const nome = lerTexto(formData.get("nome"));
  if (!nome) {
    throw new ErroDeCampo("nome", "Informe o nome da indústria — é como ela aparece nos pedidos.");
  }

  const uf = lerTexto(formData.get("uf"));
  if (uf && uf.length !== 2) {
    throw new ErroDeCampo("uf", "A UF tem duas letras, como SP ou MG.");
  }

  const email = lerTexto(formData.get("email"));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ErroDeCampo("email", EMAIL_INCOMPLETO);
  }

  const fatorKgPadrao = exigirNumero(formData, "fatorKgPadrao", "o fator kg padrão", {
    min: 0,
    exemplo: "13,50",
  });

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
    ipiPercentual: lerPercentual(formData, "ipiPercentual", "o IPI"),
    comissaoPercentual: lerPercentual(formData, "comissaoPercentual", "a comissão"),
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

    // A indústria nova não tem pedido nenhum, então qualquer ponto de partida
    // serve: quem vem de outro sistema continua de onde parou lá.
    const ultimo = lerUltimoNumeroPedido(formData.get("ultimoNumeroPedido"));

    const fornecedor = await db.fornecedor.create({
      data: { organizacaoId, ...dados, proximoNumeroPedido: ultimo + 1 },
    });
    destino = `/fornecedores/${fornecedor.id}`;
  } catch (erro) {
    return falhou(erro, formData);
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

    // O contador só se mexe se o número foi trocado na ficha. Gravá-lo junto
    // com o resto a cada salvar voltaria para trás o pedido que um preposto
    // lançou enquanto o administrador corrigia o endereço.
    const ultimo = lerUltimoNumeroPedido(formData.get("ultimoNumeroPedido"));
    const ultimoVisto = lerUltimoNumeroPedido(
      formData.get("ultimoNumeroPedidoVisto"),
      "ultimoNumeroPedidoVisto",
    );
    if (ultimo !== ultimoVisto) {
      const { erro } = await definirUltimoNumeroPedido(db, {
        organizacaoId,
        fornecedorId: id,
        ultimoVisto,
        novoUltimo: ultimo,
      });
      if (erro) {
        // A ficha volta com o contador de agora — se outro pedido entrou no
        // meio, o próximo salvar já compara com o número certo.
        revalidatePath(`/fornecedores/${id}`);
        return falhou(new ErroDeCampo("ultimoNumeroPedido", erro), formData);
      }
    }

    // Filtro explícito de tenant, mesmo com RLS ativo — ver src/lib/db.ts.
    const { count } = await db.fornecedor.updateMany({
      where: { id, organizacaoId },
      data: dados,
    });

    if (count === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${id}`);
  // De volta à ficha em LEITURA, e não à lista como no cliente: aqui embaixo
  // ainda moram contatos, logo, materiais e aditivos, e quem acabou de mexer
  // nos dados quase sempre quer conferir o resto da mesma indústria.
  redirect(`/fornecedores/${id}`);
}

export async function excluirFornecedor(
  id: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const emUso = await db.produto.count({ where: { fornecedorId: id, organizacaoId } });
    if (emUso > 0) {
      const quantos = emUso === 1 ? "1 produto cadastrado" : `${emUso} produtos cadastrados`;
      throw new ErroParaUsuario(
        `Esta indústria tem ${quantos} e não pode ser excluída. Se você não a representa mais, ` +
          `use “Marcar como inativa”: ela sai das listas e continua nos pedidos antigos.`,
      );
    }

    await db.fornecedor.deleteMany({ where: { id, organizacaoId } });
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

/**
 * Liga e desliga a indústria.
 *
 * Inativar, e não apagar: a representação que acabou continua nos pedidos,
 * propostas e comissões de meses fechados — e indústria com produto nem pode
 * ser excluída. Inativa, ela sai das escolhas de novo pedido, nova proposta e
 * novo produto (que já filtram `ativo`) e da lista padrão, e volta com um
 * clique se a representação voltar.
 */
async function gravarAlternarAtivoFornecedor(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contexto();

  const fornecedor = await db.fornecedor.findFirst({
    where: { id, organizacaoId },
    select: { ativo: true },
  });
  if (!fornecedor) throw new ErroParaUsuario(INDUSTRIA_SUMIU);

  await db.fornecedor.updateMany({
    where: { id, organizacaoId },
    data: { ativo: !fornecedor.ativo },
  });

  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${id}`);
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
      throw new ErroDeCampo("logo", "Escolha a imagem do logo antes de salvar.");
    }

    if (arquivo.size > LIMITE_LOGO) {
      const mb = (arquivo.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
      throw new ErroDeCampo(
        "logo",
        `Esta imagem tem ${mb} MB, e o limite é 2 MB. Diminua o tamanho dela — salvar como JPEG ` +
          `ou recortar as bordas costuma bastar — e envie de novo.`,
      );
    }

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const tipo = detectarTipoImagem(bytes);

    if (!tipo) {
      throw new ErroDeCampo(
        "logo",
        "Este arquivo não é uma imagem que o sistema aceita. Envie o logo em PNG, JPEG ou WebP — " +
          "se ele estiver em PDF ou SVG, abra o arquivo e salve como PNG.",
      );
    }

    const { count } = await db.fornecedor.updateMany({
      where: { id: fornecedorId, organizacaoId },
      data: { logo: bytes, logoTipo: tipo },
    });

    if (count === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);
  } catch (erro) {
    return falhou(erro);
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
    if (!nome) throw new ErroDeCampo("nome", "Informe o nome do aditivo, como Deslizante.");

    const sufixoDescricao = lerTexto(formData.get("sufixoDescricao"));
    if (!sufixoDescricao) {
      throw new ErroDeCampo(
        "sufixoDescricao",
        "Informe o texto que entra no fim da descrição do produto, como C/ DESLIZANTE.",
      );
    }

    const valor = exigirNumero(formData, "valor", "o valor somado", {
      obrigatorio: true,
      min: 0,
      exemplo: "2,10",
    });

    const TIPOS = ["POR_KG", "POR_MILHEIRO", "POR_METRO_LINEAR"] as const;
    const bruto = String(formData.get("tipo") ?? "");
    const tipo = TIPOS.find((t) => t === bruto) ?? "POR_KG";

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);

    await db.aditivo.create({
      data: { fornecedorId, nome, sufixoDescricao, tipo, valor: String(valor) },
    });
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerAditivo(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const aditivoId = String(formData.get("aditivoId") ?? "");
    if (!aditivoId) return {};

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);

    const emUso = await db.produtoAditivo.count({ where: { aditivoId } });
    if (emUso > 0) {
      const quantos = emUso === 1 ? "1 produto" : `${emUso} produtos`;
      throw new ErroParaUsuario(
        `Este aditivo está em ${quantos} e não pode ser removido. Tire-o desses produtos antes.`,
      );
    }

    await db.aditivo.deleteMany({ where: { id: aditivoId, fornecedorId } });
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
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
    if (!nome) throw new ErroDeCampo("nome", "Informe o tipo do material, como PEAD.");

    const precoKg = exigirNumero(formData, "precoKg", "o valor do quilo", {
      obrigatorio: true,
      min: 0,
      exemplo: "14,00",
    });

    const precoMinimoKg = exigirNumero(formData, "precoMinimoKg", "o valor mínimo", {
      min: 0,
      exemplo: "12,00",
    });
    /*
     * Mínimo acima do valor é dado que se contradiz: todo produto daquele
     * material nasceria avisando, e o aviso deixaria de querer dizer alguma
     * coisa. Quase sempre é o par de campos trocado na digitação.
     */
    if (precoMinimoKg !== null && precoMinimoKg > precoKg) {
      throw new ErroDeCampo(
        "precoMinimoKg",
        "O valor mínimo está maior que o valor do quilo. Confira se os dois não foram " +
          "trocados — o mínimo é o menor preço que a indústria aceita.",
      );
    }

    const densidade = exigirNumero(formData, "densidade", "a densidade", {
      min: 0,
      exemplo: "0,92",
    });

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);

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
    return falhou(erro, formData);
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

export async function removerMaterial(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const materialId = String(formData.get("materialId") ?? "");
    if (!materialId) return {};

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);

  /*
   * Não há checagem de "material em uso" como existe no aditivo, e é de
   * propósito: o produto guarda o material como TEXTO e o próprio fator kg.
   * Apagar a linha da tabela de preço não desfaz nada do que já foi cadastrado
   * — só deixa de sugerir aquele valor daqui para a frente.
   */
    await db.material.deleteMany({ where: { id: materialId, fornecedorId } });
  } catch (erro) {
    return falhou(erro);
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

/* -------------------------------------------------------------------------- */
/* Quem atende esta indústria (plano Plus)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Define quais prepostos atendem esta indústria.
 *
 * Grava exatamente o que foi marcado: o preposto desmarcado deixa de ver a
 * indústria, e nenhum marcado quer dizer nenhum (ver `FornecedorPreposto` no
 * schema). O mesmo vínculo se edita pela ficha do preposto.
 *
 * Só os prepostos ATIVOS aparecem na tela, e por isso só os deles se regravam:
 * apagar tudo levaria junto o vínculo de quem está sem acesso, e ele voltaria
 * sem indústria nenhuma no dia em que o acesso fosse devolvido.
 */
export async function definirPrepostosDaIndustria(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db, ehAdmin, plano } = await escopoAtual();

    if (!ehAdmin) {
      throw new ErroParaUsuario(
        "Só quem administra o escritório escolhe quem atende cada indústria. Peça a essa pessoa.",
      );
    }
    if (plano !== "PLUS") {
      throw new ErroParaUsuario("Prepostos fazem parte do plano Plus.");
    }

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);

    const prepostos = await db.usuario.findMany({
      where: { organizacaoId, papel: "REPRESENTANTE", ativo: true },
      select: { id: true },
    });

    const marcados = formData
      .getAll("usuarioId")
      .map((v) => String(v))
      .filter((id) => prepostos.some((p) => p.id === id));

    await db.fornecedorPreposto.deleteMany({
      where: { fornecedorId, usuarioId: { in: prepostos.map((p) => p.id) } },
    });

    if (marcados.length > 0) {
      await db.fornecedorPreposto.createMany({
        data: marcados.map((usuarioId) => ({ fornecedorId, usuarioId })),
      });
    }
  } catch (erro) {
    return falhou(erro, formData);
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
    if (!materialId) {
      throw new ErroParaUsuario(
        "Não deu para saber de qual material são estas faixas. Recarregue a página e tente de novo.",
      );
    }

    const material = await db.material.findFirst({
      where: { id: materialId, fornecedorId },
      select: { id: true },
    });
    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (!material || pertence === 0) {
      throw new ErroParaUsuario(
        "Este material não foi encontrado — ele pode ter sido removido em outra tela. " +
          "Recarregue a página e confira.",
      );
    }

    const de = formData.getAll("pesoDeKg").map(String);
    const ate = formData.getAll("pesoAteKg").map(String);
    const preco = formData.getAll("precoKg").map(String);

    const faixas: { pesoDeKg: string | null; pesoAteKg: string | null; precoKg: string }[] = [];

    for (let i = 0; i < preco.length; i++) {
      // Linha em branco é linha que a pessoa não preencheu, não erro.
      if (preco[i].trim() === "" && de[i]?.trim() === "" && ate[i]?.trim() === "") continue;

      const faixa = i + 1;
      const valor = exigirNumeroDe(preco[i], campoDaLinha("precoKg", i), `o preço da faixa ${faixa}`, {
        obrigatorio: true,
        min: 0,
        exemplo: "35,20",
      });
      const piso = exigirNumeroDe(de[i], campoDaLinha("pesoDeKg", i), `o peso inicial da faixa ${faixa}`, {
        min: 0,
        exemplo: "500",
      });
      const teto = exigirNumeroDe(ate[i], campoDaLinha("pesoAteKg", i), `o peso final da faixa ${faixa}`, {
        min: 0,
        exemplo: "1.000",
      });

      if (piso !== null && teto !== null && piso > teto) {
        throw new ErroDeCampo(
          campoDaLinha("pesoAteKg", i),
          `Na faixa ${faixa}, o peso final está menor que o inicial. Confira se os dois não foram trocados.`,
        );
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
    return falhou(erro, formData);
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

/* -------------------------------------------------------------------------- */
/* Contatos para pedidos                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Regrava a lista de quem recebe o pedido nesta indústria.
 *
 * Recebe a lista inteira, como as faixas do material, mas NÃO apaga e recria:
 * cada linha traz o próprio `id`, e o contato que continua mantém o dele. Um
 * diálogo de envio aberto em outra aba guarda os ids marcados — recriar tudo
 * faria o envio seguinte dizer "contato não encontrado" sem ninguém ter tirado
 * contato nenhum.
 */
export async function salvarContatos(
  fornecedorId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contexto();

    const pertence = await db.fornecedor.count({ where: { id: fornecedorId, organizacaoId } });
    if (pertence === 0) throw new ErroParaUsuario(INDUSTRIA_SUMIU);

    const ids = formData.getAll("contatoId").map(String);
    const nomes = formData.getAll("nome").map(String);
    const setores = formData.getAll("setor").map(String);
    const emails = formData.getAll("email").map(String);
    const padroes = formData.getAll("padrao").map(String);

    const linhas: { id: string; nome: string | null; setor: string | null; email: string; padrao: boolean }[] = [];
    const vistos = new Set<string>();

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i].trim().toLowerCase();
      const nome = lerTexto(nomes[i] ?? null);
      const setor = lerTexto(setores[i] ?? null);

      // Linha toda em branco é a linha nova que a pessoa não usou.
      if (!email && !nome && !setor) continue;
      const campo = campoDaLinha("email", i);
      if (!email) {
        throw new ErroDeCampo(
          campo,
          `Informe o e-mail de ${nome ?? setor ?? "este contato"} — é para ele que o pedido vai. ` +
            `Se não for usar a linha, apague-a na lixeira.`,
        );
      }
      if (!emailValido(email)) throw new ErroDeCampo(campo, EMAIL_INCOMPLETO);
      if (vistos.has(email)) {
        throw new ErroDeCampo(campo, "Este e-mail já está em outra linha da lista. Apague uma das duas.");
      }
      vistos.add(email);

      linhas.push({ id: ids[i] ?? "", nome, setor, email, padrao: padroes[i] === "sim" });
    }

    const atuais = await db.contatoFornecedor.findMany({
      where: { fornecedorId },
      select: { id: true },
    });
    const mantidos = new Set(linhas.map((l) => l.id).filter((id) => atuais.some((a) => a.id === id)));

    await db.contatoFornecedor.deleteMany({
      where: { fornecedorId, id: { notIn: [...mantidos] } },
    });

    for (const [ordem, linha] of linhas.entries()) {
      const dados = { nome: linha.nome, setor: linha.setor, email: linha.email, padrao: linha.padrao, ordem };

      if (mantidos.has(linha.id)) {
        await db.contatoFornecedor.updateMany({ where: { id: linha.id, fornecedorId }, data: dados });
      } else {
        await db.contatoFornecedor.create({ data: { fornecedorId, ...dados } });
      }
    }
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidatePath(`/fornecedores/${fornecedorId}`);
  return {};
}

/** `gravarAlternarAtivoFornecedor`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function alternarAtivoFornecedor(
  id: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAlternarAtivoFornecedor(id, _formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}
