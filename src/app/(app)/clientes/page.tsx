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
  ValorLinha,
} from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

export default async function PaginaClientes() {
  const { organizacaoId, db } = await escopoAtual();

  const clientes = await db.cliente.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { apelido: "asc" },
    include: { _count: { select: { pedidos: true } } },
  });

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

      {clientes.length === 0 ? (
        <EstadoVazio icone={UserRoundPlus}>Nenhum cliente cadastrado ainda.</EstadoVazio>
      ) : (
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
      )}
    </Pagina>
  );
}
