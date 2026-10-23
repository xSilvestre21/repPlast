/**
 * A indústria de Comissões: "Todas" ou uma, para achar a tabela dela sem rolar
 * por todas as outras.
 *
 * Só links, e na URL (`?fornecedor=`), como o mês: F5, link copiado e o voltar
 * do navegador trazem a mesma visão. Filtra só as TABELAS — as caixas do mês,
 * a meta e o "Por preposto" continuam do mês inteiro (ver `page.tsx`).
 *
 * Pílulas soltas, e não o `Segmentado`: com quatro ou cinco nomes de indústria,
 * um trilho único não cabia no celular; aqui elas quebram de linha. O desenho
 * da pílula ativa é o mesmo.
 *
 * Passando de `MAXIMO_DE_PILULAS`, vira a caixa de busca (`seletor-industria.tsx`):
 * vinte pílulas eram linhas e linhas empurrando as tabelas para baixo. Até lá,
 * as pílulas ganham — um clique, e todas à vista.
 */

import Link from "next/link";

import { quantos } from "@/lib/quantos";

import { SeletorIndustria } from "./seletor-industria";

/** Quantas indústrias no mês ainda cabem como pílulas, numa ou duas linhas. */
export const MAXIMO_DE_PILULAS = 6;

export type IndustriaDoFiltro = { id: string; nome: string; pedidos: number };

const PILULA =
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-mini font-semibold " +
  "whitespace-nowrap transition-colors duration-200";
const ATIVA = "border-filete bg-folha text-tinta shadow-suave";
const INATIVA = "border-transparent bg-folha-2 text-tinta-2 hover:text-tinta";

export function FiltroIndustria({
  industrias,
  escolhida,
  endereco,
}: {
  industrias: IndustriaDoFiltro[];
  /** O id da indústria escolhida, ou `null` em "Todas". */
  escolhida: string | null;
  /** O endereço da tela com esta indústria (ou `null`, todas), no mês que está aberto. */
  endereco: (fornecedor: string | null) => string;
}) {
  if (industrias.length > MAXIMO_DE_PILULAS) {
    return (
      <div className="mb-5">
        <SeletorIndustria
          escolhida={escolhida}
          opcoes={[
            { id: "", rotulo: "Todas as indústrias", href: endereco(null) },
            ...industrias.map((industria) => ({
              id: industria.id,
              rotulo: industria.nome,
              detalhe: quantos(industria.pedidos, "pedido", "pedidos"),
              href: endereco(industria.id),
            })),
          ]}
        />
      </div>
    );
  }

  const opcoes = [{ id: null, nome: "Todas", pedidos: null }, ...industrias];

  return (
    <nav aria-label="Indústria" className="mb-5 flex flex-wrap items-center gap-2">
      <span className="rotulo mr-1">Indústria</span>
      {opcoes.map((opcao) => {
        const ativa = opcao.id === escolhida;
        return (
          <Link
            key={opcao.id ?? "todas"}
            href={endereco(opcao.id)}
            // Trocar a indústria troca as tabelas logo abaixo: subir ao topo
            // faria perder de vista justamente o que acabou de mudar.
            scroll={false}
            aria-current={ativa ? "true" : undefined}
            className={`${PILULA} ${ativa ? ATIVA : INATIVA}`}
          >
            {opcao.nome}
            {opcao.pedidos !== null && <span className="numerico font-normal text-tinta-3">{opcao.pedidos}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
