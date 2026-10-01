import { Factory, Plus } from "lucide-react";

import { BotaoLink, Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

import { buscarFornecedores, situacaoDoParametro } from "./consulta";
import { ListaFornecedores } from "./lista";

export default async function PaginaFornecedores({ searchParams }: PageProps<"/fornecedores">) {
  const { organizacaoId, db } = await escopoAtual();
  const parametros = await searchParams;

  /*
   * A URL decide como a tela ABRE — é o que faz o link copiado e o F5 trazerem
   * a mesma lista. Daí em diante quem pede as fatias é o cliente, sem navegar
   * (ver `lista.tsx`).
   */
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : "";
  const situacao = situacaoDoParametro(parametros.situacao);

  const [inicial, algum] = await Promise.all([
    buscarFornecedores(db, organizacaoId, { busca, situacao, pagina: 0 }),
    // Distingue "não achei" de "ainda não há indústria nenhuma", que pede outro recado.
    db.fornecedor.findFirst({ where: { organizacaoId }, select: { id: true } }),
  ]);

  return (
    <Pagina>
      <Cabecalho
        icone={Factory}
        titulo="Fornecedores"
        descricao="As indústrias que você representa. É aqui que ficam o IPI, a comissão e os aditivos."
        acao={
          <BotaoLink href="/fornecedores/novo" icone={Plus}>
            Nova indústria
          </BotaoLink>
        }
      />

      <ListaFornecedores
        inicial={inicial}
        buscaInicial={busca}
        situacaoInicial={situacao}
        semNenhumFornecedor={!algum}
      />
    </Pagina>
  );
}
