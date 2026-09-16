import { Plus, UserRoundPlus, Users } from "lucide-react";

import {
  Avatar,
  BotaoLink,
  Cabecalho,
  Cartao,
  CorpoLinha,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  Paginacao,
  ValorLinha,
} from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

/**
 * Quantos por página.
 *
 * A organização de referência tem 107 clientes ativos — carregar todos de
 * uma vez é o que deixava a tela lenta para abrir.
 */
const POR_PAGINA = 15;

export default async function PaginaClientes({ searchParams }: PageProps<"/clientes">) {
  const { organizacaoId, db } = await escopoAtual();
  const parametros = await searchParams;
  const pagina = Math.max(1, Number(parametros.pagina) || 1);

  const onde = { organizacaoId, ativo: true };

  const [total, clientes] = await Promise.all([
    db.cliente.count({ where: onde }),
    db.cliente.findMany({
      where: onde,
      orderBy: [{ apelido: "asc" }, { id: "asc" }],
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
      include: { _count: { select: { pedidos: true } } },
    }),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enderecoDaPagina = (destino: number) =>
    destino > 1 ? `/clientes?pagina=${destino}` : "/clientes";

  return (
    <Pagina>
      <Cabecalho
        icone={Users}
        titulo="Clientes"
        descricao="Os dados fiscais daqui saem impressos no cabeçalho de todo pedido."
        acao={
          <BotaoLink href="/clientes/novo" icone={Plus}>
            Novo cliente
          </BotaoLink>
        }
      />

      {total === 0 ? (
        <EstadoVazio icone={UserRoundPlus}>Nenhum cliente cadastrado ainda.</EstadoVazio>
      ) : (
        <>
          <Cartao className="divide-y divide-filete overflow-hidden palco">
            {clientes.map((cliente) => (
              <LinhaLista key={cliente.id} href={`/clientes/${cliente.id}`}>
                {/* Neutro, e não azul: o carimbo marca o que aconteceu com um
                    pedido. Gastá-lo numa inicial de cliente esvaziaria o sinal. */}
                <Avatar nome={cliente.apelido} />

                <CorpoLinha titulo={cliente.apelido} detalhe={cliente.razaoSocial} />

                <FimDaLinha>
                  <ValorLinha
                    className="w-44"
                    valor={cliente.cnpj ?? <span className="text-tinta-3">sem CNPJ</span>}
                    nota={
                      <>
                        {cliente.municipio ? `${cliente.municipio}/${cliente.uf ?? ""}` : "—"}
                        {cliente._count.pedidos > 0 && ` · ${cliente._count.pedidos} pedido(s)`}
                      </>
                    }
                  />
                </FimDaLinha>
              </LinhaLista>
            ))}
          </Cartao>

          <Paginacao
            pagina={pagina}
            paginas={paginas}
            total={total}
            href={enderecoDaPagina}
            rotuloItem="cliente"
          />
        </>
      )}
    </Pagina>
  );
}
