import { FileText, Plus } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { BotaoLink, Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { buscarOrcamentos, statusDoParametro } from "./consulta";
import { ListaOrcamentos } from "./lista";

export default async function PaginaOrcamentos({ searchParams }: PageProps<"/orcamentos">) {
  const { organizacaoId, db } = await escopoAtual();
  const parametros = await searchParams;

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
  const inicial = await buscarOrcamentos(db, organizacaoId, { busca, status, pagina: 0 });

  return (
    <Pagina>
      <Cabecalho
        icone={FileText}
        titulo="Orçamentos"
        descricao="A proposta que vai ao cliente antes do pedido. A numeração é do escritório — a indústria não fica sabendo dela."
        acao={
          <BotaoLink href="/orcamentos/novo" icone={Plus}>
            Novo orçamento
          </BotaoLink>
        }
      />

      <ListaOrcamentos inicial={inicial} buscaInicial={busca} statusInicial={status} />
    </Pagina>
  );
}
