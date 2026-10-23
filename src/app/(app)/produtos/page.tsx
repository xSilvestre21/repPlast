import { Package, Plus } from "lucide-react";

import { BotaoLink, Cabecalho } from "@/components/ui";
import { parametrosDaLista } from "@/lib/busca-lembrada-servidor";
import { escopoAtual } from "@/lib/sessao";
import { ContagemDaLista, ContagemProvider } from "@/components/contagem-lista";
import { Pagina } from "@/components/pagina";

import { buscarProdutos, filtrosDosParametros } from "./consulta";
import { ListaProdutos } from "./lista";

export default async function PaginaProdutos({ searchParams }: PageProps<"/produtos">) {
  const { organizacaoId, ehAdmin, db } = await escopoAtual();
  // Sem filtro na URL, a busca que a pessoa deixou nesta seção (`busca-lembrada.ts`).
  const parametros = await parametrosDaLista("produtos", await searchParams);

  /*
   * A URL decide como a tela ABRE — é o que faz o link copiado e o F5 trazerem
   * a mesma lista. Daí em diante quem pede as fatias é o cliente, sem navegar
   * (ver `lista.tsx`).
   */
  const filtros = filtrosDosParametros((nome) => parametros[nome]);

  // Link antigo, do tempo da caixa "Mostrar inativos": ela somava os inativos
  // aos ativos, que hoje é "Todos".
  if (parametros.inativos === "1" && !parametros.situacao) filtros.situacao = "todos";

  const [inicial, total] = await Promise.all([
    buscarProdutos(db, organizacaoId, { ...filtros, pagina: 0 }),
    // O "de 444" do topo, inativos inclusive. Zero também distingue "não achei"
    // de "ainda não há produto nenhum", que pede outro recado.
    db.produto.count({ where: { organizacaoId } }),
  ]);

  return (
    <Pagina>
      <ContagemProvider total={total} inicial={inicial.quantos ?? 0}>
        <Cabecalho
          icone={Package}
          titulo="Produtos"
          selo={<ContagemDaLista singular="produto" plural="produtos" />}
          descricao="Cada produto é de um cliente e de uma indústria — o mesmo saco cotado para dois clientes são dois produtos, com preço próprio."
          acao={
            // Cadastro é do administrador; o preposto consulta.
            ehAdmin && (
              <BotaoLink href="/produtos/novo" icone={Plus}>
                Novo produto
              </BotaoLink>
            )
          }
        />

        <ListaProdutos inicial={inicial} filtrosIniciais={filtros} semNenhumProduto={total === 0} />
      </ContagemProvider>
    </Pagina>
  );
}
