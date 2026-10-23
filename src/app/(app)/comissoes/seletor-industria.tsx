"use client";

/**
 * A indústria de Comissões quando o mês tem muitas — a caixa de busca no lugar
 * das pílulas (`filtro-industria.tsx` decide qual das duas).
 *
 * Com vinte indústrias, as pílulas viravam quatro linhas no computador e mais
 * de dez no celular, empurrando as tabelas para baixo; achar uma no meio delas
 * era procurar com os olhos. Aqui é uma linha só, e "qual" acha a QUALYPLAST.
 *
 * Escolher navega para o endereço da indústria, montado no servidor (o mês vai
 * junto) — o filtro continua morando na URL, como nas pílulas.
 */

import { useRouter } from "next/navigation";

import { SelecaoBuscavel } from "@/components/selecao-buscavel";

export function SeletorIndustria({
  opcoes,
  escolhida,
}: {
  /** "Todas" primeiro (id vazio), e cada indústria com o endereço dela. */
  opcoes: { id: string; rotulo: string; detalhe?: string; href: string }[];
  escolhida: string | null;
}) {
  const router = useRouter();

  return (
    <SelecaoBuscavel
      name="fornecedor"
      rotulo="Indústria"
      opcoes={opcoes}
      value={escolhida ?? ""}
      aoEscolher={(id) => {
        const destino = opcoes.find((opcao) => opcao.id === id);
        // Trocar a indústria troca as tabelas logo abaixo: subir ao topo faria
        // perder de vista justamente o que acabou de mudar.
        if (destino) router.push(destino.href, { scroll: false });
      }}
      placeholder="Digite o nome da indústria"
      vazio="Nenhuma indústria com esse nome neste mês."
      lado="baixo"
      className="max-w-sm"
    />
  );
}
