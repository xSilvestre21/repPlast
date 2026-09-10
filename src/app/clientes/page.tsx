import Link from "next/link";

import { BotaoLink, Cabecalho, Cartao, EstadoVazio } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

export default async function PaginaClientes() {
  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const clientes = await db.cliente.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { apelido: "asc" },
    include: { _count: { select: { pedidos: true } } },
  });

  return (
    <>
      <Cabecalho
        titulo="Clientes"
        descricao="Os dados fiscais daqui saem impressos no cabeçalho de todo pedido."
        acao={<BotaoLink href="/clientes/novo">Novo cliente</BotaoLink>}
      />

      {clientes.length === 0 ? (
        <EstadoVazio>Nenhum cliente cadastrado ainda.</EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-borda">
          {clientes.map((cliente) => (
            <Link
              key={cliente.id}
              href={`/clientes/${cliente.id}`}
              className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 hover:bg-superficie-alta/60 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{cliente.apelido}</div>
                <div className="text-sm text-texto-suave truncate">{cliente.razaoSocial}</div>
              </div>

              <div className="text-right text-sm">
                <div className="text-texto-suave numerico">{cliente.cnpj ?? "sem CNPJ"}</div>
                <div className="text-xs text-texto-fraco">
                  {cliente.municipio ? `${cliente.municipio}/${cliente.uf ?? ""}` : "—"}
                  {cliente._count.pedidos > 0 && ` · ${cliente._count.pedidos} pedido(s)`}
                </div>
              </div>
            </Link>
          ))}
        </Cartao>
      )}
    </>
  );
}
