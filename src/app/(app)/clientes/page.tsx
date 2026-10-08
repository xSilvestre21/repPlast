import { Plus, Users } from "lucide-react";

import { BotaoLink, Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

import { buscarClientes, situacaoDoParametro } from "./consulta";
import { ListaClientes } from "./lista";

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const { organizacaoId, ehAdmin, db } = await escopoAtual();
  const parametros = await searchParams;

  /*
   * A URL decide como a tela ABRE — é o que faz o link copiado e o F5 trazerem
   * a mesma lista. Daí em diante quem pede as fatias é o cliente, sem navegar
   * (ver `lista.tsx`).
   */
  const busca = typeof parametros.busca === "string" ? parametros.busca.trim() : "";
  const situacao = situacaoDoParametro(parametros.situacao);

  const [inicial, algum] = await Promise.all([
    buscarClientes(db, organizacaoId, { busca, situacao, pagina: 0 }),
    // Distingue "não achei" de "ainda não há cliente nenhum", que pede outro recado.
    db.cliente.findFirst({ where: { organizacaoId }, select: { id: true } }),
  ]);

  return (
    <Pagina>
      <Cabecalho
        icone={Users}
        titulo="Clientes"
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
        semNenhumCliente={!algum}
      />
    </Pagina>
  );
}
