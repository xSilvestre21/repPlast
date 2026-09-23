import { Plus, ScrollText } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { BotaoLink, Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { buscarPedidos, statusDoParametro } from "./consulta";
import { ListaPedidos } from "./lista";

export default async function PaginaPedidos({ searchParams }: PageProps<"/pedidos">) {
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
  const inicial = await buscarPedidos(db, organizacaoId, { busca, status, pagina: 0 });

  return (
    <Pagina>
      <Cabecalho
        icone={ScrollText}
        titulo="Pedidos"
        descricao="A numeração é própria de cada indústria — o nº 133 de uma não colide com o 133 de outra."
        acao={
          <BotaoLink href="/pedidos/novo" icone={Plus}>
            Novo pedido
          </BotaoLink>
        }
      />

      <ListaPedidos inicial={inicial} buscaInicial={busca} statusInicial={status} />
    </Pagina>
  );
}
