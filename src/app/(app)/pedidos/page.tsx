import { FilePlus2, Plus, ScrollText } from "lucide-react";

import { SeloStatus } from "@/components/selo-status";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  CorpoLinha,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function PaginaPedidos() {
  const { organizacaoId, db } = await escopoAtual();

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
                {/* Largura fixa: o nº 99 e o nº 2262 têm de começar a empurrar
                    o nome do cliente a partir do mesmo ponto. */}
                <span className="cifra numerico shrink-0 w-16 text-tinta-2">
                  #{pedido.numero}
                </span>

                <CorpoLinha
                  titulo={pedido.cliente.apelido}
                  detalhe={`${pedido.fornecedor.nome} · ${pedido._count.itens} item(ns) · ${DATA.format(pedido.criadoEm)}`}
                />
              </div>

              <FimDaLinha>
                <ValorLinha
                  className="w-32"
                  riscado={pedido.status === "CANCELADO"}
                  valor={formatarMoeda(pedido.totalGeral.toString())}
                />
                <div className="w-24 flex justify-end">
                  <SeloStatus status={pedido.status} />
                </div>
              </FimDaLinha>
            </LinhaLista>
          ))}
        </Cartao>
      )}
    </Pagina>
  );
}
