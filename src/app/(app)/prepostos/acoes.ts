"use server";

/**
 * Cadastro de prepostos — a seção que o plano Plus destrava.
 *
 * Toda ação daqui passa por `contextoAdmin()`, e isso é porteiro de aplicação,
 * não a garantia. A garantia é o banco: o RLS recusa usuário de outro
 * escritório, e um trigger recusa preposto em escritório que não seja Plus (ver
 * migrations `planos_papeis_e_representante` e `prepostos_e_permissao_de_industria`).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { atualizarValorAssinatura, ErroAsaas } from "@/lib/asaas";
import { dbAdministrativo, type DbOrganizacao } from "@/lib/db";
import {
  ErroDeCampo,
  ErroParaUsuario,
  falhou,
  type EstadoFormulario as EstadoBase,
} from "@/lib/erro-formulario";
import { normalizarTelefone } from "@/lib/mascara";
import { exigirNumero } from "@/lib/numero-br";
import { PLANOS, valorMensal } from "@/lib/planos";
import { gerarHashSenha } from "@/lib/senha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";
import { escopoAtual } from "@/lib/sessao";

/**
 * O estado de sempre: erro preso ao campo e o que foi digitado de volta — a
 * senha nunca volta.
 */
export type EstadoFormulario = EstadoBase;

const PREPOSTO_SUMIU =
  "Este preposto não foi encontrado — ele pode ter sido removido em outra tela. " +
  "Volte à lista de prepostos e confira.";

const SENHA_CURTA =
  `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres. ` +
  "Misture letras e números para ficar mais difícil de adivinhar.";

/** A lista e a ficha do preposto — as duas mostram o que acabou de mudar. */
function revalidarPreposto(id: string) {
  revalidatePath("/prepostos");
  revalidatePath(`/prepostos/${id}`);
}

async function contextoAdmin() {
  const escopo = await escopoAtual();

  if (!escopo.ehAdmin) {
    throw new ErroParaUsuario(
      "Só quem administra o escritório cuida dos prepostos. Peça a essa pessoa.",
    );
  }
  if (escopo.plano !== "PLUS") throw new ErroParaUsuario("Prepostos fazem parte do plano Plus.");

  return escopo;
}

/**
 * Acerta a mensalidade no Asaas quando o número de prepostos ativos vai mudar.
 *
 * O Max cobre 3 prepostos; do quarto em diante cada um soma
 * `precoPrepostoExtra`. Roda ANTES de gravar: se o Asaas recusar, o preposto
 * não é criado nem reativado — melhor que um preposto trabalhando sem estar na
 * cobrança. Escritório sem assinatura no Asaas (os de antes da cobrança) não
 * tem o que acertar.
 */
async function acertarMensalidade(
  db: DbOrganizacao,
  organizacaoId: string,
  variacao: 1 | -1,
): Promise<void> {
  const [organizacao, ativos] = await Promise.all([
    db.organizacao.findUniqueOrThrow({
      where: { id: organizacaoId },
      select: { plano: true, asaasAssinaturaId: true },
    }),
    db.usuario.count({ where: { organizacaoId, papel: "REPRESENTANTE", ativo: true } }),
  ]);

  if (!organizacao.asaasAssinaturaId) return;

  const antes = valorMensal(organizacao.plano, ativos);
  const depois = valorMensal(organizacao.plano, ativos + variacao);
  if (antes.equals(depois)) return;

  try {
    await atualizarValorAssinatura(organizacao.asaasAssinaturaId, depois);
  } catch (erro) {
    if (!(erro instanceof ErroAsaas)) throw erro;
    throw new ErroParaUsuario(
      `Com este, o escritório passa de ${PLANOS.PLUS.prepostosInclusos} prepostos ativos, e não ` +
        "conseguimos acertar a mensalidade agora. Nada foi alterado — tente de novo em alguns minutos.",
    );
  }
}

function lerTexto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Opcional: vazio vira `null`, e não string vazia no banco. */
function lerOpcional(valor: FormDataEntryValue | null): string | null {
  return lerTexto(valor) || null;
}

/**
 * Telefone normalizado aqui, e não só pela máscara do campo: o formulário
 * continua enviando por POST comum quando o JavaScript não roda.
 */
function lerTelefone(valor: FormDataEntryValue | null): string | null {
  return normalizarTelefone(lerTexto(valor));
}

/** Fatia da comissão, em percentual DELA. Vazio vale zero — preposto sem acordo ainda. */
function lerPercentual(formData: FormData): string | null {
  const numero = exigirNumero(formData, "comissaoPercentualPadrao", "o percentual da comissão", {
    min: 0,
    max: 100,
    exemplo: "50",
  });
  return numero === null ? null : String(numero);
}

/** O nome é o único campo obrigatório da ficha. */
function exigirNome(formData: FormData): string {
  const nome = lerTexto(formData.get("nome"));
  if (!nome) {
    throw new ErroDeCampo("nome", "Informe o nome do preposto — ele assina as propostas dele.");
  }
  return nome;
}

/**
 * Regrava as indústrias que o preposto vê: exatamente as marcadas.
 *
 * O id que não é de uma indústria deste escritório é descartado em silêncio —
 * só chega assim um formulário adulterado, e o RLS recusaria a gravação de
 * todo jeito.
 */
async function gravarIndustrias(
  db: DbOrganizacao,
  organizacaoId: string,
  usuarioId: string,
  formData: FormData,
) {
  const marcadas = formData.getAll("fornecedorId").map(String);
  const validas =
    marcadas.length === 0
      ? []
      : await db.fornecedor.findMany({
          where: { organizacaoId, id: { in: marcadas } },
          select: { id: true },
        });

  await db.fornecedorPreposto.deleteMany({ where: { usuarioId } });

  if (validas.length > 0) {
    await db.fornecedorPreposto.createMany({
      data: validas.map((f) => ({ fornecedorId: f.id, usuarioId })),
    });
  }
}

