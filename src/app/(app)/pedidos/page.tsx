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
    <>
      <Cabecalho
        titulo="Pedidos"
        descricao="A numeração é própria de cada indústria — o nº 133 de uma não colide com o 133 de outra."
        acao={<BotaoLink href="/pedidos/novo">Novo pedido</BotaoLink>}
      />

      {pedidos.length === 0 ? (
        <EstadoVazio>
          Nenhum pedido lançado.
          <br />
          Comece escolhendo o cliente e a indústria.
        </EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-borda">
          {pedidos.map((pedido) => (
            <LinhaLista key={pedido.id} href={`/pedidos/${pedido.id}`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-semibold numerico shrink-0 texto-gradiente">
                  #{pedido.numero}
                </span>

                <div className="min-w-0">
                  <div className="truncate">{pedido.cliente.apelido}</div>
                  <div className="text-xs text-texto-suave truncate">
                    {pedido.fornecedor.nome} · {pedido._count.itens} item(ns) ·{" "}
                    {DATA.format(pedido.criadoEm)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span
                  className={`numerico font-semibold ${
                    pedido.status === "CANCELADO"
                      ? "text-texto-fraco line-through"
                      : "texto-gradiente"
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
    </>
  );
}
