import { FilePlus2, Plus, ScrollText } from "lucide-react";

import { SeloStatus } from "@/components/selo-status";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  EstadoVazio,
  LinhaLista,
  formatarMoeda,
} from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function PaginaPedidos() {
  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const pedidos = await db.pedido.findMany({
    where: { organizacaoId },
    orderBy: { criadoEm: "desc" },
    include: {
      cliente: { select: { apelido: true } },
      fornecedor: { select: { nome: true } },
      _count: { select: { itens: true } },
    },
  });

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

      {pedidos.length === 0 ? (
        <EstadoVazio icone={FilePlus2}>
          Nenhum pedido lançado.
          <br />
          Comece escolhendo o cliente e a indústria.
        </EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-filete overflow-hidden palco">
          {pedidos.map((pedido) => (
            <LinhaLista key={pedido.id} href={`/pedidos/${pedido.id}`}>
              <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                <span className="font-semibold numerico shrink-0 cifra">
                  #{pedido.numero}
                </span>

                <div className="min-w-0">
                  <div className="truncate">{pedido.cliente.apelido}</div>
                  <div className="text-xs text-tinta-2 truncate">
                    {pedido.fornecedor.nome} · {pedido._count.itens} item(ns) ·{" "}
                    {DATA.format(pedido.criadoEm)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span
                  className={`numerico font-semibold ${
                    pedido.status === "CANCELADO"
                      ? "text-tinta-3 line-through"
                      : "cifra"
                  }`}
                >
                  {formatarMoeda(pedido.totalGeral.toString())}
                </span>
                <SeloStatus status={pedido.status} />
              </div>
            </LinhaLista>
          ))}
        </Cartao>
      )}
    </Pagina>
  );
}