export async function inscreverPreposto(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  let destino: string;

  try {
    const { organizacaoId, db } = await contextoAdmin();

    const nome = exigirNome(formData);
    const email = lerTexto(formData.get("email")).toLowerCase();
    const senha = lerTexto(formData.get("senha"));

    if (!email) {
      throw new ErroDeCampo("email", "Informe o e-mail do preposto — é o login dele no sistema.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErroDeCampo(
        "email",
        "Este e-mail parece incompleto. Confira se tem o @ e o final, como ana@exemplo.com.br.",
      );
    }

    const comissaoPercentualPadrao = lerPercentual(formData);

    if (senha.length < TAMANHO_MINIMO_SENHA) throw new ErroDeCampo("senha", SENHA_CURTA);

    /*
     * O e-mail é único no sistema inteiro, não por escritório — é a chave do
     * login. Conferir antes rende mensagem legível em vez do erro cru do banco,
     * mas quem garante continua sendo o índice único.
     */
    const jaExiste = await dbAdministrativo().usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (jaExiste) {
      throw new ErroDeCampo(
        "email",
        "Este e-mail já é o login de outra pessoa no sistema. Use outro e-mail para o preposto.",
      );
    }

    await acertarMensalidade(db, organizacaoId, 1);

    const preposto = await db.usuario.create({
      data: {
        organizacaoId,
        nome,
        sobrenome: lerOpcional(formData.get("sobrenome")),
        email,
        telefone: lerTelefone(formData.get("telefone")),
        senhaHash: await gerarHashSenha(senha),
        // A inicial, que o administrador conhece: no primeiro acesso o sistema
        // sugere a troca, e daí em diante só o preposto troca.
        senhaProvisoria: true,
        papel: "REPRESENTANTE",
        comissaoPercentualPadrao,
      },
      select: { id: true },
    });

    await gravarIndustrias(db, organizacaoId, preposto.id, formData);

    destino = `/prepostos/${preposto.id}`;
  } catch (erro) {
    return falhou(erro, formData);
  }

  // Como o cadastro de cliente: gravou, abre a ficha do que acabou de nascer.
  revalidatePath("/prepostos");
  redirect(destino);
}

export async function atualizarPreposto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contextoAdmin();

    const nome = exigirNome(formData);

    const { count } = await db.usuario.updateMany({
      where: { id, organizacaoId, papel: "REPRESENTANTE" },
      data: {
        nome,
        sobrenome: lerOpcional(formData.get("sobrenome")),
        telefone: lerTelefone(formData.get("telefone")),
        comissaoPercentualPadrao: lerPercentual(formData),
      },
    });

    if (count === 0) throw new ErroParaUsuario(PREPOSTO_SUMIU);

    await gravarIndustrias(db, organizacaoId, id, formData);
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidarPreposto(id);
  // "Salvar e voltar": gravou, a ficha volta a ser leitura.
  redirect(`/prepostos/${id}`);
}

/**
 * Liga e desliga o acesso.
 *
 * Desativar, e não apagar: o preposto aparece em pedido, cliente e comissão de
 * meses fechados, e apagá-lo devolveria essa carteira ao escritório calada.
 * `sessaoAtual()` relê `ativo` a cada requisição, então o corte é imediato —
 * não espera o cookie dele vencer.
 */
async function gravarAlternarAtivoPreposto(id: string, _formData: FormData): Promise<void> {
  const { organizacaoId, db } = await contextoAdmin();

  const preposto = await db.usuario.findFirst({
    where: { id, organizacaoId, papel: "REPRESENTANTE" },
    select: { ativo: true },
  });

  if (!preposto) throw new ErroParaUsuario(PREPOSTO_SUMIU);

  await acertarMensalidade(db, organizacaoId, preposto.ativo ? -1 : 1);

  await db.usuario.updateMany({
    where: { id, organizacaoId, papel: "REPRESENTANTE" },
    data: { ativo: !preposto.ativo },
  });

  revalidarPreposto(id);
}

/**
 * Regrava os clientes que o preposto atende: exatamente os marcados.
 *
 * Mexe só nos vínculos DESTE preposto — um cliente pode ser de vários, e
 * marcar aqui não tira o cliente de ninguém. O id que não é de cliente deste
 * escritório é descartado; o RLS recusaria o vínculo de todo jeito.
 */
export async function definirClientesDoPreposto(
  id: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await contextoAdmin();

    const preposto = await db.usuario.count({
      where: { id, organizacaoId, papel: "REPRESENTANTE" },
    });
    if (preposto === 0) throw new ErroParaUsuario(PREPOSTO_SUMIU);

    const marcados = formData.getAll("clienteId").map(String);
    const validos =
      marcados.length === 0
        ? []
        : await db.cliente.findMany({
            where: { organizacaoId, id: { in: marcados } },
            select: { id: true },
          });

    await db.clientePreposto.deleteMany({ where: { usuarioId: id } });

    if (validos.length > 0) {
      await db.clientePreposto.createMany({
        data: validos.map((c) => ({ clienteId: c.id, usuarioId: id })),
      });
    }
  } catch (erro) {
    return falhou(erro, formData);
  }

  revalidarPreposto(id);
  revalidatePath("/clientes");
  redirect(`/prepostos/${id}`);
}

/** `gravarAlternarAtivoPreposto`, devolvendo a recusa para aparecer embaixo do botão clicado. */
export async function alternarAtivoPreposto(
  id: string,
  _estado: EstadoFormulario,
  _formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await gravarAlternarAtivoPreposto(id, _formData);
  } catch (erro) {
    return falhou(erro);
  }
  return {};
}
