"use server";

import { revalidatePath } from "next/cache";

import { dbAdministrativo } from "@/lib/db";
import { lerNumeroBr } from "@/lib/numero-br";
import { escopoAtual, organizacaoAtual } from "@/lib/sessao";

export type EstadoFormulario = { erro?: string };

/**
 * Define a meta pessoal de comissão do mês.
 *
 * Vive na organização, e não no fornecedor: é o objetivo do representante,
 * somando todas as indústrias. Não entra em cálculo nenhum — serve para ele
 * acompanhar o próprio alvo e comemorar ao bater.
 *
 * Usa o cliente administrativo porque a organização é a própria linha de
 * tenant: o RLS a protege por `id`, e alterá-la é a única escrita que precisa
 * enxergá-la de fora do escopo comum.
 */
export async function definirMeta(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const organizacaoId = await organizacaoAtual();
    const bruto = formData.get("meta");
    const texto = typeof bruto === "string" ? bruto.trim() : "";

    // Campo vazio significa "não quero meta" — é uma opção legítima, e não erro.
    if (texto === "") {
      await dbAdministrativo().organizacao.update({
        where: { id: organizacaoId },
        data: { metaComissaoMensal: null },
      });

      revalidatePath("/comissoes");
      return {};
    }

    const valor = lerNumeroBr(texto);

    if (valor === null) return { erro: "Não entendi esse valor." };
    if (valor < 0) return { erro: "A meta não pode ser negativa." };

    await dbAdministrativo().organizacao.update({
      where: { id: organizacaoId },
      data: { metaComissaoMensal: valor === 0 ? null : String(valor) },
    });
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar a meta." };
  }

  revalidatePath("/comissoes");
  return {};
}


/**
 * Lança o acerto da comissão de um pedido: o que a indústria pagou de fato.
 *
 * NADA aqui é deduzido. O valor e o percentual são os dois digitados, porque
 * pagar uma base menor e pagar a base cheia com percentual menor são acordos
 * diferentes que chegam ao mesmo dinheiro — e só quem negociou sabe qual foi.
 * Um sistema que escolhesse por conta própria estaria inventando o motivo.
 *
 * Os três campos se apagam juntos: deixar tudo em branco desfaz o acerto e o
 * pedido volta a contar só como previsto.
 */
export async function salvarAcerto(
  pedidoId: string,
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    const { organizacaoId, db } = await escopoAtual();

    const texto = (campo: string) => {
      const bruto = formData.get(campo);
      return typeof bruto === "string" ? bruto.trim() : "";
    };

    const valorBruto = texto("valorRecebido");
    const percentualBruto = texto("comissaoPercentualRecebido");
    const entregaBruta = texto("entregueEm");

    const valor = valorBruto === "" ? null : lerNumeroBr(valorBruto);
    const percentual = percentualBruto === "" ? null : lerNumeroBr(percentualBruto);

    if (valorBruto !== "" && valor === null) return { erro: "Não entendi o valor recebido." };
    if (percentualBruto !== "" && percentual === null) return { erro: "Não entendi o percentual." };

    if (valor !== null && valor < 0) return { erro: "O valor recebido não pode ser negativo." };
    if (percentual !== null && (percentual < 0 || percentual > 100)) {
      return { erro: "O percentual precisa ficar entre 0 e 100." };
    }

    // Meio acerto não é acerto: sem os dois, a comissão recebida não existe.
    if ((valor === null) !== (percentual === null)) {
      return { erro: "Informe o valor recebido e o percentual — ou deixe os dois em branco." };
    }

    let entregueEm: Date | null = null;
    if (entregaBruta !== "") {
      // `date` sem hora: monta em UTC para o dia não escorregar pelo fuso.
      const [ano, mes, dia] = entregaBruta.split("-").map(Number);
      if (!ano || !mes || !dia) return { erro: "Data de entrega inválida." };
      entregueEm = new Date(Date.UTC(ano, mes - 1, dia));
    }

    const { count } = await db.pedido.updateMany({
      where: { id: pedidoId, organizacaoId },
      data: {
        valorRecebido: valor === null ? null : String(valor),
        comissaoPercentualRecebido: percentual === null ? null : String(percentual),
        entregueEm,
      },
    });

    if (count === 0) return { erro: "Pedido não encontrado." };
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Não foi possível salvar o acerto." };
  }

  revalidatePath("/comissoes");
  revalidatePath(`/pedidos/${pedidoId}`);
  return {};
}
