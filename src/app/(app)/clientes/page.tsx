import { Plus, Users } from "lucide-react";

import { BotaoLink, Cabecalho } from "@/components/ui";
import { parametrosDaLista } from "@/lib/busca-lembrada-servidor";
import { escopoAtual } from "@/lib/sessao";
import { ContagemDaLista, ContagemProvider } from "@/components/contagem-lista";
import { Pagina } from "@/components/pagina";

import { buscarClientes, situacaoDoParametro } from "./consulta";
import { ListaClientes } from "./lista";

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const { organizacaoId, ehAdmin, db } = await escopoAtual();
  // Sem filtro na URL, a busca que a pessoa deixou nesta seção (`busca-lembrada.ts`).
  const parametros = await parametrosDaLista("clientes", await searchParams);

  /*
   * A URL decide como a tela ABRE — é o que faz o link copiado e o F5 trazerem
   * a mesma lista. Daí em diante quem pede as fatias é o cliente, sem navegar
   * (ver `lista.tsx`).
   */
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : "";
  const situacao = situacaoDoParametro(parametros.situacao);

  const [inicial, total] = await Promise.all([
    buscarClientes(db, organizacaoId, { busca, situacao, pagina: 0 }),
    // O "de 128" do topo, inativos inclusive. Zero também distingue "não achei"
    // de "ainda não há cliente nenhum", que pede outro recado.
    db.cliente.count({ where: { organizacaoId } }),
  ]);

  return (
    <Pagina>
      <ContagemProvider total={total} inicial={inicial.quantos ?? 0}>
        <Cabecalho
          icone={Users}
          titulo="Clientes"
          selo={<ContagemDaLista singular="cliente" plural="clientes" />}
          descricao="Os dados fiscais daqui saem impressos no cabeçalho de todo pedido."
          acao={
            // Cadastro é do administrador; o preposto consulta.
            ehAdmin && (
              <BotaoLink href="/clientes/novo" icone={Plus}>
                Novo cliente
              </BotaoLink>
            )
          }
        />

        <ListaClientes
          inicial={inicial}
          buscaInicial={busca}
          situacaoInicial={situacao}
          semNenhumCliente={total === 0}
        />
      </ContagemProvider>
    </Pagina>
  );
}
