import { FileText, Plus } from "lucide-react";

import { ContagemDaLista, ContagemProvider } from "@/components/contagem-lista";
import { Pagina } from "@/components/pagina";
import { BotaoLink, Cabecalho } from "@/components/ui";
import { parametrosDaLista } from "@/lib/busca-lembrada-servidor";
import { escopoAtual } from "@/lib/sessao";

import { buscarOrcamentos, statusDoParametro } from "./consulta";
import { ListaOrcamentos } from "./lista";

export default async function PaginaOrcamentos({ searchParams }: PageProps<"/orcamentos">) {
  const { organizacaoId, ehAdmin, db } = await escopoAtual();
  // Sem filtro na URL, a busca que a pessoa deixou nesta seção (`busca-lembrada.ts`).
  const parametros = await parametrosDaLista("orcamentos", await searchParams);

  /*
   * A URL decide como a tela ABRE — é o que faz o link copiado e o F5 trazerem
   * a mesma lista. Daí em diante quem pede as fatias é o cliente, sem navegar
   * (ver `lista.tsx`).
   */
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : "";
  const status = statusDoParametro(parametros.status);

  /*
   * A primeira fatia vem daqui, renderizada no servidor. É isso que mantém a
   * cascata de entrada: as linhas já chegam no HTML, e a animação é da página
   * abrindo — não de uma lista que trocou de conteúdo.
   */
  const [inicial, total] = await Promise.all([
    buscarOrcamentos(db, organizacaoId, ehAdmin, { busca, status, pagina: 0 }),
    // O "de 128" do topo, cancelados inclusive — para o preposto, só os dele (RLS).
    db.orcamento.count({ where: { organizacaoId } }),
  ]);

  return (
    <Pagina>
      <ContagemProvider total={total} inicial={inicial.quantos ?? 0}>
        <Cabecalho
          icone={FileText}
          titulo="Orçamentos"
          selo={<ContagemDaLista singular="orçamento" plural="orçamentos" />}
          descricao="A proposta que vai ao cliente antes do pedido. A numeração é do escritório — a indústria não fica sabendo dela."
          acao={
            <BotaoLink href="/orcamentos/novo" icone={Plus}>
              Novo orçamento
            </BotaoLink>
          }
        />

        <ListaOrcamentos inicial={inicial} buscaInicial={busca} statusInicial={status} />
      </ContagemProvider>
    </Pagina>
  );
}
