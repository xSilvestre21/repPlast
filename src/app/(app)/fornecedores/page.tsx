import { Factory, Plus } from "lucide-react";

import { BotaoLink, Cabecalho } from "@/components/ui";
import { parametrosDaLista } from "@/lib/busca-lembrada-servidor";
import { escopoAtual } from "@/lib/sessao";
import { soIndustriasMarcadas } from "@/lib/industrias-do-ator";
import { ContagemDaLista, ContagemProvider } from "@/components/contagem-lista";
import { Pagina } from "@/components/pagina";

import { buscarFornecedores, situacaoDoParametro } from "./consulta";
import { ListaFornecedores } from "./lista";

export default async function PaginaFornecedores({ searchParams }: PageProps<"/fornecedores">) {
  const { organizacaoId, usuarioId, ehAdmin, db } = await escopoAtual();
  const ator = { ehAdmin, usuarioId };
  // Sem filtro na URL, a busca que a pessoa deixou nesta seção (`busca-lembrada.ts`).
  const parametros = await parametrosDaLista("fornecedores", await searchParams);

  /*
   * A URL decide como a tela ABRE — é o que faz o link copiado e o F5 trazerem
   * a mesma lista. Daí em diante quem pede as fatias é o cliente, sem navegar
   * (ver `lista.tsx`).
   */
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : "";
  const situacao = situacaoDoParametro(parametros.situacao);

  const [inicial, total] = await Promise.all([
    buscarFornecedores(db, organizacaoId, ator, { busca, situacao, pagina: 0 }),
    // O "de 12" do topo — para o preposto, só as indústrias marcadas para ele,
    // como na lista. Zero também distingue "não achei" de "ainda não há
    // indústria nenhuma", que pede outro recado.
    db.fornecedor.count({ where: { organizacaoId, ...soIndustriasMarcadas(ator) } }),
  ]);

  return (
    <Pagina>
      <ContagemProvider total={total} inicial={inicial.quantos ?? 0}>
        <Cabecalho
          icone={Factory}
          titulo="Fornecedores"
          selo={<ContagemDaLista singular="indústria" plural="indústrias" />}
          descricao="As indústrias que você representa. É aqui que ficam o IPI, a comissão e os aditivos."
          acao={
            // Cadastro é do administrador; o preposto consulta.
            ehAdmin && (
              <BotaoLink href="/fornecedores/novo" icone={Plus}>
                Nova indústria
              </BotaoLink>
            )
          }
        />

        <ListaFornecedores
          inicial={inicial}
          buscaInicial={busca}
          situacaoInicial={situacao}
          semNenhumFornecedor={total === 0}
        />
      </ContagemProvider>
    </Pagina>
  );
}
