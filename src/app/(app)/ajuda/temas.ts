/**
 * Os temas da página de Ajuda — fonte única do índice, da busca e das âncoras
 * (`/ajuda#parcelamento`).
 *
 * Módulo puro: a página decide no servidor quais temas cada pessoa vê
 * (`temasPara`), e a busca roda no navegador (`filtrarTemas`).
 */

import { casaComTermos, termosDaBusca } from "@/lib/busca";

export type IdTema =
  | "caminho"
  | "senha-de-app"
  | "tabelas"
  | "parcelamento"
  | "faturamento"
  | "comissoes"
  | "rateio"
  | "erros"
  | "plano";

export type Tema = {
  id: IdTema;
  titulo: string;
  resumo: string;
  /** Palavras que a pessoa digitaria e que não estão no título nem no resumo. */
  busca: string;
  /** Só quem administra o escritório configura isto. */
  soAdmin?: boolean;
  /** Só faz sentido no escritório com prepostos (plano Max). */
  soComPrepostos?: boolean;
};

/** Na ordem do trabalho: do cadastro ao dinheiro, e o que dá errado no fim. */
export const TEMAS: readonly Tema[] = [
  {
    id: "caminho",
    titulo: "Como o sistema funciona",
    resumo: "O caminho de um pedido, da tabela da indústria até a comissão.",
    busca: "fluxo começar primeiro passo ordem cadastro orçamento pedido pdf proposta converter",
  },
  {
    id: "senha-de-app",
    titulo: "E-mail: a senha de app",
    resumo: "Ligar o seu e-mail ao sistema, com a verificação em duas etapas do Google.",
    busca: "gmail outlook hotmail hostinger locaweb smtp enviar não envia duas etapas 2 fatores google conta caixa",
    soAdmin: true,
  },
  {
    id: "tabelas",
    titulo: "Tabelas de preço",
    resumo: "De onde sai o preço do saco, e o que fazer quando a indústria reajusta.",
    busca: "material fator kg milheiro reajuste aumento aditivo densidade medida largura espessura preço errado",
  },
  {
    id: "parcelamento",
    titulo: "Parcelamento",
    resumo: "Dividir o recebimento de um pedido em parcelas, como 28/35/42.",
    busca:
      "parcela parcelar prazo pagamento dias vencimento dividir boleto cheque desfazer outros dias trocar barra vírgula celular",
  },
  {
    id: "faturamento",
    titulo: "Dia de faturamento",
    resumo: "Em que mês a comissão entra quando a indústria fecha o faturamento num dia.",
    busca: "fechamento mês seguinte competência recebimento paga quando entra dia 20 comissão sumiu outro mês",
  },
  {
    id: "comissoes",
    titulo: "Comissões e acerto",
    resumo: "Previsto, recebido e a acertar — e como conferir o extrato da indústria.",
    busca: "comissão acertar extrato conferir previsto recebido percentual base buscar número ordem meta cancelado",
  },
  {
    id: "rateio",
    titulo: "Prepostos e rateio",
    resumo: "Como a comissão se divide entre o escritório e o preposto.",
    busca: "preposto repasse dividir percentual carteira vendedor equipe",
    soAdmin: true,
    soComPrepostos: true,
  },
  {
    id: "erros",
    titulo: "Quando algo não dá certo",
    resumo: "Os tropeços mais comuns e como sair de cada um.",
    busca: "erro vermelho recusado bloqueado senha esqueci não salva não acha editar somente leitura cancelado busca",
  },
  {
    id: "plano",
    titulo: "Plano e cobrança",
    resumo: "O teste grátis, a primeira cobrança e como cancelar.",
    busca: "assinatura pagar cartão mensalidade cancelar teste grátis trocar plano solo max",
    soAdmin: true,
  },
];

/** Os temas que esta pessoa vê. O preposto não recebe o que só o administrador configura. */
export function temasPara({ ehAdmin, temPrepostos }: { ehAdmin: boolean; temPrepostos: boolean }): Tema[] {
  return TEMAS.filter((tema) => (ehAdmin || !tema.soAdmin) && (temPrepostos || !tema.soComPrepostos));
}

/** Por pedaço, sem acento e sem caixa, como as buscas do app. Sem nada digitado, todos. */
export function filtrarTemas(temas: readonly Tema[], busca: string): Tema[] {
  const termos = termosDaBusca(busca);
  if (termos.length === 0) return [...temas];

  return temas.filter((tema) => casaComTermos(`${tema.titulo} ${tema.resumo} ${tema.busca}`, termos));
}
